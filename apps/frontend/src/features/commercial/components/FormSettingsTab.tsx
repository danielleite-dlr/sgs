import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  CommercialAssigneesForIntakeQuery,
  CommercialFormSettingsQuery,
  RegenerateCommercialFormTokenMutation,
  UpdateCommercialFormSettingsMutation,
  type FormSettings,
  type IntakeMember,
  type IntakeUserError,
} from '../api/intake.api';

const MAX_SUCCESS = 300;
const MAX_CONSENT = 1000;

interface SettingsPayload {
  settings: FormSettings | null;
  errors: IntakeUserError[];
}

export function FormSettingsTab() {
  const { data, loading } = useQuery<{ commercialFormSettings: FormSettings }>(
    CommercialFormSettingsQuery,
  );
  const assignees = useQuery<{ commercialAssignees: IntakeMember[] }>(
    CommercialAssigneesForIntakeQuery,
  );
  const [update, updateState] = useMutation<{ updateCommercialFormSettings: SettingsPayload }>(
    UpdateCommercialFormSettingsMutation,
  );
  const [regenerate] = useMutation<{ regenerateCommercialFormToken: SettingsPayload }>(
    RegenerateCommercialFormTokenMutation,
  );
  const settings = data?.commercialFormSettings;
  const [successMessage, setSuccessMessage] = useState('');
  const [consentText, setConsentText] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (settings) {
      setSuccessMessage(settings.successMessage ?? '');
      setConsentText(settings.consentText);
    }
  }, [settings]);

  if (loading && !settings) return <Skeleton className="h-64 w-full" />;
  if (!settings) {
    return <p role="alert">Não foi possível carregar as configurações do formulário.</p>;
  }

  const link = `${window.location.origin}${settings.publicPath}`;
  const iframeCode = `<iframe src="${link}?embed=1" width="100%" height="720" style="border:0" title="Formulário de contato"></iframe>`;

  async function save(input: Record<string, unknown>, okMessage?: string) {
    setError('');
    try {
      const res = await update({ variables: { input } });
      const p = res.data?.updateCommercialFormSettings;
      if (p?.errors.length) {
        setError(p.errors[0].message);
        return;
      }
      if (okMessage) toast.success(okMessage);
    } catch {
      setError('Não foi possível salvar. Tente novamente.');
    }
  }

  async function onRegenerate() {
    setConfirmOpen(false);
    setError('');
    try {
      const res = await regenerate();
      const p = res.data?.regenerateCommercialFormToken;
      if (p?.errors.length) {
        setError(p.errors[0].message);
        return;
      }
      toast.success('Novo link gerado');
    } catch {
      setError('Não foi possível gerar o novo link. Tente novamente.');
    }
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copiado`);
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.');
    }
  }

  return (
    <div className="space-y-md">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Formulário do site</CardTitle>
        </CardHeader>
        <CardContent className="space-y-md text-sm">
          <div className="flex items-center gap-sm">
            <button
              type="button"
              role="switch"
              id="form-active"
              aria-checked={settings.isActive}
              aria-label="Formulário ativo"
              disabled={updateState.loading}
              onClick={() => void save({ isActive: !settings.isActive })}
              className={`relative h-7 w-12 rounded-full transition-colors ${
                settings.isActive ? 'bg-primary' : 'bg-neutral-300'
              }`}
            >
              <span
                className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition-transform ${
                  settings.isActive ? 'translate-x-5' : ''
                }`}
              />
            </button>
            <Label htmlFor="form-active">Formulário ativo</Label>
          </div>

          <div className="space-y-1">
            <Label htmlFor="form-link">Link público</Label>
            <div className="flex gap-sm">
              <Input id="form-link" readOnly value={link} className="h-11" />
              <Button variant="outline" onClick={() => void copy(link, 'Link')}>
                Copiar link
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="form-iframe">Código para o site do salão</Label>
            <Textarea id="form-iframe" readOnly rows={3} value={iframeCode} />
            <Button variant="outline" onClick={() => void copy(iframeCode, 'Código')}>
              Copiar código
            </Button>
          </div>

          <Button variant="outline" onClick={() => setConfirmOpen(true)}>
            Gerar novo link
          </Button>

          <div className="space-y-1">
            <Label htmlFor="form-assignee">Responsável padrão</Label>
            <select
              id="form-assignee"
              className="h-11 w-full rounded-md border border-neutral-200 bg-white px-3"
              value={settings.defaultAssignee?.id ?? ''}
              onChange={(e) =>
                void save(
                  e.target.value
                    ? { defaultAssigneeMemberId: e.target.value }
                    : { clearDefaultAssignee: true },
                )
              }
            >
              <option value="">Fila de gerentes (sem responsável)</option>
              {(assignees.data?.commercialAssignees ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="form-success">Mensagem de sucesso</Label>
            <Textarea
              id="form-success"
              rows={2}
              maxLength={MAX_SUCCESS}
              value={successMessage}
              onChange={(e) => setSuccessMessage(e.target.value)}
            />
            <p className="text-neutral-500">
              {successMessage.length}/{MAX_SUCCESS}
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="form-consent">Texto de consentimento (LGPD)</Label>
            <Textarea
              id="form-consent"
              rows={4}
              maxLength={MAX_CONSENT}
              value={consentText}
              onChange={(e) => setConsentText(e.target.value)}
            />
            <p className="text-neutral-500">
              {consentText.length}/{MAX_CONSENT} · versão {settings.consentTextVersion}
            </p>
          </div>

          {error && (
            <p role="alert" className="text-danger-700">
              {error}
            </p>
          )}

          <Button
            disabled={updateState.loading}
            onClick={() => void save({ successMessage, consentText }, 'Textos salvos')}
          >
            Salvar textos
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar novo link?</AlertDialogTitle>
            <AlertDialogDescription>O link antigo deixa de funcionar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onRegenerate()}>Gerar novo link</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
