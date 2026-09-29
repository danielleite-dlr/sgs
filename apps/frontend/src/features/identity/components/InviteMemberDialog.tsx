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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  InviteMemberMutation,
  ROLE_OPTIONS,
  SENIORITY_OPTIONS,
} from '@/features/catalog/api/members.api';
import type { InviteMemberResult } from '@/features/catalog/api/members.api';

const schema = z.object({
  email: z.string().min(1, 'Este campo é obrigatório.').email('E-mail inválido.'),
  roleName: z.enum(ROLE_OPTIONS, { errorMap: () => ({ message: 'Selecione um papel.' }) }),
  isProfessional: z.boolean(),
  seniorityTier: z.enum(SENIORITY_OPTIONS).nullable(),
});

type FormValues = z.infer<typeof schema>;

const DEFAULT_VALUES: FormValues = {
  email: '',
  roleName: undefined as unknown as FormValues['roleName'],
  isProfessional: false,
  seniorityTier: null,
};

export interface InviteMemberDialogProps {
  open: boolean;
  onClose: () => void;
}

export function InviteMemberDialog({ open, onClose }: InviteMemberDialogProps) {
  const { t } = useTranslation();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULT_VALUES,
  });

  const isProfessional = form.watch('isProfessional');

  const [inviteMember, { loading }] = useMutation<InviteMemberResult>(
    InviteMemberMutation,
    {
      update(cache) {
        cache.evict({ fieldName: 'pendingInvitations' });
        cache.gc();
      },
    },
  );

  async function onSubmit(values: FormValues) {
    const res = await inviteMember({
      variables: {
        input: {
          email: values.email,
          roleName: values.roleName,
          isProfessional: values.isProfessional,
          seniorityTier: values.isProfessional ? values.seniorityTier : null,
        },
      },
    });
    const errors = res.data?.inviteMember.errors ?? [];
    if (errors.length) {
      if (errors[0].code === 'EMAIL_TAKEN') {
        form.setError('email', { message: errors[0].message });
      } else {
        toast.error(errors[0].message);
      }
      return;
    }
    toast.success(t('team.toasts.invitationSent', { email: values.email }));
    form.reset(DEFAULT_VALUES);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          form.reset(DEFAULT_VALUES);
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('team.inviteDialog.title')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('team.inviteDialog.emailLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder={t('team.inviteDialog.emailPlaceholder')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="roleName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('team.inviteDialog.roleLabel')}</FormLabel>
                  <FormControl>
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <SelectTrigger aria-label={t('team.inviteDialog.roleLabel')}>
                        <SelectValue placeholder={t('team.inviteDialog.rolePlaceholder')} />
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
                      id="invite-is-professional"
                      checked={field.value}
                      onChange={(e) => {
                        field.onChange(e.target.checked);
                        if (!e.target.checked) {
                          form.setValue('seniorityTier', null);
                        }
                      }}
                    />
                    <Label htmlFor="invite-is-professional">
                      {t('team.inviteDialog.isProfessionalLabel')}
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
                  <FormLabel>{t('team.inviteDialog.seniorityLabel')}</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                      disabled={!isProfessional}
                    >
                      <SelectTrigger aria-label={t('team.inviteDialog.seniorityLabel')}>
                        <SelectValue
                          placeholder={t('team.inviteDialog.seniorityPlaceholder')}
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
                {t('team.inviteDialog.cancel')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading
                  ? t('team.inviteDialog.submitting')
                  : t('team.inviteDialog.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
