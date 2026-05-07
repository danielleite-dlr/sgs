import { useState } from 'react';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import {
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Globe,
  MessageCircle,
  Package,
  Sparkles,
  ChevronRight as ChevronRightIcon,
  Check,
  CircleDot,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Mock data ────────────────────────────────────────────────────────────────

interface DiscoveryCard {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  to?: string;
  color: string;
}

const DISCOVERY_CARDS: DiscoveryCard[] = [
  {
    id: 'app-pro',
    icon: Smartphone,
    title: 'App profissional',
    description: 'Sua equipe acessa a agenda direto do celular.',
    color: '#5D54C7',
  },
  {
    id: 'agendamento-online',
    icon: Globe,
    title: 'Agendamento online',
    description: 'Clientes marcam horários direto pelo seu site.',
    color: '#1D9E75',
  },
  {
    id: 'whatsapp',
    icon: MessageCircle,
    title: 'WhatsApp automático',
    description: 'Lembretes e confirmações sem você levantar um dedo.',
    color: '#25D366',
  },
  {
    id: 'pacotes',
    icon: Package,
    title: 'Pacotes',
    description: 'Combine serviços com desconto e fidelize clientes.',
    to: '/catalogo/pacotes',
    color: '#EF9F27',
  },
  {
    id: 'fidelidade',
    icon: Sparkles,
    title: 'Programa de fidelidade',
    description: 'Recompense clientes recorrentes automaticamente.',
    color: '#D85A30',
  },
];

interface ExpenseLegend {
  label: string;
  value: string;
  color: string;
}

const EXPENSE_LEGEND: ExpenseLegend[] = [
  { label: 'Fixas',    value: 'R$ 4.200,00', color: '#5D54C7' },
  { label: 'Variáveis', value: 'R$ 2.150,00', color: '#1D9E75' },
  { label: 'Pessoal',  value: 'R$ 5.690,00', color: '#EF9F27' },
  { label: 'Impostos', value: 'R$ 1.350,00', color: '#D85A30' },
  { label: 'Outras',   value: 'R$ 380,00',   color: '#888780' },
];

interface OnboardingStep {
  id: string;
  label: string;
  to: string;
  done: boolean;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  { id: 's1', label: 'Cadastrar primeiro cliente', to: '/clientes/novo',          done: true  },
  { id: 's2', label: 'Criar primeiro agendamento',  to: '/agenda',                 done: true  },
  { id: 's3', label: 'Cadastrar serviços',           to: '/catalogo/servicos',     done: true  },
  { id: 's4', label: 'Registrar horários da equipe', to: '/profissionais',         done: false },
  { id: 's5', label: 'Cadastrar logotipo',           to: '/configuracoes',         done: false },
  { id: 's6', label: 'Cadastrar fotos do salão',    to: '/configuracoes/fotos',    done: false },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateLong(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DiscoveryCarousel() {
  return (
    <section aria-label="Descubra recursos">
      <div className="flex overflow-x-auto gap-md pb-sm snap-x snap-mandatory -mx-md px-md scrollbar-thin">
        {DISCOVERY_CARDS.map((card) => {
          const Icon = card.icon;
          const inner = (
            <div
              className="snap-start shrink-0 w-[260px] rounded-lg border border-neutral-200 bg-white p-md hover:border-primary-300 transition-colors h-full"
            >
              <div
                className="h-10 w-10 rounded-md flex items-center justify-center mb-sm"
                style={{ backgroundColor: card.color + '15' }}
              >
                <Icon className="h-5 w-5" style={{ color: card.color }} />
              </div>
              <h3 className="text-sm font-semibold text-neutral-800 mb-xs">{card.title}</h3>
              <p className="text-xs text-neutral-500 leading-snug">{card.description}</p>
            </div>
          );
          return card.to ? (
            <Link key={card.id} to={card.to} className="block">
              {inner}
            </Link>
          ) : (
            <div key={card.id}>{inner}</div>
          );
        })}
      </div>
    </section>
  );
}

function PlanBanner() {
  return (
    <section
      aria-label="Status do plano"
      className="rounded-lg bg-gradient-to-r from-primary-500 to-primary-700 p-md lg:p-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md text-white"
    >
      <div className="flex items-start gap-sm min-w-0">
        <div className="h-10 w-10 rounded-md bg-white/20 flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold mb-xs">
            Seu teste grátis termina em <strong>12 dias</strong>
          </h3>
          <p className="text-sm text-white/85">
            Mais de <strong>2.500 salões</strong> já assinaram o SGS para gerenciar seu negócio.
          </p>
        </div>
      </div>
      <Button
        size="sm"
        className="bg-white text-primary-700 hover:bg-white/90 shrink-0 font-semibold"
        asChild
      >
        <Link to="/configuracoes/plano">Assine agora</Link>
      </Button>
    </section>
  );
}

interface SummaryCardProps {
  title: string;
  period: string;
  to: string;
  metrics: Array<{ label: string; value: string }>;
}

function SummaryCard({ title, period, to, metrics }: SummaryCardProps) {
  return (
    <Card className="hover:border-primary-300 transition-colors">
      <CardHeader className="pb-sm flex flex-row items-start justify-between gap-sm">
        <div>
          <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>
          <p className="text-xs text-neutral-500 mt-xs">{period}</p>
        </div>
        <Link
          to={to}
          aria-label={`Ver detalhes de ${title}`}
          className="h-8 w-8 rounded-md flex items-center justify-center text-neutral-500 hover:bg-primary-50 hover:text-primary-500 transition-colors shrink-0"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </Link>
      </CardHeader>
      <CardContent>
        <ul className="space-y-sm">
          {metrics.map((m) => (
            <li key={m.label} className="flex items-baseline justify-between gap-sm">
              <span className="text-sm text-neutral-600">{m.label}</span>
              <strong className="text-base font-semibold text-neutral-800">{m.value}</strong>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ExpensesCard() {
  const total = 'R$ 13.770,00';
  return (
    <Card>
      <CardHeader className="pb-sm">
        <h3 className="text-sm font-semibold text-neutral-800">Principais despesas</h3>
        <p className="text-xs text-neutral-500 mt-xs">Mai/2026 — Total {total}</p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-sm">
          {EXPENSE_LEGEND.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-sm">
              <div className="flex items-center gap-sm min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: row.color }}
                />
                <span className="text-sm text-neutral-700 truncate">{row.label}</span>
              </div>
              <strong className="text-sm font-semibold text-neutral-800">{row.value}</strong>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function PromotionalCard() {
  return (
    <Card className="bg-gradient-to-br from-success-50 to-white border-success-200">
      <CardContent className="p-md flex flex-col sm:flex-row items-start sm:items-center gap-md">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-neutral-800 mb-xs">
            Clube de Assinaturas
          </h3>
          <p className="text-sm text-neutral-600 mb-sm">
            Crie planos mensais para seus clientes mais fiéis e tenha receita recorrente.
          </p>
          <Button size="sm" variant="outline" className="border-success-500 text-success-600 hover:bg-success-50" asChild>
            <Link to="/clube-assinaturas">
              Saber mais <ArrowRight className="h-4 w-4 ml-xs" />
            </Link>
          </Button>
        </div>
        <div className="hidden sm:block h-20 w-20 rounded-full bg-success-100 flex items-center justify-center shrink-0">
          <Sparkles className="h-8 w-8 text-success-600" />
        </div>
      </CardContent>
    </Card>
  );
}

function OnboardingStepper() {
  const [stepIdx, setStepIdx] = useState(0);
  const visible = ONBOARDING_STEPS.slice(stepIdx, stepIdx + 3);
  const canPrev = stepIdx > 0;
  const canNext = stepIdx + 3 < ONBOARDING_STEPS.length;
  const completedCount = ONBOARDING_STEPS.filter((s) => s.done).length;

  return (
    <Card>
      <CardHeader className="pb-sm flex flex-row items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-800">Comece pelo básico</h3>
          <p className="text-xs text-neutral-500 mt-xs">
            {completedCount} de {ONBOARDING_STEPS.length} passos concluídos
          </p>
        </div>
        <div className="flex items-center gap-xs">
          <Button
            variant="ghost"
            size="icon"
            disabled={!canPrev}
            onClick={() => setStepIdx((v) => Math.max(0, v - 1))}
            aria-label="Passos anteriores"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={!canNext}
            onClick={() => setStepIdx((v) => Math.min(ONBOARDING_STEPS.length - 3, v + 1))}
            aria-label="Próximos passos"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-sm">
          {visible.map((step, i) => {
            const stepNum = stepIdx + i + 1;
            return (
              <li key={step.id}>
                <Link
                  to={step.to}
                  className={cn(
                    'block rounded-md border p-md hover:border-primary-300 transition-colors',
                    step.done
                      ? 'bg-success-50 border-success-200'
                      : 'bg-white border-neutral-200',
                  )}
                >
                  <div className="flex items-center gap-sm mb-xs">
                    {step.done ? (
                      <span className="h-6 w-6 rounded-full bg-success-500 text-white flex items-center justify-center shrink-0">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span className="h-6 w-6 rounded-full border-2 border-primary-500 text-primary-500 flex items-center justify-center text-xs font-semibold shrink-0">
                        {stepNum}
                      </span>
                    )}
                    {step.done && (
                      <CircleDot className="h-3 w-3 text-success-500" />
                    )}
                  </div>
                  <p className="text-sm text-neutral-800 leading-snug">{step.label}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function DashboardPlaceholder() {
  const roleName = useAuthStore((s) => s.roleName);
  const displayName = roleName ? roleName.charAt(0).toUpperCase() + roleName.slice(1) : 'Estabelecimento';
  const today = new Date();

  return (
    <div className="flex flex-col gap-lg max-w-6xl">
      {/* Cabeçalho contextual */}
      <header>
        <h1 className="text-2xl font-semibold text-neutral-800">Studio Beleza</h1>
        <p className="text-sm text-neutral-500 mt-xs capitalize">{formatDateLong(today)}</p>
      </header>

      {/* Carrossel de descoberta */}
      <DiscoveryCarousel />

      {/* Banner de plano */}
      <PlanBanner />

      {/* Resumo do mês — grid 2 cols */}
      <section aria-label="Resumo do mês">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
          <SummaryCard
            title="Resumo da agenda"
            period="Maio 2026"
            to="/agenda"
            metrics={[
              { label: 'Agendamentos no mês', value: '143' },
              { label: 'Comandas fechadas',  value: '127' },
              { label: 'Taxa de comparecimento', value: '92%' },
            ]}
          />
          <SummaryCard
            title="Resumo financeiro"
            period="Maio 2026"
            to="/financeiro"
            metrics={[
              { label: 'Receita',         value: 'R$ 28.450,00' },
              { label: 'Despesas',        value: 'R$ 13.770,00' },
              { label: 'Resultado',       value: 'R$ 14.680,00' },
            ]}
          />
        </div>
      </section>

      {/* Promocional + Despesas */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-md">
        <PromotionalCard />
        <ExpensesCard />
      </section>

      {/* Stepper "Comece pelo básico" */}
      <OnboardingStepper />

      {/* Olá, {displayName} */}
      <p className="text-xs text-neutral-400 text-center pt-md">
        Olá, {displayName} — bom trabalho hoje! ✨
      </p>
    </div>
  );
}
