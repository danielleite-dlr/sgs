import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import type { ApolloCache } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  MemberAccessQuery,
  ResetMemberAccessMutation,
  SetMemberAccessMutation,
  type AccessUserError,
  type MemberAccessData,
  type MemberAccessResult,
  type ResetMemberAccessResult,
  type SetMemberAccessResult,
} from '../access-admin.api';
import type { AccessItemData } from '../access.api';
import { notifyAccessChanged } from '../access-events';
import { AccessSwitch } from './AccessSwitch';

interface Group {
  group: string;
  label: string;
  items: AccessItemData[];
}

/** Agrupa na ordem em que o servidor mandou os itens. */
function groupItems(items: AccessItemData[]): Group[] {
  const groups: Group[] = [];
  for (const item of items) {
    let g = groups.find((x) => x.group === item.group);
    if (!g) {
      g = { group: item.group, label: item.groupLabel, items: [] };
      groups.push(g);
    }
    g.items.push(item);
  }
  return groups;
}

export function MemberAccessPanel({ memberId }: { memberId: string }) {
  const { t } = useTranslation();
  const [confirmReset, setConfirmReset] = useState(false);
  const [announce, setAnnounce] = useState('');

  const { data, loading, error } = useQuery<MemberAccessResult>(MemberAccessQuery, {
    variables: { memberId },
    fetchPolicy: 'cache-and-network',
  });

  const refetchQueries = ['MemberAccessOverview', 'MyAccess'];

  function storeAccess(cache: ApolloCache<unknown>, access: MemberAccessData | null | undefined) {
    if (!access) return;
    cache.writeQuery<MemberAccessResult>({
      query: MemberAccessQuery,
      variables: { memberId },
      data: { memberAccess: access },
    });
  }

  const [setAccess, { loading: saving }] = useMutation<SetMemberAccessResult>(
    SetMemberAccessMutation,
    {
      refetchQueries,
      update: (cache, { data: d }) => storeAccess(cache, d?.setMemberAccess.access),
    },
  );
  const [resetAccess, { loading: resetting }] = useMutation<ResetMemberAccessResult>(
    ResetMemberAccessMutation,
    {
      refetchQueries,
      update: (cache, { data: d }) => storeAccess(cache, d?.resetMemberAccess.access),
    },
  );

  const access = data?.memberAccess;
  const groups = useMemo(() => (access ? groupItems(access.items) : []), [access]);

  function handleResult(errors: AccessUserError[] | undefined) {
    if (errors && errors.length > 0) {
      toast.error(errors[0].message);
      return;
    }
    notifyAccessChanged();
    setAnnounce(t('access.saved'));
  }

  async function apply(changes: Array<{ itemId: string; enabled: boolean }>) {
    if (changes.length === 0) return;
    try {
      const res = await setAccess({ variables: { input: { memberId, changes } } });
      handleResult(res.data?.setMemberAccess.errors);
    } catch {
      toast.error(t('access.saveError'));
    }
  }

  async function doReset() {
    setConfirmReset(false);
    try {
      const res = await resetAccess({ variables: { memberId } });
      handleResult(res.data?.resetMemberAccess.errors);
    } catch {
      toast.error(t('access.saveError'));
    }
  }

  if (loading && !access) {
    return (
      <div className="space-y-3" data-testid="access-panel-loading">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (!access) {
    return (
      <p role="alert" className="text-sm text-neutral-700">
        {error?.message ?? t('access.loadError')}
      </p>
    );
  }

  const busy = saving || resetting;

  return (
    <div className="space-y-4" data-testid="member-access-panel">
      <div aria-live="polite" role="status" className="sr-only">
        {announce}
      </div>

      {!access.editable && access.lockReason && (
        <p
          className="flex items-start gap-2 rounded-md border border-neutral-300 bg-neutral-50 p-3 text-sm text-neutral-800"
          data-testid="access-person-lock"
        >
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{access.lockReason}</span>
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => {
          const adjustable = access.editable ? g.items.filter((i) => i.adjustable) : [];
          const onCount = adjustable.filter((i) => i.enabled).length;
          const groupChecked: boolean | 'mixed' =
            adjustable.length === 0
              ? g.items.every((i) => i.enabled)
              : onCount === adjustable.length
                ? true
                : onCount === 0
                  ? false
                  : 'mixed';
          const headingId = `access-group-title-${g.group}`;
          return (
            <section
              key={g.group}
              aria-labelledby={headingId}
              data-testid={`access-group-${g.group}`}
              className="rounded-md border border-neutral-200 bg-white"
            >
              <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-3">
                <h3 id={headingId} className="text-sm font-semibold text-neutral-900">
                  {g.label}
                </h3>
                <AccessSwitch
                  checked={groupChecked}
                  label={t('access.groupToggle', { group: g.label })}
                  disabled={adjustable.length === 0 || busy}
                  testId={`access-group-switch-${g.group}`}
                  onChange={(next) =>
                    void apply(adjustable.map((i) => ({ itemId: i.id, enabled: next })))
                  }
                />
              </div>
              <ul className="divide-y divide-neutral-100">
                {g.items.map((item) => {
                  const locked = !access.editable || !item.adjustable;
                  const lockId = `access-lock-${item.id}`;
                  const showLock = item.lockReason && !item.adjustable;
                  return (
                    <li
                      key={item.id}
                      data-testid={`access-item-${item.id}`}
                      className="flex items-center justify-between gap-2 px-3 py-1"
                    >
                      <div className="min-w-0 py-2">
                        <p className="text-sm text-neutral-900">{item.label}</p>
                        <p className="text-xs text-neutral-700">
                          {item.source === 'DEFAULT' ? t('access.default') : t('access.adjusted')}
                        </p>
                        {showLock && (
                          <p id={lockId} className="text-xs text-neutral-700">
                            {item.lockReason}
                          </p>
                        )}
                      </div>
                      <AccessSwitch
                        checked={item.enabled}
                        label={item.label}
                        disabled={locked || busy}
                        describedBy={showLock ? lockId : undefined}
                        onChange={(next) => void apply([{ itemId: item.id, enabled: next }])}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          data-testid="access-reset"
          disabled={!access.editable || access.adjustedCount === 0 || busy}
          onClick={() => setConfirmReset(true)}
        >
          {t('access.reset')}
        </Button>
      </div>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('access.resetConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('access.resetConfirmBody', {
                name: access.displayName,
                role: t(`team.roles.${access.roleName}`, { defaultValue: access.roleName }),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('access.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void doReset()}>
              {t('access.resetConfirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
