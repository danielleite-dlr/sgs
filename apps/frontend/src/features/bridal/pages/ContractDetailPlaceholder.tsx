import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Construction,
  ChevronLeft,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  RefreshCw,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  mockContracts,
  mockInstallments,
  mockAiSuggestion,
  formatBRL,
  formatDate,
  CONTRACT_STATUS_LABELS,
  INSTALLMENT_STATUS_LABELS,
  type MockContract,
  type MockInstallment,
  type InstallmentStatus,
  type ContractStatus,
} from '../mocks/bridal.mock';

// ─── Status styling ───────────────────────────────────────────────────────────

const CONTRACT_STATUS_BADGE: Record<ContractStatus, string> = {
  current: 'border-success-500 text-success-700 bg-success-50',
  overdue: 'border-error-500 text-error-700 bg-error-50',
  settled: 'border-neutral-300 text-neutral-500 bg-neutral-50',
};

const INSTALLMENT_STATUS_ICON: Record<InstallmentStatus, React.ReactNode> = {
  paid: <CheckCircle2 className="h-4 w-4 text-success-500" />,
  pending: <Clock className="h-4 w-4 text-neutral-400" />,
  overdue: <AlertCircle className="h-4 w-4 text-error-500" />,
};

const INSTALLMENT_STATUS_BADGE: Record<InstallmentStatus, string> = {
  paid: 'border-success-500 text-success-700 bg-success-50',
  pending: 'border-neutral-200 text-neutral-600 bg-neutral-50',
  overdue: 'border-error-500 text-error-700 bg-error-50',
};

// ─── Not found ────────────────────────────────────────────────────────────────

function ContractNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-md text-center">
      <FileText className="h-12 w-12 text-neutral-300" />
      <h2 className="text-base font-semibold text-neutral-800">Contrato não encontrado</h2>
      <p className="text-sm text-neutral-500">O contrato solicitado não existe nos dados de exemplo.</p>
      <Button variant="outline" onClick={onBack}>
        <ChevronLeft className="mr-2 h-4 w-4" />
        Voltar para contratos
      </Button>
    </div>
  );
}

// ─── Installments tab ─────────────────────────────────────────────────────────

