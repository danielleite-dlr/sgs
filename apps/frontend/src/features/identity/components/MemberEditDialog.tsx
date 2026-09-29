import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@apollo/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  UpdateMemberMutation,
  ROLE_OPTIONS,
  SENIORITY_OPTIONS,
} from '@/features/catalog/api/members.api';
import type {
  AdminMemberData,
  UpdateMemberResult,
} from '@/features/catalog/api/members.api';

const schema = z.object({
  roleName: z.enum(ROLE_OPTIONS),
  isProfessional: z.boolean(),
  seniorityTier: z.enum(SENIORITY_OPTIONS).nullable(),
});

type FormValues = z.infer<typeof schema>;

export interface MemberEditDialogProps {
  member: AdminMemberData;
  open: boolean;
  onClose: () => void;
}

function defaultsFor(member: AdminMemberData): FormValues {
  return {
    roleName: member.roleName as FormValues['roleName'],
    isProfessional: member.isProfessional,
    seniorityTier: (member.seniorityTier ?? null) as FormValues['seniorityTier'],
  };
}

export function MemberEditDialog({ member, open, onClose }: MemberEditDialogProps) {
  const { t } = useTranslation();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFor(member),
  });

  // Re-sync when the dialog is (re)opened for a different member.
  useEffect(() => {
    if (open) {
      form.reset(defaultsFor(member));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member.id]);

  const isProfessional = form.watch('isProfessional');

  const [updateMember, { loading }] = useMutation<UpdateMemberResult>(
    UpdateMemberMutation,
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

  async function onSubmit(values: FormValues) {
    const res = await updateMember({
      variables: {
        input: {
          id: member.id,
          roleName: values.roleName,
          isProfessional: values.isProfessional,
          seniorityTier: values.isProfessional ? values.seniorityTier : null,
        },
      },
    });
    const errors = res.data?.updateMember.errors ?? [];
    if (errors.length) {
      if (errors[0].field) {
        form.setError(errors[0].field as keyof FormValues, {
          message: errors[0].message,
        });
      } else {
        toast.error(errors[0].message);
      }
      return;
    }
    toast.success(t('team.toasts.memberUpdated', { name: member.displayName }));
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('team.editDialog.title', { name: member.displayName })}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="roleName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('team.editDialog.roleLabel')}</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label={t('team.editDialog.roleLabel')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((role) => (
                          <SelectItem key={role} value={role}>
                            {t(`team.roles.${role}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isProfessional"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="member-edit-is-professional"
                      checked={field.value}
                      onChange={(e) => {
                        field.onChange(e.target.checked);
                        if (!e.target.checked) {
                          form.setValue('seniorityTier', null);
                        }
                      }}
                    />
                    <Label htmlFor="member-edit-is-professional">
                      {t('team.editDialog.isProfessionalLabel')}
                    </Label>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="seniorityTier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('team.editDialog.seniorityLabel')}</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                      disabled={!isProfessional}
                    >
                      <SelectTrigger aria-label={t('team.editDialog.seniorityLabel')}>
                        <SelectValue
                          placeholder={t('team.editDialog.seniorityPlaceholder')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {SENIORITY_OPTIONS.map((tier) => (
                          <SelectItem key={tier} value={tier}>
                            {t(`team.seniority.${tier}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t('team.editDialog.cancel')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading
                  ? t('team.editDialog.submitting')
                  : t('team.editDialog.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
