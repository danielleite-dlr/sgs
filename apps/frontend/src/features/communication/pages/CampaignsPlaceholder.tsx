import { useState } from 'react';
import {
  Construction,
  Plus,
  Megaphone,
  Play,
  Pause,
  MoreHorizontal,
  FileText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  MOCK_CAMPAIGNS,
  CAMPAIGN_TYPE_LABELS,
  CAMPAIGN_STATUS_LABELS,
  type CampaignType,
  type CampaignStatus,
} from '../mocks/communication.mock';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CampaignStatus }) {
  const variants: Record<CampaignStatus, string> = {
    ativa:    'border-success-500 text-success-700 bg-success-50',
    pausada:  'border-warning-500 text-warning-700 bg-warning-50',
    rascunho: 'border-neutral-300 text-neutral-600 bg-neutral-50',
  };
  return (
    <Badge variant="outline" className={cn('text-xs', variants[status])}>
      {CAMPAIGN_STATUS_LABELS[status]}
    </Badge>
  );
}

// ─── Type badge ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: CampaignType }) {
  const variants: Record<CampaignType, string> = {
    aniversario:  'border-primary-300 text-primary-700 bg-primary-50',
    inativos:     'border-neutral-300 text-neutral-600 bg-neutral-50',
    sazonal:      'border-warning-300 text-warning-700 bg-warning-50',
    personalizada: 'border-success-300 text-success-700 bg-success-50',
  };
  return (
    <Badge variant="outline" className={cn('text-xs', variants[type])}>
      {CAMPAIGN_TYPE_LABELS[type]}
    </Badge>
  );
}

// ─── New campaign wizard ──────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3;

function NewCampaignDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<WizardStep>(1);
  const [name, setName] = useState('');
  const [type, setType] = useState<CampaignType>('aniversario');
  const [segment, setSegment] = useState('');
  const [message, setMessage] = useState('');

  function handleClose() {
    setStep(1);
    setName('');
    setType('aniversario');
    setSegment('');
    setMessage('');
    onClose();
  }

  function handleSaveDraft() {
    toast.info('Em breve — criação de campanhas disponível na Fase 5.');
    handleClose();
  }

  const stepTitles: Record<WizardStep, string> = {
    1: 'Nova campanha — Passo 1 de 3',
    2: 'Nova campanha — Passo 2 de 3',
    3: 'Nova campanha — Passo 3 de 3',
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{stepTitles[step]}</DialogTitle>
        </DialogHeader>

        {/* Step 1 — nome + tipo */}
        {step === 1 && (
          <div className="flex flex-col gap-md">
            <div className="flex flex-col gap-sm">
              <Label htmlFor="campaign-name">Nome da campanha</Label>
              <Input
                id="campaign-name"
                placeholder="Ex.: Parabéns, aniversariante!"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-sm">
              <Label>Tipo de campanha</Label>
              <RadioGroup
                value={type}
                onValueChange={(v) => setType(v as CampaignType)}
                className="grid grid-cols-2 gap-sm"
              >
                {(Object.entries(CAMPAIGN_TYPE_LABELS) as [CampaignType, string][]).map(
                  ([val, label]) => (
                    <label
                      key={val}
                      htmlFor={`type-${val}`}
                      className={cn(
                        'flex items-center gap-sm rounded-md border p-sm cursor-pointer transition-colors',
                        type === val
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50',
                      )}
                    >
                      <RadioGroupItem id={`type-${val}`} value={val} className="sr-only" />
                      <span className="text-sm font-medium">{label}</span>
                    </label>
                  ),
                )}
              </RadioGroup>
            </div>
          </div>
        )}

        {/* Step 2 — segmento */}
        {step === 2 && (
          <div className="flex flex-col gap-md">
            <div className="flex flex-col gap-sm">
              <Label htmlFor="segment-select">Segmento de clientes</Label>
              <Select value={segment} onValueChange={setSegment}>
                <SelectTrigger id="segment-select">
                  <SelectValue placeholder="Selecione o segmento…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aniversariantes">Aniversariantes do mês</SelectItem>
                  <SelectItem value="inativos90">Clientes inativos (&gt; 90 dias)</SelectItem>
                  <SelectItem value="inativos60">Clientes inativos (&gt; 60 dias)</SelectItem>
                  <SelectItem value="todos">Todos os clientes ativos</SelectItem>
                  <SelectItem value="personalizado">Personalizado…</SelectItem>
                </SelectContent>
              </Select>
              {segment && (
                <p className="text-xs text-neutral-500">
                  Estimativa: <strong>~{Math.floor(Math.random() * 80) + 20} clientes</strong> neste
                  segmento com base no histórico atual.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 3 — mensagem */}
        {step === 3 && (
          <div className="flex flex-col gap-md">
            <div className="flex flex-col gap-sm">
              <Label htmlFor="msg-template">Template de mensagem</Label>
              <Textarea
                id="msg-template"
                placeholder="Olá, {{nome}}! Temos uma novidade especial para você..."
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <p className="text-xs text-neutral-500">
                Use <code className="font-mono bg-neutral-100 px-1 rounded">{'{{nome}}'}</code>,{' '}
                <code className="font-mono bg-neutral-100 px-1 rounded">{'{{salon}}'}</code>,{' '}
                <code className="font-mono bg-neutral-100 px-1 rounded">{'{{data}}'}</code> como
                variáveis.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-sm sm:justify-between">
          <div>
            {step > 1 && (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => (s - 1) as WizardStep)}>
                Voltar
              </Button>
            )}
          </div>
          <div className="flex gap-sm">
            <Button variant="outline" size="sm" onClick={handleClose}>
              Cancelar
            </Button>
            {step < 3 ? (
              <Button
                size="sm"
                onClick={() => setStep((s) => (s + 1) as WizardStep)}
                disabled={step === 1 && !name.trim()}
              >
                Próximo
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={handleSaveDraft}>
                Salvar como rascunho
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

/**
 * CampaignsPlaceholder — Phase 5 mockup.
 * Exported as CampaignsPlaceholder to match the router's import path.
 */
export function CampaignsPlaceholder() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="flex flex-col gap-lg">
      {/* Mockup badge */}
      <div>
        <Badge
          variant="outline"
          className="gap-xs border-warning-500 text-warning-600 bg-warning-50 text-xs"
        >
          <Construction className="h-3 w-3" />
          Mockup — Phase 5
        </Badge>
      </div>

      <PageHeader
        title="Campanhas"
        cta={
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-xs" />
            Nova campanha
          </Button>
        }
      />

      {/* Campaigns table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="px-md py-sm text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    Nome
                  </th>
                  <th className="px-md py-sm text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    Tipo
                  </th>
                  <th className="px-md py-sm text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    Segmento
                  </th>
                  <th className="px-md py-sm text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide hidden md:table-cell">
                    Última execução
                  </th>
                  <th className="px-md py-sm text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide hidden md:table-cell">
                    Próximo envio
                  </th>
                  <th className="px-md py-sm text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-md py-sm text-right text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {MOCK_CAMPAIGNS.map((campaign, i) => (
                  <tr
                    key={campaign.id}
                    className={cn(
                      'border-b border-neutral-100 last:border-0',
                      i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50',
                    )}
                  >
                    <td className="px-md py-sm">
                      <div className="flex items-center gap-sm">
                        <div className="h-8 w-8 rounded-md bg-primary-50 flex items-center justify-center shrink-0">
                          <Megaphone className="h-4 w-4 text-primary-500" />
                        </div>
                        <span className="font-medium text-neutral-800">{campaign.name}</span>
                      </div>
                    </td>
                    <td className="px-md py-sm">
                      <TypeBadge type={campaign.type} />
                    </td>
                    <td className="px-md py-sm text-neutral-600">
                      {campaign.segment} clientes
                    </td>
                    <td className="px-md py-sm text-neutral-500 hidden md:table-cell">
                      {formatDate(campaign.lastRun)}
                    </td>
                    <td className="px-md py-sm text-neutral-500 hidden md:table-cell">
                      {formatDate(campaign.nextRun)}
                    </td>
                    <td className="px-md py-sm">
                      <StatusBadge status={campaign.status} />
                    </td>
                    <td className="px-md py-sm text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Ações de {campaign.name}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() =>
                              toast.info('Em breve — disponível na Fase 5.')
                            }
                          >
                            <FileText className="h-4 w-4 mr-sm" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              toast.info('Em breve — disponível na Fase 5.')
                            }
                          >
                            {campaign.status === 'ativa' ? (
                              <>
                                <Pause className="h-4 w-4 mr-sm" />
                                Pausar
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-sm" />
                                Ativar
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <NewCampaignDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
