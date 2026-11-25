import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useMediaQuery } from '@/lib/use-media-query';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { AllMembersQuery } from '@/features/catalog/api/members.api';
import type { AllMembersResult } from '@/features/catalog/api/members.api';
import {
  MemberAccessOverviewQuery,
  type MemberAccessOverviewResult,
} from '../access-admin.api';
import { MemberAccessPanel } from '../components/MemberAccessPanel';

/** Minúsculas e sem acento, para busca por nome. */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function PerfisAcessoPage() {
  const { t } = useTranslation();
  const currentMemberId = useAuthStore((s) => s.memberId);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${t('access.title')} — SGS`;
  }, [t]);

  const { data, loading } = useQuery<AllMembersResult>(AllMembersQuery);
  const { data: overview } = useQuery<MemberAccessOverviewResult>(MemberAccessOverviewQuery, {
    fetchPolicy: 'cache-and-network',
  });

  const adjustedBy = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of overview?.memberAccessOverview ?? []) map.set(o.memberId, o.adjustedCount);
    return map;
  }, [overview]);

  const members = useMemo(() => {
    const q = fold(search.trim());
    return (data?.allMembers ?? [])
      .filter((m) => m.status === 'active')
      .filter((m) => q === '' || fold(m.displayName).includes(q));
  }, [data, search]);

  const selected = (data?.allMembers ?? []).find((m) => m.id === selectedId) ?? null;

  const panel = selected ? (
    <MemberAccessPanel key={selected.id} memberId={selected.id} />
  ) : null;

  return (
    <div className="space-y-4">
      <PageHeader title={t('access.title')} description={t('access.subtitle')} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="space-y-3">
          <Input
            type="search"
            aria-label={t('access.search')}
            placeholder={t('access.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {loading && !data ? (
            <div className="space-y-2" data-testid="perfis-loading">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-neutral-700">{t('access.empty')}</p>
          ) : (
            <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200 bg-white">
              {members.map((m) => {
                const count = adjustedBy.get(m.id) ?? 0;
                const active = m.id === selectedId;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      aria-current={active ? 'true' : undefined}
                      data-testid={`perfil-member-${m.id}`}
                      onClick={() => setSelectedId(m.id)}
                      className={cn(
                        'flex min-h-[56px] w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-700',
                        active && 'bg-primary-50',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-neutral-900">
                          {m.displayName}
                          {m.id === currentMemberId && (
                            <span className="ml-2 rounded-full border border-neutral-400 px-2 py-0.5 text-xs font-normal text-neutral-800">
                              {t('access.you')}
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-neutral-700">
                          {t(`team.roles.${m.roleName}`, { defaultValue: m.roleName })}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-neutral-700">
                        {count === 0 ? t('access.none') : t('access.adjustedCount', { count })}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {isDesktop && panel && (
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
            <h2 className="mb-3 font-serif text-headline-sm text-neutral-800">
              {t('access.openFor', { name: selected?.displayName })}
            </h2>
            {panel}
          </div>
        )}
      </div>

      {!isDesktop && (
        <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelectedId(null)}>
          <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{t('access.openFor', { name: selected?.displayName })}</SheetTitle>
              <SheetDescription className="sr-only">{t('access.subtitle')}</SheetDescription>
            </SheetHeader>
            <div className="mt-3">{panel}</div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
