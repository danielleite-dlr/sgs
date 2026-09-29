import { useEffect, useMemo } from 'react';
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
  UpdateMemberMutation,
  ROLE_OPTIONS,
  SENIORITY_OPTIONS,
} from '@/features/catalog/api/members.api';
import type {
  AdminMemberData,
  UpdateMemberResult,
} from '@/features/catalog/api/members.api';
import { isValidPixKey, maskBrPhone, normalizeBrPhone } from '../member-validation';
import { MemberCategoriesField } from './MemberCategoriesField';

const REQUIRED = 'Este campo é obrigatório.';

/**
 * Telefone e Pix só são obrigatórios quando o membro já os tinha (não podem
 * ser apagados) ou quando o usuário digitou algo (então precisa ser válido).
 * Membros antigos, sem esses dados, continuam editáveis sem preenchê-los.
 */
function buildSchema(member: AdminMemberData) {
  return z.object({
    roleName: z.enum(ROLE_OPTIONS),
    isProfessional: z.boolean(),
    seniorityTier: z.enum(SENIORITY_OPTIONS).nullable(),
    phone: z
      .string()
      .trim()
      .superRefine((v, ctx) => {
        if (!v) {
          if (member.phone) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: REQUIRED });
          }
          return;
        }
        if (normalizeBrPhone(v) === null) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Telefone inválido.' });
        }
      }),
    pixKey: z
      .string()
      .trim()
      .superRefine((v, ctx) => {
        if (!v) {
          if (member.pixKey) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: REQUIRED });
          }
          return;
        }
        if (!isValidPixKey(v)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Chave Pix inválida.' });
        }
      }),
    birthDate: z.string(),
    categoryIds: z.array(z.string()),
  });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

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
    phone: maskBrPhone(member.phone ?? ''),
    pixKey: member.pixKey ?? '',
    birthDate: member.birthDate ? member.birthDate.slice(0, 10) : '',
    categoryIds: (member.categories ?? []).map((c) => c.id),
  };
}

export function MemberEditDialog({ member, open, onClose }: MemberEditDialogProps) {
  const { t } = useTranslation();

  const schema = useMemo(() => buildSchema(member), [member]);

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

  const roleName = form.watch('roleName');
  const isProfessionalChecked = form.watch('isProfessional');
  // Papel PROFESSIONAL implica profissional (o backend também força).
  const isProfessional = roleName === 'PROFESSIONAL' || isProfessionalChecked;

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
    const professional = values.roleName === 'PROFESSIONAL' || values.isProfessional;
    const input: Record<string, unknown> = {
      id: member.id,
      roleName: values.roleName,
      isProfessional: professional,
      seniorityTier: professional ? values.seniorityTier : null,
    };

    const phone = values.phone.trim();
    if (phone) {
      const normalized = normalizeBrPhone(phone);
      if (normalized && normalized !== member.phone) input.phone = normalized;
    }
    const pixKey = values.pixKey.trim();
    if (pixKey && pixKey !== member.pixKey) input.pixKey = pixKey;

    const originalBirth = member.birthDate ? member.birthDate.slice(0, 10) : '';
    if (values.birthDate !== originalBirth) {
      input.birthDate = values.birthDate ? `${values.birthDate}T00:00:00.000Z` : null;
    }
    if (professional) input.categoryIds = values.categoryIds;

    const res = await updateMember({ variables: { input } });
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('team.editDialog.title', { name: member.displayName })}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('team.editDialog.phoneLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="tel"
                      inputMode="numeric"
                      autoComplete="off"
                      onChange={(e) => field.onChange(maskBrPhone(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pixKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('team.editDialog.pixLabel')}</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="birthDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('team.editDialog.birthLabel')}</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
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

            {roleName !== 'PROFESSIONAL' && (
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
            )}

            {isProfessional && (
              <MemberCategoriesField
                idPrefix="member-edit-category"
                value={form.watch('categoryIds')}
                onChange={(next) => form.setValue('categoryIds', next)}
                error={form.formState.errors.categoryIds?.message}
              />
            )}

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
