import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  ContractSettingsQuery,
  UpdateContractSettingsMutation,
  type ContractSettingsData,
  type ContractSettingsResult,
  type UpdateContractSettingsResult,
} from '../api/contracts.api';
import { contractErrorMessage } from '../lib/contract-labels';

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
  const [template, setTemplate] = useState(settings.templateBody);
  const [clause, setClause] = useState(settings.cancellationClause);
  const [depositDays, setDepositDays] = useState(String(settings.alertDepositUnpaidDays));
  const [notAcceptedDays, setNotAcceptedDays] = useState(String(settings.alertNotAcceptedDays));
  const [companionDays, setCompanionDays] = useState(String(settings.alertCompanionDepositDays));
  const [dayStart, setDayStart] = useState(settings.scheduleDayStart);
  const [dayEnd, setDayEnd] = useState(settings.scheduleDayEnd);
  const [errorMsg, setErrorMsg] = useState('');
  const [missing, setMissing] = useState(settings.missingVariables);
  const templateRef = useRef<HTMLTextAreaElement>(null);

  function insertVariable(name: string) {
    const token = `{{${name}}}`;
    const el = templateRef.current;
    const start = el?.selectionStart ?? template.length;
    const end = el?.selectionEnd ?? template.length;
    setTemplate(template.slice(0, start) + token + template.slice(end));
  }

  async function submit(restoreTemplate = false) {
    setErrorMsg('');
    const input: Record<string, unknown> = {
      balanceDueDaysBefore: Number(days),
      alertDepositUnpaidDays: Number(depositDays),
      alertNotAcceptedDays: Number(notAcceptedDays),
      alertCompanionDepositDays: Number(companionDays),
      scheduleDayStart: dayStart,
      scheduleDayEnd: dayEnd,
    };
    if (restoreTemplate) input.templateBody = null;
    else if (template !== settings.templateBody) input.templateBody = template;
    if (clause !== settings.cancellationClause) input.cancellationClause = clause;
    try {
      const res = await save({ variables: { input } });
      const payload = res.data?.updateContractSettings;
      if (payload?.errors.length) {
        setErrorMsg(contractErrorMessage(payload.errors[0]));
        return;
      }
      if (payload?.settings) {
        setMissing(payload.settings.missingVariables);
        if (restoreTemplate) setTemplate(payload.settings.templateBody);
      }
      toast.success('Configurações salvas.');
    } catch {
      setErrorMsg('Não foi possível salvar as configurações. Tente novamente.');
    }
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
      <section className="space-y-sm">
        <h3 className="text-base font-semibold text-neutral-800">Prazo do restante</h3>
        <div className="max-w-xs">
          <Label htmlFor="set-days" className="text-xs font-semibold text-neutral-700">
            Prazo padrão: quitar até N dias antes do evento
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
      </section>

      <section className="space-y-sm">
        <h3 className="text-base font-semibold text-neutral-800">Modelo do contrato</h3>
        <Label htmlFor="set-template" className="text-xs font-semibold text-neutral-700">
          Texto do modelo
        </Label>
        <Textarea
          id="set-template"
          ref={templateRef}
          rows={14}
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-xs" aria-label="Variáveis disponíveis">
          <span className="text-xs text-neutral-600">Variáveis:</span>
          {settings.templateVariables.map((v) => (
            <Button
              key={v}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => insertVariable(v)}
            >
              {`{{${v}}}`}
            </Button>
          ))}
        </div>
        {missing.length > 0 && (
          <p role="status" data-testid="missing-variables" className="text-sm text-warning-700">
            O modelo não usa: {missing.map((v) => `{{${v}}}`).join(', ')}.
          </p>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={loading || settings.isDefaultTemplate}
          onClick={() => void submit(true)}
        >
          Restaurar modelo padrão
        </Button>
      </section>

      <section className="space-y-sm">
        <h3 className="text-base font-semibold text-neutral-800">Cláusula de cancelamento</h3>
        <Label htmlFor="set-clause" className="text-xs font-semibold text-neutral-700">
          Texto da cláusula
        </Label>
        <Textarea id="set-clause" rows={5} value={clause} onChange={(e) => setClause(e.target.value)} />
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
