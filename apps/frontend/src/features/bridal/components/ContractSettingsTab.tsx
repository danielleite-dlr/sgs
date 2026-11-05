import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  ContractSettingsQuery,
  UpdateContractSettingsMutation,
  type ContractSettingsData,
  type ContractSettingsResult,
  type ContractStudioData,
  type ContractTextSection,
  type UpdateContractSettingsResult,
  type UserError,
} from '../api/contracts.api';
import { contractErrorMessage } from '../lib/contract-labels';
import { LetterheadUpload } from './LetterheadUpload';

const TEXT_SECTIONS: Array<{
  key: ContractTextSection;
  label: string;
  rows: number;
}> = [
  { key: 'title', label: 'Título', rows: 3 },
  { key: 'intro', label: 'Parágrafo de abertura', rows: 4 },
  { key: 'parties', label: 'I. Das partes', rows: 6 },
  { key: 'trialNote', label: 'Obs. dos testes', rows: 4 },
  {
    key: 'clauses',
    label: 'Cláusulas II a VIII e disposições finais',
    rows: 20,
  },
];

const STUDIO_FIELDS: Array<{ key: keyof ContractStudioData; label: string }> = [
  { key: 'name', label: 'Nome de exibição' },
  { key: 'cnpj', label: 'CNPJ' },
  { key: 'address', label: 'Endereço' },
  { key: 'representative', label: 'Representante' },
  { key: 'representativeRg', label: 'RG do representante' },
  { key: 'forumCity', label: 'Cidade do foro' },
  { key: 'forumUf', label: 'UF' },
];

/** Máscara 00.000.000/0000-00 enquanto digita. */
function maskCnpj(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14);
  let out = d.slice(0, 2);
  if (d.length > 2) out += `.${d.slice(2, 5)}`;
  if (d.length > 5) out += `.${d.slice(5, 8)}`;
  if (d.length > 8) out += `/${d.slice(8, 12)}`;
  if (d.length > 12) out += `-${d.slice(12, 14)}`;
  return out;
}

function sameStudioValue(key: keyof ContractStudioData, a: string, b: string): boolean {
  return key === 'cnpj' ? a.replace(/\D/g, '') === b.replace(/\D/g, '') : a === b;
}

function fieldErrors(errors: UserError[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of errors) {
    if (e.field && !out[e.field]) out[e.field] = contractErrorMessage(e);
  }
  return out;
}

export function ContractSettingsTab() {
  const { data, loading, error } = useQuery<ContractSettingsResult>(ContractSettingsQuery);
  if (loading) return <Skeleton className="h-64 w-full" />;
  if (error || !data) {
    return <p className="text-sm text-error-600">Não foi possível carregar as configurações.</p>;
  }
  return <SettingsForm settings={data.contractSettings} />;
}

