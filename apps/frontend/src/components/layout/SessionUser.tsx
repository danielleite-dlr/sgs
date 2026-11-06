import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { personInitials } from '@/lib/brand';
import { toDisplayName } from '@/lib/format-name';

/**
 * Avatar, nome e papel da usuária logada (rodapé do menu lateral e da gaveta, D-15).
 * Sessão salva antes de existir `fullName`: só o papel aparece, na linha principal.
 */
export function SessionUser() {
  const { t } = useTranslation();
  const roleName = useAuthStore((s) => s.roleName);
  const fullName = useAuthStore((s) => s.fullName);
  const nome = toDisplayName(fullName);
  const papel = roleName ? t(`team.roles.${roleName}`, { defaultValue: roleName }) : '—';
  const iniciais = personInitials(nome) || papel.charAt(0).toLocaleUpperCase('pt-BR');

  return (
    <div className="flex min-w-0 items-center gap-sm">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-label text-primary-700"
      >
        {iniciais}
      </span>
      <div className="min-w-0">
        <p className="truncate text-body font-semibold text-neutral-800">{nome || papel}</p>
        {nome && <p className="truncate text-[12px] leading-4 text-neutral-500">{papel}</p>}
      </div>
    </div>
  );
}