function InstallmentsTab({ installments }: { installments: MockInstallment[] }) {
  const [localInstallments, setLocalInstallments] = useState(installments);

  function togglePaid(id: string) {
    setLocalInstallments((prev) =>
      prev.map((inst) => {
        if (inst.id !== id) return inst;
        if (inst.status === 'paid') {
          return { ...inst, status: 'pending' as InstallmentStatus, paidAt: null };
        }
        const today = new Date().toISOString().split('T')[0];
        return { ...inst, status: 'paid' as InstallmentStatus, paidAt: today };
      }),
    );
  }

  const paidCount = localInstallments.filter((i) => i.status === 'paid').length;
  const totalValue = localInstallments.reduce((s, i) => s + i.value, 0);
  const paidValue = localInstallments
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + i.value, 0);

  return (
    <div className="space-y-md">
      {/* Summary bar */}
      <div className="flex items-center gap-lg text-sm text-neutral-600 bg-neutral-50 rounded-lg px-md py-sm border border-neutral-200">
        <span>
          Pagas: <strong className="text-neutral-800">{paidCount}/{localInstallments.length}</strong>
        </span>
        <span>
          Recebido: <strong className="text-success-700">{formatBRL(paidValue)}</strong>
        </span>
        <span>
          Pendente: <strong className="text-neutral-800">{formatBRL(totalValue - paidValue)}</strong>
        </span>
      </div>

      {/* Installments list */}
      <div className="space-y-xs">
        {localInstallments.map((inst) => (
          <div
            key={inst.id}
            className="flex items-center gap-md p-sm rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors"
          >
            {/* Status icon */}
            <div className="shrink-0">{INSTALLMENT_STATUS_ICON[inst.status]}</div>

            {/* Number */}
            <div className="w-8 text-sm font-medium text-neutral-500 shrink-0 text-center">
              {inst.number}
            </div>

            {/* Due date */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-neutral-800">{formatDate(inst.dueDate)}</p>
              {inst.paidAt && (
                <p className="text-xs text-neutral-400">Pago em {formatDate(inst.paidAt)}</p>
              )}
            </div>

            {/* Value */}
            <div className="text-sm font-semibold text-neutral-800 shrink-0">
              {formatBRL(inst.value)}
            </div>

            {/* Badge */}
            <Badge
              variant="outline"
              className={['text-xs shrink-0', INSTALLMENT_STATUS_BADGE[inst.status]].join(' ')}
            >
              {INSTALLMENT_STATUS_LABELS[inst.status]}
            </Badge>

            {/* Action */}
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-xs"
              onClick={() => togglePaid(inst.id)}
              disabled={inst.status === 'overdue' && false}
            >
              {inst.status === 'paid' ? 'Desmarcar' : 'Marcar como pago'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Cancellation tab ─────────────────────────────────────────────────────────

function CancellationTab({ contract }: { contract: MockContract }) {
  const pct =
    contract.installmentsPaid > 0
      ? Math.round((contract.installmentsPaid / contract.installmentsTotal) * 100)
      : 0;

  return (
    <div className="space-y-md">
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-md space-y-sm">
        <h3 className="text-sm font-semibold text-neutral-800">Política de cancelamento</h3>
        <p className="text-sm text-neutral-600">
          Esta política é definida no momento da criação do contrato e não pode ser alterada após a
          assinatura.
        </p>
      </div>

      {/* Policy cards */}
      <div className="grid gap-sm sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-md space-y-xs">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
            Cancelamento com &gt; 60 dias
          </p>
          <p className="text-lg font-bold text-success-700">Reembolso integral</p>
          <p className="text-xs text-neutral-500">100% do valor pago devolvido</p>
        </div>
        <div className="rounded-lg border border-warning-200 bg-warning-50 p-md space-y-xs">
          <p className="text-xs font-semibold text-warning-700 uppercase tracking-wide">
            Cancelamento entre 30–60 dias
          </p>
          <p className="text-lg font-bold text-warning-700">Retenção de 25%</p>
          <p className="text-xs text-warning-600">75% do valor pago devolvido</p>
        </div>
        <div className="rounded-lg border border-error-200 bg-error-50 p-md space-y-xs">
          <p className="text-xs font-semibold text-error-700 uppercase tracking-wide">
            Cancelamento com &lt; 30 dias
          </p>
          <p className="text-lg font-bold text-error-700">Retenção de 50%</p>
          <p className="text-xs text-error-600">50% do valor pago devolvido</p>
        </div>
      </div>

      {/* Current value example */}
      <div className="rounded-lg border border-neutral-200 bg-white p-md space-y-sm">
        <h4 className="text-sm font-semibold text-neutral-800">Simulação — estado atual</h4>
        <p className="text-sm text-neutral-600">
          {pct}% do contrato pago ({formatBRL(contract.totalValue * pct / 100)}).
        </p>
        <p className="text-sm text-neutral-500">
          Em caso de cancelamento com menos de 30 dias:{' '}
          <strong className="text-error-700">
            retenção de {formatBRL(contract.totalValue * pct / 100 / 2)}
          </strong>{' '}
          e devolução de{' '}
          <strong className="text-success-700">
            {formatBRL(contract.totalValue * pct / 100 / 2)}
          </strong>
          .
        </p>
        <p className="text-xs text-neutral-400">
          Dados de exemplo — valores reais serão calculados automaticamente na Phase 4.
        </p>
      </div>
    </div>
  );
}

// ─── AI Suggestion tab ────────────────────────────────────────────────────────

function AiSuggestionTab() {
  const [loading, setLoading] = useState(false);
  const [shown, setShown] = useState(true);

  function handleGenerate() {
    setLoading(true);
    setShown(false);
    setTimeout(() => {
      setLoading(false);
      setShown(true);
    }, 1800);
  }

  return (
    <div className="space-y-md">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-sm">
          <Sparkles className="h-5 w-5 text-primary-500" />
          <h3 className="text-sm font-semibold text-neutral-800">Sugestão de alocação — Claude AI</h3>
          {shown && !loading && (
            <Badge variant="outline" className="text-xs border-neutral-200 text-neutral-500">
              Gerado às{' '}
              {new Date(mockAiSuggestion.generatedAt).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" className="gap-xs" onClick={handleGenerate} disabled={loading}>
          <RefreshCw className={['h-4 w-4', loading ? 'animate-spin' : ''].join(' ')} />
          {loading ? 'Gerando…' : 'Gerar nova sugestão'}
        </Button>
      </div>

      {loading && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-2xl flex flex-col items-center gap-md text-center">
          <Sparkles className="h-8 w-8 text-primary-400 animate-pulse" />
          <p className="text-sm text-neutral-600">
            Analisando serviços, durações e disponibilidade dos profissionais…
          </p>
          <div className="h-1 w-48 bg-neutral-200 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full animate-[progress_1.8s_ease-in-out]" style={{ width: '80%' }} />
          </div>
        </div>
      )}

      {shown && !loading && (
        <>
          {/* Schedule table */}
          <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
            <div className="px-md py-sm bg-neutral-50 border-b border-neutral-200 text-xs font-semibold text-neutral-500 grid grid-cols-4 gap-sm">
              <span>Profissional</span>
              <span>Serviço</span>
              <span>Horário</span>
              <span>Duração</span>
            </div>
            {mockAiSuggestion.suggestedSchedule.map((item, i) => (
              <div
                key={i}
                className="px-md py-sm border-b border-neutral-100 last:border-0 grid grid-cols-4 gap-sm items-center hover:bg-neutral-50 transition-colors"
              >
                <div className="flex items-center gap-xs min-w-0">
                  <div className="h-7 w-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary-600" />
                  </div>
                  <span className="text-sm text-neutral-800 truncate">{item.professionalName}</span>
                </div>
                <span className="text-sm text-neutral-700 truncate">{item.service}</span>
                <span className="text-sm font-medium text-neutral-800">{item.startTime}</span>
                <span className="text-sm text-neutral-600">{item.durationMinutes} min</span>
              </div>
            ))}
          </div>

          {/* Justification */}
          <div className="rounded-lg border border-primary-100 bg-primary-50 p-md space-y-sm">
            <div className="flex items-center gap-xs">
              <Sparkles className="h-4 w-4 text-primary-500 shrink-0" />
              <h4 className="text-sm font-semibold text-primary-800">Justificativa da IA</h4>
            </div>
            <p className="text-sm text-primary-700 leading-relaxed">
              {mockAiSuggestion.justification}
            </p>
            <p className="text-xs text-primary-500">
              Sugestão gerada por Claude (Anthropic) com base nos dados do grupo — mockup da Phase 4.
              Na versão final, a IA terá acesso à agenda real e histórico dos profissionais.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * ContractDetailPlaceholder — Phase 4 mockup.
 * Replaces the previous empty stub. Exports the same name so the router keeps working.
 */
export function ContractDetailPlaceholder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const contract: MockContract | undefined = mockContracts.find((c) => c.id === id);

  if (!contract) {
    return <ContractNotFound onBack={() => navigate('/contratos')} />;
  }

  const installments = mockInstallments(contract.id);
  const paidInstallments = installments.filter((i) => i.status === 'paid').length;

  return (
    <div className="flex flex-col gap-md">
      {/* Mockup badge */}
      <div className="flex items-center gap-sm">
        <Badge
          variant="outline"
          className="gap-xs border-warning-500 text-warning-600 bg-warning-50 text-xs"
        >
          <Construction className="h-3 w-3" />
          Mockup — Phase 4 (em breve)
        </Badge>
      </div>

      <PageHeader
        title={`Contrato #${contract.id}`}
        breadcrumbs={[
          { label: 'Eventos' },
          { label: 'Contratos', to: '/contratos' },
          { label: contract.clientName },
        ]}
      />

      {/* Contract summary card */}
      <Card>
        <CardHeader className="pb-sm">
          <div className="flex items-start justify-between gap-md">
            <div className="flex items-center gap-sm">
              <div className="h-11 w-11 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-base font-semibold shrink-0">
                {contract.clientInitials}
              </div>
              <div>
                <CardTitle className="text-base">{contract.clientName}</CardTitle>
                <p className="text-sm text-neutral-500">Contrato #{contract.id}</p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={CONTRACT_STATUS_BADGE[contract.status]}
            >
              {CONTRACT_STATUS_LABELS[contract.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-md">
            <div>
              <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide mb-xs">
                Valor total
              </p>
              <p className="text-lg font-bold text-neutral-800">{formatBRL(contract.totalValue)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide mb-xs">
                Parcelas
              </p>
              <p className="text-lg font-bold text-neutral-800">
                {paidInstallments}/{contract.installmentsTotal}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide mb-xs">
                Recebido
              </p>
              <p className="text-lg font-bold text-success-700">
                {formatBRL(
                  installments
                    .filter((i) => i.status === 'paid')
                    .reduce((s, i) => s + i.value, 0),
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide mb-xs">
                Próximo vencimento
              </p>
              <p
                className={[
                  'text-lg font-bold',
                  contract.status === 'overdue' ? 'text-error-700' : 'text-neutral-800',
                ].join(' ')}
              >
                {contract.nextDueDate ? formatDate(contract.nextDueDate) : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="installments">
        <TabsList className="mb-md">
          <TabsTrigger value="installments">Parcelas</TabsTrigger>
          <TabsTrigger value="cancellation">Cancelamento</TabsTrigger>
          <TabsTrigger value="ai">
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            Sugestão IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="installments">
          <InstallmentsTab installments={installments} />
        </TabsContent>

        <TabsContent value="cancellation">
          <CancellationTab contract={contract} />
        </TabsContent>

        <TabsContent value="ai">
          <AiSuggestionTab />
        </TabsContent>
      </Tabs>

      {/* Back link */}
      <div className="pt-sm">
        <Button variant="ghost" size="sm" onClick={() => navigate('/contratos')} className="gap-xs">
          <ChevronLeft className="h-4 w-4" />
          Voltar para contratos
        </Button>
      </div>
    </div>
  );
}