function SettingsForm({ settings }: { settings: ContractSettingsData }) {
  const [save, { loading }] = useMutation<UpdateContractSettingsResult>(
    UpdateContractSettingsMutation,
    { refetchQueries: [{ query: ContractSettingsQuery }] },
  );
  const [days, setDays] = useState(String(settings.balanceDueDaysBefore));
  const [withdrawalDays, setWithdrawalDays] = useState(String(settings.withdrawalNoticeDays));
  const [studio, setStudio] = useState<ContractStudioData>(settings.studio);
  const [texts, setTexts] = useState(settings.texts);
  const [textsDefault, setTextsDefault] = useState(settings.textsDefault);
  const [clause, setClause] = useState(settings.cancellationClause);
  const [depositDays, setDepositDays] = useState(String(settings.alertDepositUnpaidDays));
  const [notAcceptedDays, setNotAcceptedDays] = useState(String(settings.alertNotAcceptedDays));
  const [companionDays, setCompanionDays] = useState(String(settings.alertCompanionDepositDays));
  const [dayStart, setDayStart] = useState(settings.scheduleDayStart);
  const [dayEnd, setDayEnd] = useState(settings.scheduleDayEnd);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorsByField, setErrorsByField] = useState<Record<string, string>>({});

  function applyServerErrors(errors: UserError[]) {
    const byField = fieldErrors(errors);
    setErrorsByField(byField);
    const general = errors.find((e) => !e.field || !byField[e.field]);
    setErrorMsg(general ? contractErrorMessage(general) : '');
  }

  function syncFrom(next: ContractSettingsData) {
    setStudio(next.studio);
    setTexts(next.texts);
    setTextsDefault(next.textsDefault);
  }

  async function submit() {
    setErrorMsg('');
    setErrorsByField({});
    const input: Record<string, unknown> = {
      balanceDueDaysBefore: Number(days),
      withdrawalNoticeDays: Number(withdrawalDays),
      alertDepositUnpaidDays: Number(depositDays),
      alertNotAcceptedDays: Number(notAcceptedDays),
      alertCompanionDepositDays: Number(companionDays),
      scheduleDayStart: dayStart,
      scheduleDayEnd: dayEnd,
    };
    const studioChanges: Partial<ContractStudioData> = {};
    for (const { key } of STUDIO_FIELDS) {
      if (!sameStudioValue(key, studio[key], settings.studio[key]))
        studioChanges[key] = studio[key];
    }
    if (Object.keys(studioChanges).length > 0) input.studio = studioChanges;
    const textChanges: Record<string, string> = {};
    for (const { key } of TEXT_SECTIONS) {
      if (texts[key] !== settings.texts[key]) textChanges[key] = texts[key];
    }
    if (Object.keys(textChanges).length > 0) input.texts = textChanges;
    if (clause !== settings.cancellationClause) input.cancellationClause = clause;
    try {
      const res = await save({ variables: { input } });
      const payload = res.data?.updateContractSettings;
      if (payload?.errors.length) {
        applyServerErrors(payload.errors);
        return;
      }
      if (payload?.settings) syncFrom(payload.settings);
      toast.success('Configurações salvas.');
    } catch {
      setErrorMsg('Não foi possível salvar as configurações. Tente novamente.');
    }
  }

  async function restoreText(section: ContractTextSection, label: string) {
    if (!window.confirm(`Restaurar o texto padrão de "${label}"? Sua edição será perdida.`)) return;
    setErrorMsg('');
    setErrorsByField({});
    try {
      const res = await save({
        variables: { input: { texts: { [section]: null } } },
      });
      const payload = res.data?.updateContractSettings;
      if (payload?.errors.length) {
        applyServerErrors(payload.errors);
        return;
      }
      const next = payload?.settings;
      if (next) {
        setTexts((t) => ({ ...t, [section]: next.texts[section] }));
        setTextsDefault((d) => ({
          ...d,
          [section]: next.textsDefault[section],
        }));
      }
      toast.success('Texto padrão restaurado.');
    } catch {
      setErrorMsg('Não foi possível restaurar o texto. Tente novamente.');
    }
  }

  function copyVariable(name: string) {
    void navigator.clipboard?.writeText(`{{${name}}}`).then(
      () => toast.success(`{{${name}}} copiado.`),
      () => toast.error('Não foi possível copiar.'),
    );
  }

  return (
    <form
      className="space-y-lg"
      data-testid="contract-settings"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do studio</CardTitle>
          <p className="text-xs text-neutral-600">
            Aparecem em &apos;I. Das partes&apos;, nas assinaturas e no foro.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          {STUDIO_FIELDS.map(({ key, label }) => {
            const err = errorsByField[`studio.${key}`];
            return (
              <div key={key} className={key === 'address' ? 'sm:col-span-2' : undefined}>
                <Label htmlFor={`studio-${key}`} className="text-xs font-semibold text-neutral-700">
                  {label}
                </Label>
                <Input
                  id={`studio-${key}`}
                  className="mt-xs"
                  value={studio[key]}
                  maxLength={key === 'forumUf' ? 2 : undefined}
                  aria-invalid={err ? true : undefined}
                  aria-describedby={err ? `studio-${key}-error` : undefined}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStudio((st) => ({
                      ...st,
                      [key]: key === 'cnpj' ? maskCnpj(v) : key === 'forumUf' ? v.toUpperCase() : v,
                    }));
                  }}
                />
                {err && (
                  <p
                    id={`studio-${key}-error`}
                    role="alert"
                    className="mt-xs text-xs text-error-600"
                  >
                    {err}
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <LetterheadUpload letterhead={settings.letterhead} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prazos</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <div>
            <Label htmlFor="set-days" className="text-xs font-semibold text-neutral-700">
              Prazo do restante (dias antes do evento)
            </Label>
            <Input
              id="set-days"
              className="mt-xs"
              type="number"
              min={0}
              max={365}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="set-withdrawal-days" className="text-xs font-semibold text-neutral-700">
              Prazo para desistência (dias)
            </Label>
            <Input
              id="set-withdrawal-days"
              className="mt-xs"
              type="number"
              min={0}
              max={365}
              value={withdrawalDays}
              onChange={(e) => setWithdrawalDays(e.target.value)}
            />
            {errorsByField.withdrawalNoticeDays && (
              <p role="alert" className="mt-xs text-xs text-error-600">
                {errorsByField.withdrawalNoticeDays}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Textos do contrato</CardTitle>
          <p className="text-xs text-neutral-600">
            Use **negrito** e linhas em branco para separar parágrafos. Tabelas, assinaturas e o
            bloco de aceite são fixos.
          </p>
          <div className="flex flex-wrap items-center gap-xs" aria-label="Variáveis disponíveis">
            <span className="text-xs text-neutral-600">Variáveis (clique para copiar):</span>
            {settings.textVariables.map((v) => (
              <Button
                key={v}
                type="button"
                size="sm"
                variant="outline"
                title="Copiar"
                onClick={() => copyVariable(v)}
              >
                {`{{${v}}}`}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-md">
          {TEXT_SECTIONS.map(({ key, label, rows }) => {
            const err = errorsByField[`texts.${key}`];
            return (
              <div key={key} className="space-y-xs">
                <div className="flex flex-wrap items-center justify-between gap-xs">
                  <div className="flex items-center gap-xs">
                    <Label
                      htmlFor={`contract-text-${key}`}
                      className="text-xs font-semibold text-neutral-700"
                    >
                      {label}
                    </Label>
                    <Badge variant={textsDefault[key] ? 'outline' : 'secondary'}>
                      {textsDefault[key] ? 'Padrão' : 'Editado'}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Restaurar padrão: ${label}`}
                    disabled={loading || (textsDefault[key] && texts[key] === settings.texts[key])}
                    onClick={() => void restoreText(key, label)}
                  >
                    Restaurar padrão
                  </Button>
                </div>
                <Textarea
                  id={`contract-text-${key}`}
                  rows={rows}
                  value={texts[key]}
                  aria-invalid={err ? true : undefined}
                  aria-describedby={err ? `contract-text-${key}-error` : undefined}
                  onChange={(e) => setTexts((t) => ({ ...t, [key]: e.target.value }))}
                />
                {err && (
                  <p
                    id={`contract-text-${key}-error`}
                    role="alert"
                    className="text-xs text-error-600"
                  >
                    {err}
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <section className="space-y-sm">
        <h3 className="text-base font-semibold text-neutral-800">Cláusula de cancelamento</h3>
        <Label htmlFor="set-clause" className="text-xs font-semibold text-neutral-700">
          Texto da cláusula
        </Label>
        <Textarea
          id="set-clause"
          rows={5}
          value={clause}
          onChange={(e) => setClause(e.target.value)}
        />
        <p className="text-xs text-neutral-600">
          Cancelamento pela noiva: os valores pagos ficam retidos. Pelo estúdio: tudo é devolvido.
        </p>
      </section>

      <section className="space-y-sm">
        <h3 className="text-base font-semibold text-neutral-800">Alertas</h3>
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
          <div>
            <Label htmlFor="set-deposit-days" className="text-xs font-semibold text-neutral-700">
              Entrada não paga após (dias)
            </Label>
            <Input
              id="set-deposit-days"
              className="mt-xs"
              type="number"
              min={0}
              value={depositDays}
              onChange={(e) => setDepositDays(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="set-accept-days" className="text-xs font-semibold text-neutral-700">
              Contrato não aceito após (dias)
            </Label>
            <Input
              id="set-accept-days"
              className="mt-xs"
              type="number"
              min={0}
              value={notAcceptedDays}
              onChange={(e) => setNotAcceptedDays(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="set-companion-days" className="text-xs font-semibold text-neutral-700">
              Sinal de acompanhante a N dias do evento
            </Label>
            <Input
              id="set-companion-days"
              className="mt-xs"
              type="number"
              min={0}
              value={companionDays}
              onChange={(e) => setCompanionDays(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-sm">
        <h3 className="text-base font-semibold text-neutral-800">Janela do dia do evento</h3>
        <p className="text-xs text-neutral-600">Usada na sugestão de agenda das noivas.</p>
        <div className="grid max-w-sm grid-cols-2 gap-sm">
          <div>
            <Label htmlFor="set-day-start" className="text-xs font-semibold text-neutral-700">
              Início
            </Label>
            <Input
              id="set-day-start"
              className="mt-xs"
              type="time"
              value={dayStart}
              onChange={(e) => setDayStart(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="set-day-end" className="text-xs font-semibold text-neutral-700">
              Fim
            </Label>
            <Input
              id="set-day-end"
              className="mt-xs"
              type="time"
              value={dayEnd}
              onChange={(e) => setDayEnd(e.target.value)}
            />
          </div>
        </div>
      </section>

      {errorMsg && (
        <p role="alert" data-testid="settings-error" className="text-sm text-error-600">
          {errorMsg}
        </p>
      )}
      <Button type="submit" disabled={loading}>
        {loading ? 'Salvando…' : 'Salvar configurações'}
      </Button>
    </form>
  );
}
