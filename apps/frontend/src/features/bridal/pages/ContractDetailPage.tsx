import { useState, type ReactNode } from 'react';
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
import { ContractTextView } from '../components/ContractTextView';
import { ReverseContractPaymentDialog } from '../components/ReverseContractPaymentDialog';

const brl = (v: string) => `R$ ${formatCurrencyDisplay(v)}`;

function installmentBadgeVariant(label: string) {
  return label === 'Vencida'
    ? 'destructive'
    : label === 'Paga'
      ? 'success'
      : label === 'Parcial'
        ? 'warning'
        : 'outline';
}

/** Par rótulo/valor dos cartões do celular (UX-12); valor em R$ nunca quebra linha. */
function CardRow({ label, children, money }: { label: string; children: ReactNode; money?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-sm">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className={money ? 'whitespace-nowrap text-right' : 'text-right'}>{children}</dd>
    </div>
  );
}

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

  const canReverse = (p: { kind: string; reversed: boolean }) =>
    canCancel && p.kind === 'payment' && !p.reversed && !cancelled;

  const installmentName = (seq: number) =>
    c.paymentMode === 'a_vista'
      ? 'À VISTA'
      : c.paymentMode === 'sinal_parcelado'
        ? `SINAL ${seq}/${c.installments.length}`
        : 'SINAL';

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
              <div className="flex justify-between gap-sm">
                <dt>Itens</dt>
                <dd className="whitespace-nowrap">{brl(c.itemsTotal)}</dd>
              </div>
              <div className="flex justify-between gap-sm">
                <dt>Desconto{c.discountDescription ? ` (${c.discountDescription})` : ''}</dt>
                <dd className="whitespace-nowrap">- {brl(c.discountAmount)}</dd>
              </div>
              <div className="flex justify-between gap-sm font-semibold">
                <dt>Total</dt>
                <dd className="whitespace-nowrap" data-testid="contract-total">
                  {brl(c.totalAmount)}
                </dd>
              </div>
              <div className="flex justify-between gap-sm">
                <dt>Entrada</dt>
                <dd className="text-right">
                  <span className="whitespace-nowrap">{brl(c.depositPaid)}</span> de{' '}
                  <span className="whitespace-nowrap">{brl(c.depositAmount)}</span>
                  {Number(c.depositPending) > 0 && (
                    <span className="block whitespace-nowrap text-xs text-neutral-600">
                      pendente {brl(c.depositPending)}
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-sm">
                <dt>Pago</dt>
                <dd className="whitespace-nowrap" data-testid="contract-paid">
                  {brl(c.paid)}
                </dd>
              </div>
              <div className="flex justify-between gap-sm font-semibold">
                <dt>Saldo</dt>
                <dd className="whitespace-nowrap" data-testid="contract-balance">
                  {brl(c.balance)}
                </dd>
              </div>
              <div className="flex justify-between gap-sm">
                <dt>Quitar até</dt>
                <dd className="text-right" data-testid="contract-due">
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
        <CardContent>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm" data-testid="contract-installments-table">
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
                      <td className="py-xs">{installmentName(i.seq)}</td>
                      <td>{formatDateOnly(i.dueDate)}</td>
                      <td className="whitespace-nowrap text-right">{brl(i.amount)}</td>
                      <td className="whitespace-nowrap text-right">{brl(i.paidAmount)}</td>
                      <td>
                        <Badge variant={installmentBadgeVariant(label)}>{label}</Badge>
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
          </div>
          <ul className="space-y-sm md:hidden" data-testid="contract-installments-cards">
            {c.installments.map((i) => {
              const label = installmentStateLabel(i);
              return (
                <li key={i.seq} className="rounded-md border border-neutral-200 p-sm text-sm">
                  <div className="mb-xs flex items-center justify-between gap-sm">
                    <span className="font-semibold">{installmentName(i.seq)}</span>
                    <Badge variant={installmentBadgeVariant(label)}>{label}</Badge>
                  </div>
                  <dl className="space-y-xs">
                    <CardRow label="Vencimento">{formatDateOnly(i.dueDate)}</CardRow>
                    <CardRow label="Valor" money>
                      <span className="whitespace-nowrap">{brl(i.amount)}</span>
                    </CardRow>
                    <CardRow label="Pago" money>
                      <span className="whitespace-nowrap">{brl(i.paidAmount)}</span>
                    </CardRow>
                  </dl>
                </li>
              );
            })}
            {c.paymentMode !== 'a_vista' && (
              <li className="rounded-md border border-neutral-200 p-sm text-sm">
                <span className="font-semibold">RESTANTE</span>
                <p className="text-neutral-700">
                  até {c.balanceDueDaysBefore} dias antes do evento ({formatDateOnly(c.balanceDueDate)})
                </p>
              </li>
            )}
          </ul>
          {Number(c.discountAmount) > 0 && c.discountDescription && (
            <p className="mt-sm text-xs text-neutral-600">Desconto: {c.discountDescription}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-sm">
          <CardTitle className="text-base">Itens por pessoa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="hidden overflow-x-auto md:block">
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
                    <td className="whitespace-nowrap text-right">{brl(i.unitPrice)}</td>
                    <td className="whitespace-nowrap text-right">{brl(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-sm md:hidden" data-testid="contract-items-cards">
            {c.items.map((i) => (
              <li key={i.id} className="rounded-md border border-neutral-200 p-sm text-sm">
                <p className="font-semibold">{i.personName}</p>
                <p className="mb-xs text-neutral-700">{i.description}</p>
                <dl className="space-y-xs">
                  <CardRow label="Qtd.">{i.quantity}</CardRow>
                  <CardRow label="Preço unit." money>
                    <span className="whitespace-nowrap">{brl(i.unitPrice)}</span>
                  </CardRow>
                  <CardRow label="Total" money>
                    <span className="whitespace-nowrap font-semibold">{brl(i.total)}</span>
                  </CardRow>
                </dl>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-sm">
          <CardTitle className="text-base">Pagamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {c.payments.length === 0 ? (
            <p className="text-sm text-neutral-600">Nenhum pagamento registrado.</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
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
                        <td
                          className={`whitespace-nowrap text-right ${Number(p.amount) < 0 ? 'text-outflow-700' : ''}`}
                        >
                          {brl(p.amount)}
                        </td>
                        <td className="text-right">
                          {canReverse(p) && (
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
              </div>
              <ul className="space-y-sm md:hidden" data-testid="contract-payments-cards">
                {c.payments.map((p) => (
                  <li key={p.id} className="rounded-md border border-neutral-200 p-sm text-sm">
                    <div className="flex items-baseline justify-between gap-sm">
                      <span className="font-semibold">
                        {PAYMENT_KIND_LABEL[p.kind] ?? p.kind}
                        {p.reversed && ' (estornado)'}
                      </span>
                      <span
                        className={`whitespace-nowrap font-semibold ${Number(p.amount) < 0 ? 'text-outflow-700' : ''}`}
                      >
                        {brl(p.amount)}
                      </span>
                    </div>
                    <p className="text-neutral-700">
                      <span>{paymentMethodLabel(p.method)}</span> · {formatDateTime(p.paidAt)}
                    </p>
                    {canReverse(p) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-xs min-h-[44px]"
                        aria-label={`Estornar pagamento de ${brl(p.amount)}`}
                        onClick={() => setReverseId(p.id)}
                      >
                        Estornar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </>
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
          <ContractTextView text={c.currentText} />
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
