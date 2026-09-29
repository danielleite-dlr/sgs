import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@apollo/client';
import { Copy, RefreshCw } from 'lucide-react';
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
  CreateMemberMutation,
  ROLE_OPTIONS,
} from '@/features/catalog/api/members.api';
import type { CreateMemberResult } from '@/features/catalog/api/members.api';
import { generateTemporaryPassword } from '../temporary-password';
import { isValidPixKey, maskBrPhone, normalizeBrPhone } from '../member-validation';
import { MemberCategoriesField } from './MemberCategoriesField';
import { TemporaryPasswordBox } from './TemporaryPasswordBox';

const REQUIRED = 'Este campo é obrigatório.';

const schema = z
  .object({
    displayName: z.string().trim().min(2, REQUIRED),
    email: z.string().trim().min(1, REQUIRED).email('E-mail inválido.'),
    phone: z
      .string()
      .trim()
      .min(1, REQUIRED)
      .refine((v) => normalizeBrPhone(v) !== null, 'Telefone inválido.'),
    pixKey: z
      .string()
      .trim()
      .min(1, REQUIRED)
      .refine(isValidPixKey, 'Chave Pix inválida.'),
    birthDate: z.string(),
    roleName: z.enum(ROLE_OPTIONS, {
      errorMap: () => ({ message: 'Selecione um papel.' }),
    }),
    alsoProfessional: z.boolean(),
    categoryIds: z.array(z.string()),
    temporaryPassword: z
      .string()
      .min(8, 'A senha deve ter pelo menos 8 caracteres.')
      .max(128, 'A senha deve ter no máximo 128 caracteres.'),
  })
  .superRefine((v, ctx) => {
    const professional = v.roleName === 'PROFESSIONAL' || v.alsoProfessional;
    if (professional && v.categoryIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['categoryIds'],
        message: 'Escolha ao menos uma categoria que o profissional atende.',
      });
    }
  });

type FormValues = z.infer<typeof schema>;

function defaultValues(): FormValues {
  return {
    displayName: '',
    email: '',
    phone: '',
    pixKey: '',
    birthDate: '',
    roleName: undefined as unknown as FormValues['roleName'],
    alsoProfessional: false,
    categoryIds: [],
    temporaryPassword: generateTemporaryPassword(),
  };
}

const FORM_FIELDS: readonly string[] = [
  'displayName',
  'email',
  'phone',
  'pixKey',
  'birthDate',
  'roleName',
  'categoryIds',
  'temporaryPassword',
];

interface CreatedState {
  name: string;
  /** null quando o e-mail já tinha conta (senha não foi criada nem alterada). */
  password: string | null;
  warning: string | null;
}

export interface CreateMemberDialogProps {
  open: boolean;
  onClose: () => void;
  callerRoleName: string | null;
}

