import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  ReceiptText,
  Ticket,
  BadgeDollarSign,
  Construction,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import {
  MOCK_KPIS,
  MOCK_REVENUE_BY_DAY,
  MOCK_PAYMENT_BREAKDOWN,
  type KpiCard,
} from '../mocks/financeiro.mock';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const KPI_ICONS = [DollarSign, ReceiptText, Ticket, BadgeDollarSign];

function TrendIcon({ trend }: { trend: KpiCard['trend'] }) {
  if (trend === 'up')      return <TrendingUp className="h-4 w-4 text-success-600" />;
  if (trend === 'down')    return <TrendingDown className="h-4 w-4 text-error-500" />;
  return <Minus className="h-4 w-4 text-neutral-400" />;
}

export function FinanceiroPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-lg">
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
        title={t('operations.financial.title', 'Financeiro')}
        cta={
          <Button variant="outline" size="sm" asChild>
            <Link to="/financeiro/comissoes">Ver comissões</Link>
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-4">
        {MOCK_KPIS.map((kpi, i) => {
          const Icon = KPI_ICONS[i];
          return (
            <Card key={kpi.label}>
              <CardHeader className="pb-sm flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-neutral-500">{kpi.label}</CardTitle>
                <div className="h-8 w-8 rounded-md bg-primary-50 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary-500" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-neutral-800">{kpi.value}</p>
                {kpi.sub && <p className="text-xs text-neutral-500 mt-xs">{kpi.sub}</p>}
                {kpi.trendPct && (
                  <div className="flex items-center gap-xs mt-sm">
                    <TrendIcon trend={kpi.trend} />
                    <span
                      className={cn(
                        'text-xs font-medium',
                        kpi.trend === 'up' ? 'text-success-600' : kpi.trend === 'down' ? 'text-error-500' : 'text-neutral-500',
                      )}
                    >
                      {kpi.trendPct}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-md lg:grid-cols-3">
        {/* Bar chart — receita por dia */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-sm">
            <CardTitle className="text-sm font-semibold text-neutral-700">
              Receita por dia — última semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={MOCK_REVENUE_BY_DAY} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E3DC" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: '#888780' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#888780' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `R$${(v / 100).toFixed(0)}`}
                />
                <RechartsTooltip
                  formatter={(value: number) =>
                    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100)
                  }
                  contentStyle={{ fontSize: 13, borderRadius: 6, border: '1px solid #E5E3DC' }}
                />
                <Bar dataKey="receita" fill="#5D54C7" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie chart — métodos de pagamento */}
        <Card>
          <CardHeader className="pb-sm">
            <CardTitle className="text-sm font-semibold text-neutral-700">
              Métodos de pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={MOCK_PAYMENT_BREAKDOWN}
                  cx="50%"
                  cy="45%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${value}%`}
                  labelLine={false}
                >
                  {MOCK_PAYMENT_BREAKDOWN.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value) => <span style={{ fontSize: 12, color: '#888780' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
