import { PageHeader } from '@/components/layout/PageHeader';
import { ForecastCard } from '@/features/operations/components/ForecastCard';

export default function DashboardPage() {
  return (
    <div className="p-md">
      <PageHeader title="Início" />
      <div className="grid gap-4 lg:grid-cols-2">
        <ForecastCard />
      </div>
    </div>
  );
}