export function CreateMemberDialog({
  open,
  onClose,
  callerRoleName,
}: CreateMemberDialogProps) {
  const { t } = useTranslation();
  const [created, setCreated] = useState<CreatedState | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(),
  });

  // Cada abertura começa limpa, com uma senha nova já gerada.
  useEffect(() => {
    if (open) {
      form.reset(defaultValues());
      setCreated(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const roleName = form.watch('roleName');
  const alsoProfessional = form.watch('alsoProfessional');
  const isProfessional = roleName === 'PROFESSIONAL' || alsoProfessional;
  const roleOptions =
    callerRoleName === 'MANAGER'
      ? ROLE_OPTIONS.filter((r) => r !== 'ADMIN')
      : ROLE_OPTIONS;

  const [createMember, { loading }] = useMutation<CreateMemberResult>(
    CreateMemberMutation,
    {
      update(cache) {
        cache.evict({ fieldName: 'allMembers' });
        cache.evict({ fieldName: 'members' });
        cache.gc();
      },
    },
  );

  function handleClose() {
    // A senha não fica guardada em lugar nenhum depois de fechar.
    setCreated(null);
    form.reset(defaultValues());
    onClose();
  }

  async function copyFormPassword() {
    try {
      await navigator.clipboard.writeText(form.getValues('temporaryPassword'));
      toast.success(t('team.password.copied'));
    } catch {
      toast.error(t('team.password.copyFailed'));
    }
  }

  async function onSubmit(values: FormValues) {
    const professional = values.roleName === 'PROFESSIONAL' || values.alsoProfessional;
    const res = await createMember({
      variables: {
        input: {
          displayName: values.displayName.trim(),
          email: values.email.trim(),
          phone: normalizeBrPhone(values.phone) ?? values.phone,
          pixKey: values.pixKey.trim(),
          birthDate: values.birthDate ? `${values.birthDate}T00:00:00.000Z` : null,
          roleName: values.roleName,
          isProfessional: professional,
          categoryIds: professional ? values.categoryIds : [],
          temporaryPassword: values.temporaryPassword,
        },
      },
    });
    const payload = res.data?.createMember;
    const errors = payload?.errors ?? [];
    if (errors.length) {
      const first = errors[0];
      if (first.field && FORM_FIELDS.includes(first.field)) {
        form.setError(first.field as keyof FormValues, { message: first.message });
      } else {
        toast.error(first.message);
      }
      return;
    }
    setCreated({
      name: values.displayName.trim(),
      password: payload?.existingAccount ? null : values.temporaryPassword,
      warning: payload?.existingAccount ? (payload.warning ?? null) : null,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {created.password
                  ? t('team.createDialog.resultTitle')
                  : t('team.createDialog.existingTitle')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm">
                {t('team.createDialog.createdBody', { name: created.name })}
              </p>
              {created.password ? (
                <>
                  <TemporaryPasswordBox password={created.password} />
                  <p className="text-sm text-neutral-600">
                    {t('team.createDialog.sendHint')}
                  </p>
                </>
              ) : (
                <p role="status" className="text-sm font-medium text-neutral-800">
                  {created.warning ?? t('team.createDialog.existingFallback')}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" onClick={handleClose}>
                {t('team.createDialog.done')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('team.createDialog.title')}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('team.createDialog.nameLabel')}</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('team.createDialog.emailLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          autoComplete="off"
                          placeholder={t('team.createDialog.emailPlaceholder')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('team.createDialog.phoneLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="tel"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder={t('team.createDialog.phonePlaceholder')}
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
                      <FormLabel>{t('team.createDialog.pixLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          autoComplete="off"
                          placeholder={t('team.createDialog.pixPlaceholder')}
                        />
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
                      <FormLabel>{t('team.createDialog.birthLabel')}</FormLabel>
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
                      <FormLabel>{t('team.createDialog.roleLabel')}</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value ?? ''}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger aria-label={t('team.createDialog.roleLabel')}>
                            <SelectValue
                              placeholder={t('team.createDialog.rolePlaceholder')}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {roleOptions.map((role) => (
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

                {roleName && roleName !== 'PROFESSIONAL' && (
                  <FormField
                    control={form.control}
                    name="alsoProfessional"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="create-member-also-professional"
                            checked={field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                          />
                          <Label htmlFor="create-member-also-professional">
                            {t('team.createDialog.alsoProfessionalLabel')}
                          </Label>
                        </div>
                      </FormItem>
                    )}
                  />
                )}

                {isProfessional && (
                  <MemberCategoriesField
                    idPrefix="create-member-category"
                    value={form.watch('categoryIds')}
                    onChange={(next) =>
                      form.setValue('categoryIds', next, {
                        shouldValidate: form.formState.isSubmitted,
                      })
                    }
                    error={form.formState.errors.categoryIds?.message}
                  />
                )}

                <FormField
                  control={form.control}
                  name="temporaryPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('team.createDialog.passwordLabel')}</FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input {...field} autoComplete="off" className="font-mono" />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            form.setValue(
                              'temporaryPassword',
                              generateTemporaryPassword(),
                              { shouldValidate: true },
                            )
                          }
                        >
                          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                          {t('team.createDialog.generate')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void copyFormPassword()}
                        >
                          <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                          {t('team.password.copy')}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleClose}>
                    {t('team.createDialog.cancel')}
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading
                      ? t('team.createDialog.submitting')
                      : t('team.createDialog.submit')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
