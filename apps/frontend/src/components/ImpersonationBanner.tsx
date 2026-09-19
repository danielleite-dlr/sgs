import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { useAuth } from '@/features/auth/hooks/useAuth';

/**
 * ImpersonationBanner — deixa explícito que o admin está dentro do salão de um
 * cliente, e dá o caminho de volta.
 *
 * Sem isso é fácil esquecer de onde se está e mexer em dado de cliente achando
 * que é o próprio. Sair devolve a sessão de plataforma guardada, sem passar
 * pelo login de novo.
 */
export function ImpersonationBanner() {
  const impersonating = useAuthStore((s) => s.impersonating);
  const organizationName = useAuthStore((s) => s.organizationName);
  const { exitClient } = useAuth();
  const [leaving, setLeaving] = useState(false);

  if (!impersonating) return null;

  return (
    <div className="flex items-center justify-between gap-4 bg-amber-100 px-4 py-2 text-sm text-amber-900">
      <span>
        Você está dentro do salão <strong>{organizationName}</strong> como
        administrador da plataforma.
      </span>
      <button
        type="button"
        className="inline-flex items-center gap-1 font-medium underline disabled:opacity-60"
        disabled={leaving}
        onClick={() => {
          setLeaving(true);
          void exitClient().finally(() => setLeaving(false));
        }}
      >
        <LogOut size={14} aria-hidden="true" />
        {leaving ? 'Voltando…' : 'Voltar ao painel'}
      </button>
    </div>
  );
}
