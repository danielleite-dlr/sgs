import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useLazyQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  ClientsByFieldQuery,
  CreateClientMutation,
  UpdateClientMutation,
  ClientsListQuery,
} from '../api/clients.api';
import type {
  ClientData,
  ClientsByFieldResult,
  CreateClientResult,
  UpdateClientResult,
  UserError,
} from '../api/clients.api';
import { formatCpf, unformatCpf, validateCpf } from '../utils/cpf';
import { CpfDuplicateAlert } from './CpfDuplicateAlert';
import type { DuplicateClient } from './CpfDuplicateAlert';

const schema = z
  .object({
    fullName: z.string().min(2, 'Digite um nome válido.'),
    phone: z.string().optional().or(z.literal('')),
    email: z
      .string()
      .email('Informe um e-mail válido.')
      .optional()
      .or(z.literal('')),
    cpf: z.string().optional().or(z.literal('')),
    birthDate: z.string().optional().or(z.literal('')),
    address: z.string().optional().or(z.literal('')),
    notes: z.string().optional().or(z.literal('')),
  })
  .superRefine((val, ctx) => {
    // Either phone or email is required (D-21)
    const hasPhone = val.phone && val.phone.trim().length > 0;
    const hasEmail = val.email && val.email.trim().length > 0;
    if (!hasPhone && !hasEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe pelo menos um telefone ou e-mail.',
        path: ['phone'],
      });
    }
    // CPF checksum validation when provided
    if (val.cpf && val.cpf.length > 0) {
      if (!validateCpf(val.cpf)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CPF inválido. Verifique os números.',
          path: ['cpf'],
        });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

export interface ClientFormProps {
  /** Pre-filled data for edit mode. Absent = create mode. */
  initial?: ClientData;
}

/**
 * Full-page form for creating or editing a client.
 * Uses full-page layout (NOT a Dialog) per UI-SPEC §Form Pattern.
 *
 * Features:
 * - CPF mask (XXX.XXX.XXX-XX) with progressive formatting
 * - CPF duplicate lookup on blur (only when valid) — alerts but doesn't block (D-22)
 * - Required: fullName + (phone OR email)
 * - Server errors mapped to form fields
 */
