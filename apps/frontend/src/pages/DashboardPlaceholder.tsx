import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import {
  CalendarDays,
  DollarSign,
  FileText,
  PackageOpen,
  Cake,
  Wallet,
  ScrollText,
  MessageCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Construction,
  Clock,
  Link as LinkIcon,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

// ─── Mock data ────────────────────────────────────────────────────────────────

interface KpiDef {
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  icon: React.ElementType;
  link?: string;
}

const MOCK_KPIS: KpiDef[] = [
  {
    label: 'Agendamentos hoje',
    value: '24',
    sub: 'confirmados',
    trend: 'up',
    trendLabel: '+3 vs ontem',
    icon: CalendarDays,
  },
  {
    label: 'Receita do dia',
    value: 'R$ 1.450',
    sub: 'em comandas fechadas',
    trend: 'up',
    trendLabel: '+12% vs ontem',
    icon: DollarSign,
  },
  {
    label: 'Comandas abertas',
    value: '5',
    sub: 'em atendimento',
    trend: 'neutral',
    icon: FileText,
  },
  {
    label: 'Estoque baixo',
    value: '2 produtos',
    sub: 'abaixo do mínimo',
    trend: 'down',
    trendLabel: 'Ver produtos',
    icon: PackageOpen,
    link: '/catalogo/produtos',
  },
  {
    label: 'Aniversariantes do mês',
    value: '18 clientes',
    sub: 'neste mês',
    trend: 'neutral',
    icon: Cake,
  },
  {
    label: 'Comissões a pagar',
    value: 'R$ 5.690',
    sub: 'pendentes — maio 2026',
    trend: 'neutral',
    icon: Wallet,
  },
  {
    label: 'Contratos vencendo (7d)',
    value: '3',
    sub: 'próximos 7 dias',
    trend: 'down',
    trendLabel: 'Requer atenção',
    icon: ScrollText,
  },
  {
    label: 'Mensagens WhatsApp',
    value: '24',
    sub: 'enviadas hoje',
    trend: 'up',
    trendLabel: '+6 vs ontem',
    icon: MessageCircle,
  },
];

// 30-day forecast data (mock)
interface ForecastPoint {
  day: string;
  projetado: number;
  historico: number | null;
}

function buildForecastData(): ForecastPoint[] {
  const points: ForecastPoint[] = [];
  const base = 3500;
  // Days 1-7: past (historico filled)
  const pastLabels = ['28/04', '29/04', '30/04', '01/05', '02/05', '03/05', '04/05'];
  const pastValues = [3200, 4850, 3900, 5100, 6200, 7800, 1400];
  pastLabels.forEach((d, i) => {
    points.push({ day: d, historico: pastValues[i], projetado: pastValues[i] });
  });
  // Days 8-30: future (historico null, projetado generated)
  for (let i = 8; i <= 30; i++) {
    const date = new Date(2026, 4, i); // May 2026
    const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    // Weekend lower, slight upward trend
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const noise = Math.sin(i * 0.7) * 800 + Math.cos(i * 1.3) * 400;
    const projected = Math.round((isWeekend ? base * 0.4 : base + i * 80) + noise);
    points.push({ day, historico: null, projetado: Math.max(projected, 800) });
  }
  return points;
}

const MOCK_FORECAST = buildForecastData();

interface ActivityEntry {
  id: string;
  text: string;
  time: string;
  icon: React.ElementType;
  color: string;
}

const MOCK_ACTIVITIES: ActivityEntry[] = [
  {
    id: 'a1',
    text: 'Comanda de Maria Silva fechada — R$ 320,00',
    time: 'há 5 min',
    icon: FileText,
    color: 'text-success-600',
  },
  {
    id: 'a2',
    text: 'Novo agendamento: João Pereira — Corte 14h',
    time: 'há 18 min',
    icon: CalendarDays,
    color: 'text-primary-500',
  },
  {
    id: 'a3',
    text: 'Mensagem de aniversário enviada para 3 clientes',
    time: 'há 32 min',
    icon: MessageCircle,
    color: 'text-primary-500',
  },
  {
    id: 'a4',
    text: 'Estoque de Shampoo Hidratação Intensa ficou abaixo do mínimo',
    time: 'há 1h',
    icon: PackageOpen,
    color: 'text-warning-600',
  },
  {
    id: 'a5',
    text: 'Comanda de Carla Mendes fechada — R$ 180,00',
    time: 'há 1h 15 min',
    icon: FileText,
    color: 'text-success-600',
  },
  {
    id: 'a6',
    text: 'Novo cliente cadastrado: Beatriz Alves',
    time: 'há 2h',
    icon: CalendarDays,
    color: 'text-primary-500',
  },
  {
    id: 'a7',
    text: 'Contrato de grupo Casamento Silva vence em 5 dias',
    time: 'há 3h',
    icon: ScrollText,
    color: 'text-error-500',
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function TrendIcon({ trend }: { trend: KpiDef['trend'] }) {
  if (trend === 'up')   return <TrendingUp className="h-3.5 w-3.5 text-success-600" />;
  if (trend === 'down') return <TrendingDown className="h-3.5 w-3.5 text-error-500" />;
  return <Minus className="h-3.5 w-3.5 text-neutral-400" />;
}

function KpiCard({ kpi }: { kpi: KpiDef }) {
  const Icon = kpi.icon;
  const trendColors: Record<NonNullable<KpiDef['trend']>, string> = {
    up:      'text-success-600',
    down:    'text-error-500',
    neutral: 'text-neutral-500',
  };
  const content = (
    <Card className={cn(kpi.link && 'hover:border-primary-300 transition-colors')}>
      <CardHeader className="pb-sm flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-neutral-500">{kpi.label}</CardTitle>
        <div className="h-8 w-8 rounded-md bg-primary-50 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary-500" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold text-neutral-800">{kpi.value}</p>
        {kpi.sub && <p className="text-xs text-neutral-500 mt-xs">{kpi.sub}</p>}
        {kpi.trendLabel && (
          <div className="flex items-center gap-xs mt-sm">
            <TrendIcon trend={kpi.trend} />
            <span className={cn('text-xs font-medium', trendColors[kpi.trend ?? 'neutral'])}>
              {kpi.trendLabel}
            </span>
            {kpi.link && <LinkIcon className="h-3 w-3 text-neutral-400 ml-xs" />}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (kpi.link) {
    return <Link to={kpi.link} className="block">{content}</Link>;
  }
  return content;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function DashboardPlaceholder() {
  const { t } = useTranslation();
  const roleName = useAuthStore((s) => s.roleName);

  // Use role as a stand-in for the user's name until profile data is available
  const displayName = roleName ? roleName.charAt(0).toUpperCase() + roleName.slice(1) : 'usuário';

  return (
    <div className="flex flex-col gap-lg">
      {/* Mockup indicator — subtle for the home page */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-800">
            {t('dashboard.welcome', { name: displayName })}
          </h1>
          <p className="text-sm text-neutral-500 mt-xs">
            Aqui está o resumo do seu salão hoje.
          </p>
        </div>
        <Badge
          variant="outline"
          className="gap-xs border-warning-500 text-warning-600 bg-warning-50 text-xs shrink-0"
        >
          <Construction className="h-3 w-3" />
          Mockup — Phase 5
        </Badge>
      </div>

      {/* KPI grid — 2 cols mobile, 4 cols desktop */}
      <div className="grid grid-cols-2 gap-md xl:grid-cols-4">
        {MOCK_KPIS.map((kpi) => (
          <KpiCard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      {/* Forecast chart + Activity feed */}
      <div className="grid grid-cols-1 gap-md lg:grid-cols-3">
        {/* FIN-03 — 30-day revenue forecast */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-sm">
            <CardTitle className="text-sm font-semibold text-neutral-700">
              Previsão financeira — próximos 30 dias
            </CardTitle>
            <p className="text-xs text-neutral-500 mt-xs">
              Baseado em histórico + agendamentos confirmados
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart
                data={MOCK_FORECAST}
                margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E3DC" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: '#888780' }}
                  axisLine={false}
                  tickLine={false}
                  interval={4}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#888780' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `R$${(v / 100).toFixed(0)}`}
                />
                <RechartsTooltip
                  formatter={(value: number, name: string) => [
                    new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(value / 100),
                    name === 'projetado' ? 'Projetado' : 'Histórico',
                  ]}
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #E5E3DC' }}
                />
                <Line
                  type="monotone"
                  dataKey="historico"
                  stroke="#5D54C7"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  name="historico"
                />
                <Line
                  type="monotone"
                  dataKey="projetado"
                  stroke="#5D54C7"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                  name="projetado"
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-md mt-sm text-xs text-neutral-500">
              <span className="flex items-center gap-xs">
                <span className="inline-block h-px w-6 bg-primary-500 rounded" />
                Histórico
              </span>
              <span className="flex items-center gap-xs">
                <span
                  className="inline-block h-px w-6 rounded"
                  style={{ background: 'repeating-linear-gradient(to right, #5D54C7 0, #5D54C7 5px, transparent 5px, transparent 8px)' }}
                />
                Projetado
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Activity feed */}
        <Card>
          <CardHeader className="pb-sm">
            <CardTitle className="text-sm font-semibold text-neutral-700">
              Últimas atividades
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-neutral-100">
              {MOCK_ACTIVITIES.map((entry) => {
                const EntryIcon = entry.icon;
                return (
                  <li key={entry.id} className="flex items-start gap-sm px-md py-sm">
                    <div className="mt-0.5 h-7 w-7 rounded-md bg-neutral-50 border border-neutral-100 flex items-center justify-center shrink-0">
                      <EntryIcon className={cn('h-3.5 w-3.5', entry.color)} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-neutral-700 leading-snug">{entry.text}</p>
                      <p className="text-xs text-neutral-400 flex items-center gap-xs mt-xs">
                        <Clock className="h-3 w-3" />
                        {entry.time}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
