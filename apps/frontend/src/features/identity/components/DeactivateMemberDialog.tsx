import { useState } from 'react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@apollo/client';
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
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { DeactivateMemberMutation } from '@/features/catalog/api/members.api';
import type {
  AdminMemberData,
  DeactivateMemberResult,
} from '@/features/catalog/api/members.api';

export interface DeactivateMemberDialogProps {
  member: AdminMemberData;
  open: boolean;
  onClose: () => void;
}

type BlockedPayload = DeactivateMemberResult['deactivateMember'];

/**
 * date-fns is not a dependency of apps/frontend today (only listed in the
 * decided stack, never installed) and adding it would touch the workspace
 * root pnpm-lock.yaml, outside this plan's file scope. Intl covers the
 * pt-BR formatting need without a new dependency.
 */
function formatStartsAt(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function DeactivateMemberDialog({
  member,
  open,
  onClose,
}: DeactivateMemberDialogProps) {
  const { t } = useTranslation();
  const [blocked, setBlocked] = useState<BlockedPayload | null>(null);

  const [deactivateMember, { loading }] = useMutation<DeactivateMemberResult>(
    DeactivateMemberMutation,
    {
      update(cache) {
        cache.evict({ fieldName: 'allMembers' });
        cache.evict({ fieldName: 'members' });
        cache.evict({
          id: cache.identify({ __typename: 'Member', id: member.id }),
        });
        cache.gc();
      },
    },
  );

  function handleClose() {
    setBlocked(null);
    onClose();
  }

  // AlertDialogAction renders Radix's DialogClose under the hood, which
  // auto-closes on click unless the click handler calls preventDefault —
  // we always take manual control of open/close here.
  async function handleConfirm(e: MouseEvent) {
    e.preventDefault();
    const res = await deactivateMember({ variables: { id: member.id } });
    const payload = res.data?.deactivateMember;
    if (!payload) return;

    const errors = payload.errors ?? [];
    if (errors.some((err) => err.code === 'MEMBER_HAS_FUTURE_APPOINTMENTS')) {
      setBlocked(payload);
      return;
    }
    if (errors.length) {
      toast.error(errors[0].message);
      return;
    }

    toast.success(
      t('team.toasts.memberDeactivated', { name: member.displayName }),
    );
    if (payload.activeCommissionRuleCount > 0) {
      toast.message(
        t('team.deactivate.commissionNote', {
          count: payload.activeCommissionRuleCount,
          name: member.displayName,
        }),
      );
    }
    handleClose();
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <AlertDialogContent>
        {blocked ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('team.deactivate.blockedTitle', {
                  name: member.displayName,
                })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('team.deactivate.blockedBody', {
                  count: blocked.futureAppointmentCount,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-sm">
              <p className="text-sm font-semibold">
                {t('team.deactivate.blockedListLabel')}
              </p>
              <ul className="space-y-1 text-sm text-neutral-800">
                {blocked.blockingAppointments.map((appt) => (
                  <li key={appt.id}>
                    {appt.clientName} — {appt.serviceName} —{' '}
                    {formatStartsAt(appt.startsAt)}
                  </li>
                ))}
              </ul>
            </div>
            <AlertDialogFooter>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleClose();
                }}
              >
                {t('team.deactivate.blockedClose')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('team.deactivate.confirmTitle', {
                  name: member.displayName,
                })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('team.deactivate.confirmBody', {
                  name: member.displayName,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {t('team.deactivate.confirmCancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                className={cn(buttonVariants({ variant: 'destructive' }))}
                disabled={loading}
                onClick={handleConfirm}
              >
                {t('team.deactivate.confirmAction')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
