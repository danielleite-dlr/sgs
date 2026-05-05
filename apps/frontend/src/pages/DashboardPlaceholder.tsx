import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/hooks/useAuth';

export function DashboardPlaceholder() {
  const { t } = useTranslation();
  const userId = useAuthStore((s) => s.userId);
  const orgId = useAuthStore((s) => s.organizationId);
  const role = useAuthStore((s) => s.roleName);
  const { logout } = useAuth();

  return (
    <main className="min-h-screen p-xl bg-background">
      <header className="flex items-center justify-between mb-xl">
        <h1 className="text-display text-neutral-800">SGS {t('dashboard.title')}</h1>
        <Button variant="outline" onClick={logout}>
          {t('navigation.logout')}
        </Button>
      </header>
      <section className="bg-neutral-0 border border-neutral-200 rounded-lg p-lg shadow-card">
        <h2 className="text-heading text-neutral-800 mb-md">
          Sessão ativa (Phase 1 placeholder)
        </h2>
        <dl className="text-body text-neutral-800 space-y-xs">
          <div>
            <dt className="text-label inline">User: </dt>
            <dd className="inline">{userId}</dd>
          </div>
          <div>
            <dt className="text-label inline">Org: </dt>
            <dd className="inline">{orgId}</dd>
          </div>
          <div>
            <dt className="text-label inline">Role: </dt>
            <dd className="inline">{role}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
