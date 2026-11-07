import { PageHeader } from '@/components/layout/PageHeader';
import { ForecastCard } from '@/features/operations/components/ForecastCard';
import { formatLongDate } from '@/lib/format-date-long';

// Início no layout Gestor Beauty (06-10). O AppShell já dá o respiro da página; o painel
// mostra só o que o SGS tem hoje: a previsão de caixa de 30 dias (D-02, UX-20 no backlog).
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-md">
      <PageHeader
        eyebrow="Painel do dia"
        title="Início"
        description={formatLongDate(new Date())}
        variant="display"
      />
      <ForecastCard />
    </div>
  );
}