export function ClientForm({ initial }: ClientFormProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEdit = Boolean(initial);

  const [serverError, setServerError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateClient[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: initial?.fullName ?? '',
      phone: initial?.phone ?? '',
      email: initial?.email ?? '',
      cpf: initial?.cpf ? formatCpf(initial.cpf) : '',
      birthDate: initial?.birthDate
        ? new Date(initial.birthDate).toISOString().slice(0, 10)
        : '',
      address: initial?.address ?? '',
      notes: initial?.notes ?? '',
    },
    mode: 'onBlur',
  });

  const { formState: { isSubmitting } } = form;

  const [lookupByField] = useLazyQuery<ClientsByFieldResult>(ClientsByFieldQuery, {
    fetchPolicy: 'network-only',
  });

  const [createClient] = useMutation<CreateClientResult>(CreateClientMutation, {
    refetchQueries: [{ query: ClientsListQuery }],
  });

  const [updateClient] = useMutation<UpdateClientResult>(UpdateClientMutation, {
    refetchQueries: [{ query: ClientsListQuery }],
  });

  async function onCpfBlur(cpfValue: string) {
    const raw = unformatCpf(cpfValue);
    if (!validateCpf(raw)) {
      // Not valid — don't query (D-22: skip query for invalid CPF)
      return;
    }
    try {
      const res = await lookupByField({
        variables: {
          cpf: raw,
          excludeId: initial?.id,
        },
      });
      setDuplicates(res.data?.clientsByField ?? []);
    } catch {
      // Silently ignore lookup failures — duplicate alert is advisory only
    }
  }

  function mapServerErrors(errors: UserError[]) {
    if (errors.length === 0) return;
    const first = errors[0];
    if (first.code === 'CONTACT_REQUIRED') {
      form.setError('phone', { message: t('clients.validation.contactRequired') });
      return;
    }
    if (first.code === 'CPF_INVALID') {
      form.setError('cpf', { message: t('clients.validation.cpfInvalid') });
      return;
    }
    if (first.field) {
      form.setError(first.field as keyof FormValues, { message: first.message });
    } else {
      setServerError(first.message);
    }
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const cpfDigits = values.cpf ? unformatCpf(values.cpf) : undefined;

    try {
      if (isEdit && initial) {
        const res = await updateClient({
          variables: {
            input: {
              id: initial.id,
              fullName: values.fullName,
              phone: values.phone || null,
              email: values.email || null,
              cpf: cpfDigits || null,
              birthDate: values.birthDate || null,
              address: values.address || null,
              notes: values.notes || null,
            },
          },
        });
        const errors = res.data?.updateClient.errors ?? [];
        if (errors.length) {
          mapServerErrors(errors);
          return;
        }
        toast.success(t('catalog.toasts.savedChanges'));
        navigate(`/clientes/${initial.id}`);
      } else {
        const res = await createClient({
          variables: {
            input: {
              fullName: values.fullName,
              phone: values.phone || null,
              email: values.email || null,
              cpf: cpfDigits || null,
              birthDate: values.birthDate || null,
              address: values.address || null,
              notes: values.notes || null,
            },
          },
        });
        const errors = res.data?.createClient.errors ?? [];
        if (errors.length) {
          mapServerErrors(errors);
          return;
        }
        const newId = res.data?.createClient.client?.id;
        toast.success(
          t('catalog.toasts.categoryCreated', { name: values.fullName }).replace(
            'categoria',
            'cliente',
          ),
        );
        navigate(newId ? `/clientes/${newId}` : '/clientes');
      }
    } catch {
      setServerError('Não foi possível salvar. Tente novamente.');
    }
  }

  const pageTitle = isEdit
    ? t('pages.clientes.editTitle')
    : t('pages.clientes.newTitle');

  return (
    <>
      <PageHeader
        title={pageTitle}
        breadcrumbs={[
          { label: t('navigation.clientes'), to: '/clientes' },
          ...(isEdit && initial
            ? [
                { label: initial.fullName, to: `/clientes/${initial.id}` },
                { label: t('pages.clientes.editTitle') },
              ]
            : [{ label: pageTitle }]),
        ]}
      />

      <FormProvider {...form}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-md max-w-2xl">
            {/* Full name */}
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('clients.form.fullName')}{' '}
                    <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t('clients.form.fullNamePlaceholder')}
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phone + Email (2-column grid) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('clients.form.phone')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="tel"
                        placeholder={t('clients.form.phonePlaceholder')}
                      />
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
                    <FormLabel>{t('clients.form.email')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder={t('clients.form.emailPlaceholder')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* CPF — single column with mask */}
            <FormField
              control={form.control}
              name="cpf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('clients.form.cpf')}</FormLabel>
                  <FormControl>
                    <Input
                      value={field.value}
                      onChange={(e) => field.onChange(formatCpf(e.target.value))}
                      onBlur={() => {
                        field.onBlur();
                        void onCpfBlur(field.value);
                      }}
                      placeholder={t('clients.form.cpfPlaceholder')}
                      aria-label="CPF"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={14} // "XXX.XXX.XXX-XX"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* CPF Duplicate Alert — between CPF field and birthDate */}
            {duplicates.length > 0 && <CpfDuplicateAlert clients={duplicates} />}

            {/* Birth Date */}
            <FormField
              control={form.control}
              name="birthDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('clients.form.birthDate')}</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Address */}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('clients.form.address')}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t('clients.form.addressPlaceholder')} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes (textarea) */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('clients.form.notes')}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={t('clients.form.notesPlaceholder')}
                      rows={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Server error alert */}
            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            {/* Form footer */}
            <div className="flex gap-sm pt-sm">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? 'Salvando…'
                  : isEdit
                    ? 'Salvar alterações'
                    : 'Salvar'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/clientes')}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Form>
      </FormProvider>
    </>
  );
}
