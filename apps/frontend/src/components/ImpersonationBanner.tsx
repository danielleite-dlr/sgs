import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '@/infrastructure/stores/auth.store';

/**
 * ImpersonationBanner — deixa explícito que o admin está dentro do salão de um
 * cliente, e dá o caminho de volta.
 *
 * Sem isso é fácil esquecer de onde se está e mexer em dado de cliente achando
 * que é o próprio. O retorno limpa o token do salão e manda para o login, que é
 * onde a sessão de plataforma se restabelece.
 */
export function ImpersonationBanner() {
  const impersonating = useAuthStore((s) => s.impersonating);
  const organizationName = useAuthStore((s) => s.organizationName);
  const clearSession = useAuthStore((s) => s.clearSession);
  const navigate = useNavigate();

  if (!impersonating) return null;

  return (
    <div className="flex items-center justify-between gap-4 bg-amber-100 px-4 py-2 text-sm text-amber-900">
      <span>
        Você está dentro do salão <strong>{organizationName}</strong> como
        administrador da plataforma.
      </span>
      <button
        type="button"
        className="inline-flex items-center gap-1 font-medium underline"
        onClick={() => {
          clearSession();
          navigate('/login', { replace: true });
        }}
      >
        <LogOut size={14} aria-hidden="true" />
        Sair do salão
      </button>
    </div>
  );
}
