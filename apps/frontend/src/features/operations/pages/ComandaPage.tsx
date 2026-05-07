import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  User,
  Phone,
  Clock,
  Plus,
  ShoppingBag,
  Scissors,
  Construction,
  Receipt,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  MOCK_COMANDA,
  PAYMENT_METHODS,
  formatBRL,
  comandaTotal,
} from '../mocks/comanda.mock';

export function ComandaPage() {
  const { t } = useTranslation();
  const comanda = MOCK_COMANDA;
  const [fechamentoOpen, setFechamentoOpen] = useState(false);
  const total = comandaTotal(comanda);

  return (
    <div className="flex flex-col gap-md">
      <div className="flex items-center gap-sm">
        <Badge
          variant="outline"
          className="gap-xs border-warning-500 text-warning-600 bg-warning-50 text-xs"
        >
          <Construction className="h-3 w-3" />
          Mockup — Phase 3 (em breve)
        </Badge>
      </div>

      <PageHeader
        title={t('operations.pos.title', 'Comanda')}
        breadcrumbs={[
          { label: 'Operações' },
          { label: `Comanda #${comanda.id.toUpperCase()}` },
        ]}
      />

      <div className="grid grid-cols-1 gap-md lg:grid-cols-3">
        {/* Left panel — client info + add buttons */}
        <div className="lg:col-span-1 flex flex-col gap-md">
          {/* Client card */}
          <Card>
            <CardHeader className="pb-sm">
              <CardTitle className="text-base flex items-center gap-xs">
                <User className="h-4 w-4 text-primary-500" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-sm">
              <div>
                <p className="text-sm font-semibold text-neutral-800">{comanda.clientName}</p>
              </div>
              <div className="flex items-center gap-xs text-sm text-neutral-600">
                <Phone className="h-3 w-3" />
                <span>{comanda.clientPhone}</span>
              </div>
              <div className="flex items-center gap-xs text-sm text-neutral-600">
                <Clock className="h-3 w-3" />
                <span>Aberta às 10:30</span>
              </div>
              <Badge
                variant="outline"
                className="bg-success-50 text-success-700 border-success-200 text-xs"
              >
                Em atendimento
              </Badge>
            </CardContent>
          </Card>

          {/* Add actions */}
          <Card>
            <CardHeader className="pb-sm">
              <CardTitle className="text-base">Adicionar à comanda</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-sm">
              <Button variant="outline" className="justify-start gap-sm" disabled>
                <Scissors className="h-4 w-4 text-primary-500" />
                Adicionar serviço
              </Button>
              <Button variant="outline" className="justify-start gap-sm" disabled>
                <ShoppingBag className="h-4 w-4 text-primary-500" />
                Adicionar produto
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right panel — items list + totals */}
        <div className="lg:col-span-2 flex flex-col gap-md">
          <Card className="flex-1">
            <CardHeader className="pb-sm">
              <CardTitle className="text-base flex items-center gap-xs">
                <Receipt className="h-4 w-4 text-primary-500" />
                Itens da comanda
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Items */}
              <div className="space-y-sm">
                {comanda.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-sm rounded-md border border-neutral-100 bg-neutral-50 group"
                  >
                    <div className="flex items-start gap-sm">
                      <div
                        className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${item.type === 'service' ? 'bg-primary-50' : 'bg-success-50'}`}
                      >
                        {item.type === 'service' ? (
                          <Scissors className="h-4 w-4 text-primary-500" />
                        ) : (
                          <ShoppingBag className="h-4 w-4 text-success-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-neutral-800">{item.name}</p>
                        {item.professional && (
                          <p className="text-xs text-neutral-500">{item.professional}</p>
                        )}
                        <p className="text-xs text-neutral-500">
                          {item.quantity}x {formatBRL(item.unitPrice)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-sm">
                      <span className="text-sm font-semibold text-neutral-800">
                        {formatBRL(item.total)}
                      </span>
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400 hover:text-error-500"
                        aria-label={`Remover ${item.name}`}
                        disabled
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-md" />

              {/* Totals */}
              <div className="space-y-xs">
                <div className="flex justify-between text-sm text-neutral-600">
                  <span>Subtotal</span>
                  <span>{formatBRL(total)}</span>
                </div>
                <div className="flex justify-between text-sm text-neutral-600">
                  <span>Desconto</span>
                  <span>—</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-neutral-800">
                  <span>Total</span>
                  <span>{formatBRL(total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer CTA */}
          <div className="flex justify-end">
            <Button
              size="lg"
              className="gap-sm text-base"
              onClick={() => setFechamentoOpen(true)}
            >
              <Receipt className="h-5 w-5" />
              Receber pagamento
            </Button>
          </div>
        </div>
      </div>

      {/* Fechamento dialog (mockup) */}
      <Dialog open={fechamentoOpen} onOpenChange={setFechamentoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Receber pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-md">
            <div className="flex justify-between items-center p-md bg-neutral-50 rounded-md border border-neutral-200">
              <span className="text-sm font-semibold text-neutral-700">Total a receber</span>
              <span className="text-lg font-semibold text-neutral-800">{formatBRL(total)}</span>
            </div>

            <div>
              <p className="text-sm font-semibold text-neutral-700 mb-sm">Método de pagamento</p>
              <div className="grid grid-cols-2 gap-sm">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    className="flex items-center justify-center p-sm rounded-md border border-neutral-200 text-sm text-neutral-700 hover:border-primary-300 hover:bg-primary-50 transition-colors"
                    disabled
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <Badge
              variant="outline"
              className="gap-xs border-warning-500 text-warning-600 bg-warning-50 text-xs w-full justify-center"
            >
              <Construction className="h-3 w-3" />
              Mockup — Integração real na Phase 3
            </Badge>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
