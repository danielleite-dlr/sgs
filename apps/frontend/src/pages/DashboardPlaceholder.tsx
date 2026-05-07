import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Globe,
  MessageCircle,
  Package,
  PackageOpen,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
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
    description: 'Acompanhe os atendimentos e comissões direto do celular',
    color: '#5D54C7',
  },
  {
    id: 'agendamento-online',
    icon: Globe,
    title: 'Agendamento online',
    description: 'Receba agendamentos pelo site, redes sociais ou Google Reserve',
    color: '#1D9E75',
  },
  {
    id: 'whatsapp',
    icon: MessageCircle,
    title: 'Whatsapp automático',
    description: 'Automatize confirmações, lembretes e pedidos de avaliação',
    color: '#25D366',
  },
  {
    id: 'pacotes',
    icon: Package,
    title: 'Pacotes',
    description: 'Crie pacotes de serviços pra manter clientes sempre voltando',
    to: '/catalogo/pacotes',
    color: '#EF9F27',
  },
  {
    id: 'estoque',
    icon: PackageOpen,
    title: 'Estoque',
    description: 'Controle o que entra e sai e mantenha seus produtos em dia',
    to: '/catalogo/produtos',
    color: '#D85A30',
  },
];

interface ExpenseLegend {
  label: string;
  value: string;
  color: string;
}

const EXPENSE_LEGEND: ExpenseLegend[] = [
  { label: 'Fixas',    value: 'R$ 0,00', color: '#EF9F27' },
  { label: 'Variáveis', value: 'R$ 0,00', color: '#888780' },
  { label: 'Pessoal',  value: 'R$ 0,00', color: '#D85A30' },
  { label: 'Impostos', value: 'R$ 0,00', color: '#5D54C7' },
  { label: 'Outros',   value: 'R$ 0,00', color: '#2C2C2A' },
];

