import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@apollo/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ResetMemberPasswordMutation } from '@/features/catalog/api/members.api';
import type {
  AdminMemberData,
  ResetMemberPasswordResult,
} from '@/features/catalog/api/members.api';
import { TemporaryPasswordBox } from './TemporaryPasswordBox';

export interface ResetMemberPasswordDialogProps {
  member: AdminMemberData;
  open: boolean;
  onClose: () => void;
}

export function ResetMemberPasswordDialog({
  member,
  open,
  onClose,
}: ResetMemberPasswordDialogProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState<string | null>(null);
  const [resetPassword, { loading }] = useMutation<ResetMemberPasswordResult>(
    ResetMemberPasswordMutation,
  );

  function handleClose() {
    // A senha não fica guardada depois de fechar.
    setPassword(null);
    onClose();
  }

  async function onConfirm() {
    const res = await resetPassword({
      variables: { input: { id: member.id } },
    });
    const payload = res.data?.resetMemberPassword;
    const errors = payload?.errors ?? [];
    if (errors.length || !payload?.temporaryPassword) {
      toast.error(errors[0]?.message ?? t('errors.generic'));
      return;
    }
    setPassword(payload.temporaryPassword);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <DialogContent>
        {password ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {t('team.resetPassword.resultTitle', { name: member.displayName })}
              </DialogTitle>
              <DialogDescription>
                {t('team.createDialog.sendHint')}
              </DialogDescription>
            </DialogHeader>
            <TemporaryPasswordBox password={password} />
            <DialogFooter>
              <Button type="button" onClick={handleClose}>
                {t('team.createDialog.done')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {t('team.resetPassword.confirmTitle', { name: member.displayName })}
              </DialogTitle>
              <DialogDescription>
                {t('team.resetPassword.confirmBody', { name: member.displayName })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                {t('team.resetPassword.cancel')}
              </Button>
              <Button type="button" disabled={loading} onClick={() => void onConfirm()}>
                {loading
                  ? t('team.resetPassword.submitting')
                  : t('team.resetPassword.confirmAction')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
