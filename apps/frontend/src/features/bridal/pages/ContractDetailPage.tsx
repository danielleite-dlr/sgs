import { useState } from 'react';
import { useApolloClient, useQuery } from '@apollo/client';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrencyDisplay } from '@/features/catalog/utils/currency-mask';
import { paymentMethodLabel } from '@/features/operations/lib/operations-labels';
import { useBridalPermission } from '../bridal-permissions';
import {
  ContractPdfQuery,
  ContractQuery,
  type ContractPdfResult,
  type ContractResult,
} from '../api/contracts.api';
import {
  CONTRACT_STATUS_LABEL,
  PAYMENT_KIND_LABEL,
  PAYMENT_MODE_LABEL,
  installmentStateLabel,
  derivedBadges,
  formatDateOnly,
  formatDateTime,
} from '../lib/contract-labels';
import { CancelContractDialog } from '../components/CancelContractDialog';
import { ContractFormDialog } from '../components/ContractFormDialog';
import { ContractLinkCard } from '../components/ContractLinkCard';
import { base64ToBlob } from '../lib/contract-preview';
import { ContractPaymentDialog } from '../components/ContractPaymentDialog';
import { ReverseContractPaymentDialog } from '../components/ReverseContractPaymentDialog';

const brl = (v: string) => `R$ ${formatCurrencyDisplay(v)}`;

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const canRead = useBridalPermission('contract.read');
  const canWrite = useBridalPermission('contract.write');
  const canPay = useBridalPermission('contract.payment');
  const canCancel = useBridalPermission('contract.cancel');
  const client = useApolloClient();

  const { data, loading, error } = useQuery<ContractResult>(ContractQuery, {
    variables: { id },
    skip: !id || !canRead,
  });

  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reverseId, setReverseId] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const breadcrumbs = [{ label: 'Contratos', to: '/contratos' }, { label: 'Contrato' }];

  if (!canRead) {
    return (
      <div>
        <PageHeader title="Contrato" breadcrumbs={breadcrumbs} />
        <p className="text-sm text-neutral-600">Você não tem acesso aos contratos.</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div data-contract-id={id}>
        <PageHeader title="Contrato" breadcrumbs={breadcrumbs} />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  const c = data?.contract;
  if (error || !c) {
    return (
      <div>
        <PageHeader title="Contrato" breadcrumbs={breadcrumbs} />
        <p className="text-sm text-error-600">Contrato não encontrado.</p>
      </div>
    );
  }

  const cancelled = c.status === 'cancelled';
  const hasAcceptance = c.acceptance != null;

  async function downloadPdf() {
    setPdfBusy(true);
    try {
      const res = await client.query<ContractPdfResult>({
        query: ContractPdfQuery,
        variables: { id: c!.id },
        fetchPolicy: 'network-only',
      });
      const pdf = res.data.contractPdf;
      if (!pdf) {
        toast.error('O PDF do contrato não está disponível.');
        return;
      }
      const url = URL.createObjectURL(base64ToBlob(pdf.base64, 'application/pdf'));
      const a = document.createElement('a');
      a.href = url;
      a.download = pdf.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Não foi possível baixar o PDF. Tente novamente.');
    } finally {
      setPdfBusy(false);
    }
  }

  const dueText =
    c.daysToBalanceDue >= 0
      ? `faltam ${c.daysToBalanceDue} ${c.daysToBalanceDue === 1 ? 'dia' : 'dias'}`
      : `atrasado há ${-c.daysToBalanceDue} ${c.daysToBalanceDue === -1 ? 'dia' : 'dias'}`;

  return (
    <div className="flex flex-col gap-lg" data-contract-id={id}>
      <PageHeader
        title={`Contrato ${c.code}`}
        breadcrumbs={[{ label: 'Contratos', to: '/contratos' }, { label: c.code }]}
        cta={
          <div className="flex flex-wrap gap-xs">
            {canPay && !cancelled && (
              <Button type="button" onClick={() => setPayOpen(true)}>
                Registrar pagamento
              </Button>
            )}
            {canWrite && !cancelled && (
              <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
                Editar
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={pdfBusy}
              onClick={() => void downloadPdf()}
            >
              {hasAcceptance ? 'Baixar PDF' : 'Baixar PDF (não aceito)'}
            </Button>
            {canCancel && !cancelled && (
              <Button type="button" variant="destructive" onClick={() => setCancelOpen(true)}>
                Cancelar contrato
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-sm text-sm text-neutral-700">
        <Badge variant="outline">{CONTRACT_STATUS_LABEL[c.status] ?? c.status}</Badge>
        {derivedBadges(c).map((b) => (
          <Badge key={b.label} variant={b.tone}>
            {b.label}
          </Badge>
        ))}
        <span>
          {c.eventKind === 'debutante' ? 'Debutante' : 'Noiva'}: <strong>{c.brideName}</strong>
        </span>
        <span>
          · Contratante: <strong>{c.contractorName}</strong>
        </span>
        <span>
          · Grupo{' '}
          <Link className="underline" to={`/noivas/${c.groupId}`}>
            {c.groupName}
          </Link>
        </span>
        <span>· Evento em {formatDateOnly(c.eventDate)}</span>
      </div>

      {cancelled && (
        <p role="status" className="rounded-md bg-neutral-100 p-sm text-sm text-neutral-700">
          Cancelado{c.cancelledAt ? ` em ${formatDateTime(c.cancelledAt)}` : ''}
          {c.cancelledByParty ? ` (${c.cancelledByParty === 'client' ? 'pela noiva' : 'pelo estúdio'})` : ''}
          {c.cancelReason ? ` — ${c.cancelReason}` : ''}
        </p>
      )}

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <Card data-testid="contract-values">
          <CardHeader className="pb-sm">
            <CardTitle className="text-base">Valores</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-xs text-sm">
              <div className="flex justify-between">
                <dt>Itens</dt>
                <dd>{brl(c.itemsTotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Desconto{c.discountDescription ? ` (${c.discountDescription})` : ''}</dt>
                <dd>- {brl(c.discountAmount)}</dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>Total</dt>
                <dd data-testid="contract-total">{brl(c.totalAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Entrada</dt>
                <dd>
                  {brl(c.depositPaid)} de {brl(c.depositAmount)}
                  {Number(c.depositPending) > 0 && ` (pendente ${brl(c.depositPending)})`}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Pago</dt>
                <dd data-testid="contract-paid">{brl(c.paid)}</dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>Saldo</dt>
                <dd data-testid="contract-balance">{brl(c.balance)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Quitar até</dt>
                <dd data-testid="contract-due">
                  {formatDateOnly(c.balanceDueDate)}
                  {!c.settled && !cancelled && ` (${dueText})`}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <ContractLinkCard
          contract={c}
          canWrite={canWrite}
          onEditContract={canWrite ? () => setEditOpen(true) : undefined}
        />
      </div>

      <Card data-testid="contract-installments">
        <CardHeader className="pb-sm">
          <CardTitle className="text-base">
            Forma de pagamento: {PAYMENT_MODE_LABEL[c.paymentMode] ?? c.paymentMode}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th scope="col" className="py-xs">Parcela</th>
                <th scope="col">Vencimento</th>
                <th scope="col" className="text-right">Valor</th>
                <th scope="col" className="text-right">Pago</th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {c.installments.map((i) => {
                const label = installmentStateLabel(i);
                return (
                  <tr key={i.seq} className="border-t border-neutral-100">
                    <td className="py-xs">
                      {c.paymentMode === 'a_vista'
                        ? 'À VISTA'
                        : c.paymentMode === 'sinal_parcelado'
                          ? `SINAL ${i.seq}/${c.installments.length}`
                          : 'SINAL'}
                    </td>
                    <td>{formatDateOnly(i.dueDate)}</td>
                    <td className="text-right">{brl(i.amount)}</td>
                    <td className="text-right">{brl(i.paidAmount)}</td>
                    <td>
                      <Badge
                        variant={
                          label === 'Vencida'
                            ? 'destructive'
                            : label === 'Paga'
                              ? 'success'
                              : label === 'Parcial'
                                ? 'warning'
                                : 'outline'
                        }
                      >
                        {label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {c.paymentMode !== 'a_vista' && (
                <tr className="border-t border-neutral-100">
                  <td className="py-xs">RESTANTE</td>
                  <td colSpan={4}>
                    até {c.balanceDueDaysBefore} dias antes do evento ({formatDateOnly(c.balanceDueDate)})
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {Number(c.discountAmount) > 0 && c.discountDescription && (
            <p className="mt-sm text-xs text-neutral-600">Desconto: {c.discountDescription}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-sm">
          <CardTitle className="text-base">Itens por pessoa</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="contract-items-table">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="py-xs">Pessoa</th>
                <th>Serviço</th>
                <th className="text-right">Qtd.</th>
                <th className="text-right">Preço unit.</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {c.items.map((i) => (
                <tr key={i.id} className="border-t border-neutral-100">
                  <td className="py-xs">{i.personName}</td>
                  <td>{i.description}</td>
                  <td className="text-right">{i.quantity}</td>
                  <td className="text-right">{brl(i.unitPrice)}</td>
                  <td className="text-right">{brl(i.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-sm">
          <CardTitle className="text-base">Pagamentos</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {c.payments.length === 0 ? (
            <p className="text-sm text-neutral-600">Nenhum pagamento registrado.</p>
          ) : (
            <table className="w-full text-sm" data-testid="contract-payments">
              <thead>
                <tr className="text-left text-xs text-neutral-500">
                  <th className="py-xs">Data</th>
                  <th>Tipo</th>
                  <th>Método</th>
                  <th className="text-right">Valor</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {c.payments.map((p) => (
                  <tr key={p.id} className="border-t border-neutral-100">
                    <td className="py-xs">{formatDateTime(p.paidAt)}</td>
                    <td>
                      {PAYMENT_KIND_LABEL[p.kind] ?? p.kind}
                      {p.reversed && ' (estornado)'}
                    </td>
                    <td>{paymentMethodLabel(p.method)}</td>
                    <td className={`text-right ${Number(p.amount) < 0 ? 'text-error-600' : ''}`}>
                      {brl(p.amount)}
                    </td>
                    <td className="text-right">
                      {canCancel && p.kind === 'payment' && !p.reversed && !cancelled && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Estornar pagamento de ${brl(p.amount)}`}
                          onClick={() => setReverseId(p.id)}
                        >
                          Estornar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-sm">
          <CardTitle className="text-base">
            Texto do contrato (versão {c.currentVersion}) · SHA-256 {c.currentTextSha256.slice(0, 12)}…
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre
            data-testid="contract-text"
            className="whitespace-pre-wrap font-sans text-sm text-neutral-700"
          >
            {c.currentText}
          </pre>
        </CardContent>
      </Card>

      <ContractPaymentDialog contract={c} open={payOpen} onOpenChange={setPayOpen} />
      <ReverseContractPaymentDialog
        paymentId={reverseId}
        onOpenChange={(o) => {
          if (!o) setReverseId(null);
        }}
      />
      <CancelContractDialog contract={c} open={cancelOpen} onOpenChange={setCancelOpen} />
      {editOpen && (
        <ContractFormDialog open contract={c} onOpenChange={(o) => setEditOpen(o)} />
      )}
    </div>
  );
}