interface OnboardingStep {
  id: string;
  label: string;
  to: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  { id: 's1', label: 'Cadastrar cliente',    to: '/clientes/novo' },
  { id: 's2', label: 'Criar agendamento',    to: '/agenda' },
  { id: 's3', label: 'Cadastrar serviço',    to: '/catalogo/servicos' },
  { id: 's4', label: 'Registrar horários',   to: '/profissionais' },
  { id: 's5', label: 'Cadastrar logotipo',   to: '/configuracoes' },
  { id: 's6', label: 'Cadastrar fotos',      to: '/configuracoes/fotos' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateLong(date: Date): string {
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  const year = date.getFullYear();
  // Capitalize first letter of weekday and month
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return `${cap(weekday)}, ${day} de ${cap(month)} ${year}`;
}

function shortRange(): string {
  // "01/05 até 07/05"
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${fmt(start)} até ${fmt(today)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DiscoveryCarousel() {
  const [idx, setIdx] = useState(0);
  const visibleCount = 5;
  const maxIdx = Math.max(0, DISCOVERY_CARDS.length - visibleCount);

  return (
    <section aria-label="Descubra recursos">
      <div className="flex overflow-x-auto gap-md pb-sm scrollbar-thin">
        {DISCOVERY_CARDS.slice(idx, idx + visibleCount).map((card) => {
          const Icon = card.icon;
          const inner = (
            <div className="flex flex-col rounded-lg border border-neutral-200 bg-white p-md hover:border-primary-300 transition-colors h-full min-h-[180px]">
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center mb-md"
                style={{ backgroundColor: card.color + '15' }}
              >
                <Icon className="h-5 w-5" style={{ color: card.color }} />
              </div>
              <h3 className="text-sm font-semibold text-neutral-800 mb-xs">{card.title}</h3>
              <p className="text-xs text-neutral-500 leading-relaxed flex-1">{card.description}</p>
              <div className="mt-md">
                <span className="text-xs font-semibold text-primary-500 inline-flex items-center gap-xs">
                  Acessar <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          );
          return (
            <div key={card.id} className="snap-start shrink-0 w-[220px]">
              {card.to ? (
                <Link to={card.to} className="block h-full">
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </div>
          );
        })}
      </div>
      {DISCOVERY_CARDS.length > visibleCount && (
        <div className="flex justify-end gap-xs mt-sm">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIdx((v) => Math.max(0, v - 1))}
            disabled={idx === 0}
            aria-label="Anterior"
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIdx((v) => Math.min(maxIdx, v + 1))}
            disabled={idx >= maxIdx}
            aria-label="Próximo"
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </section>
  );
}

function PlanBanner() {
  return (
    <section
      aria-label="Status do plano"
      className="rounded-lg bg-white border border-neutral-200 p-md lg:p-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md"
    >
      <div className="flex items-start gap-md min-w-0">
        {/* Decorative dots */}
        <div className="flex shrink-0 items-center -space-x-1.5">
          <span className="h-6 w-6 rounded-full bg-warning-500" />
          <span className="h-6 w-6 rounded-full bg-error-500" />
          <span className="h-6 w-6 rounded-full bg-neutral-200" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-bold text-neutral-800">
            Seu teste grátis termina em 5 dias
          </h3>
          <p className="text-sm text-neutral-500 mt-xs">
            Junte-se a mais de <strong className="font-bold text-neutral-800">10.000</strong>{' '}
            empreendedores que já organizam seus negócios com o SGS
          </p>
        </div>
      </div>
      <Button
        size="sm"
        className="bg-success-500 hover:bg-success-700 text-white shrink-0 font-semibold"
        asChild
      >
        <Link to="/configuracoes/plano">Assinar agora</Link>
      </Button>
    </section>
  );
}

interface SummaryMetric {
  label: string;
  value: string;
}

interface SummaryCardProps {
  title: string;
  period: string;
  to: string;
  metrics: SummaryMetric[];
}

function SummaryCard({ title, period, to, metrics }: SummaryCardProps) {
  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-md flex flex-col gap-md">
      <header className="flex items-start justify-between gap-sm">
        <div>
          <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>
          <p className="text-xs text-neutral-500 mt-xs">{period}</p>
        </div>
        <Link
          to={to}
          aria-label={`Ver detalhes de ${title}`}
          className="h-8 w-8 rounded-md border border-neutral-200 flex items-center justify-center text-neutral-500 hover:bg-primary-50 hover:text-primary-500 hover:border-primary-300 transition-colors shrink-0"
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
      </header>
      <div className={cn('grid gap-sm', metrics.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-md bg-neutral-50 px-sm py-md flex flex-col items-center text-center"
          >
            <span className="text-xs text-neutral-500 mb-xs">{m.label}</span>
            <strong className="text-base font-bold text-neutral-800">{m.value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function ExpensesCard() {
  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-md flex flex-col gap-md">
      <header className="flex items-start justify-between gap-sm">
        <div>
          <h3 className="text-sm font-semibold text-neutral-800">Principais despesas</h3>
          <p className="text-xs text-neutral-500 mt-xs">{shortRange()}</p>
        </div>
        <Link
          to="/financeiro"
          aria-label="Ver detalhes de despesas"
          className="h-8 w-8 rounded-md border border-neutral-200 flex items-center justify-center text-neutral-500 hover:bg-primary-50 hover:text-primary-500 hover:border-primary-300 transition-colors shrink-0"
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
      </header>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-md gap-y-sm">
        {EXPENSE_LEGEND.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-sm">
            <div className="flex items-center gap-sm min-w-0">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: row.color }}
              />
              <span className="text-sm text-neutral-700 truncate">{row.label}</span>
            </div>
            <strong className="text-sm font-semibold text-neutral-800">{row.value}</strong>
          </li>
        ))}
      </ul>
    </article>
  );
}

function ClubeAssinaturas() {
  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-md flex flex-col sm:flex-row items-start gap-md">
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-neutral-800 mb-xs">Clube de assinaturas</h3>
        <p className="text-xs text-neutral-500 leading-relaxed mb-md">
          Aumente o faturamento e mantenha seus clientes por perto com assinaturas de serviços e
          produtos.
        </p>
        <Button
          size="sm"
          className="bg-success-500 hover:bg-success-700 text-white font-semibold"
          asChild
        >
          <Link to="/clube-assinaturas">Adicionar ao plano</Link>
        </Button>
      </div>
      <div className="hidden sm:flex h-32 w-40 rounded-md bg-gradient-to-br from-warning-50 to-neutral-100 items-center justify-center shrink-0">
        <Sparkles className="h-12 w-12 text-warning-500" />
      </div>
    </article>
  );
}

function PrimeirosPassos() {
  const [idx, setIdx] = useState(0);
  const visible = 3;
  const maxIdx = Math.max(0, ONBOARDING_STEPS.length - visible);
  const slice = ONBOARDING_STEPS.slice(idx, idx + visible);

  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-md">
      <header className="flex items-center justify-between mb-md">
        <h3 className="text-sm font-semibold text-neutral-800">Primeiros passos</h3>
        <div className="flex items-center gap-xs">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIdx((v) => Math.max(0, v - 1))}
            disabled={idx === 0}
            aria-label="Passos anteriores"
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIdx((v) => Math.min(maxIdx, v + 1))}
            disabled={idx >= maxIdx}
            aria-label="Próximos passos"
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <ul className="space-y-sm">
        {slice.map((step, i) => {
          const stepNum = idx + i + 1;
          return (
            <li key={step.id}>
              <Link
                to={step.to}
                className="flex items-center gap-md rounded-md border border-neutral-200 bg-white px-md py-sm hover:border-primary-300 hover:bg-primary-50/30 transition-colors"
              >
                <span className="text-base font-bold text-neutral-800 shrink-0 w-5">
                  {stepNum}
                </span>
                <span className="text-sm text-neutral-700 flex-1">{step.label}</span>
                <ArrowRight className="h-4 w-4 text-neutral-400 shrink-0" />
              </Link>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function HomeFooter() {
  return (
    <footer className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md pt-lg pb-md text-xs text-neutral-500 border-t border-neutral-200 mt-lg">
      <nav className="flex flex-wrap items-center gap-x-md gap-y-xs" aria-label="Links institucionais">
        <a className="hover:text-primary-500 transition-colors" href="#">Meu site</a>
        <span className="text-neutral-300">|</span>
        <a className="hover:text-primary-500 transition-colors" href="#">SGS Ajuda</a>
        <span className="text-neutral-300">|</span>
        <a className="hover:text-primary-500 transition-colors" href="#">Blog</a>
        <span className="text-neutral-300">|</span>
        <a className="hover:text-primary-500 transition-colors" href="#">Fale conosco</a>
        <span className="text-neutral-300">|</span>
        <a className="hover:text-primary-500 transition-colors" href="#">Contato</a>
      </nav>
      <div className="flex items-center gap-sm">
        {[
          { label: 'Facebook', icon: 'F' },
          { label: 'Instagram', icon: 'IG' },
          { label: 'YouTube', icon: 'YT' },
        ].map((s) => (
          <span
            key={s.label}
            aria-label={s.label}
            className="h-7 w-7 rounded-full border border-neutral-300 flex items-center justify-center text-[10px] text-neutral-500 hover:border-primary-300 hover:text-primary-500 transition-colors"
          >
            {s.icon}
          </span>
        ))}
      </div>
    </footer>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function DashboardPlaceholder() {
  const today = new Date();

  return (
    <div className="flex flex-col gap-lg max-w-6xl">
      {/* Cabeçalho contextual */}
      <header>
        <h1 className="text-2xl font-bold text-neutral-800">Studio Beleza LTDA</h1>
        <p className="text-sm text-neutral-500 mt-xs">{formatDateLong(today)}</p>
      </header>

      {/* Carrossel descoberta */}
      <DiscoveryCarousel />

      {/* Banner plano */}
      <PlanBanner />

      {/* Resumo do mês */}
      <section aria-label="Resumo do mês">
        <h2 className="text-base font-semibold text-neutral-800 mb-md">Resumo do mês</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
          <SummaryCard
            title="Resumo da agenda"
            period={shortRange()}
            to="/agenda"
            metrics={[
              { label: 'Agendamentos',  value: '0' },
              { label: 'Contas fechadas', value: '0' },
            ]}
          />
          <SummaryCard
            title="Resumo financeiro"
            period={shortRange()}
            to="/financeiro"
            metrics={[
              { label: 'Receita',   value: 'R$ 0,00' },
              { label: 'Despesas',  value: 'R$ 0,00' },
              { label: 'Resultado', value: 'R$ 0,00' },
            ]}
          />
        </div>
      </section>

      {/* Clube + Despesas */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-md">
        <ClubeAssinaturas />
        <ExpensesCard />
      </section>

      {/* Comece pelo básico */}
      <section aria-label="Comece pelo básico">
        <h2 className="text-base font-semibold text-neutral-800 mb-md">Comece pelo básico</h2>
        <PrimeirosPassos />
      </section>

      {/* Footer */}
      <HomeFooter />
    </div>
  );
}
