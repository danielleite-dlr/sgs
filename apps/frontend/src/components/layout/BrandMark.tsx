import { brandInitials } from '@/lib/brand';

/** Quadrado roxo com a sigla do estúdio (menu lateral, topo do celular e gaveta). */
export function BrandMark({ organizationName }: { organizationName: string | null }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary font-serif text-[15px] font-semibold text-white"
    >
      {brandInitials(organizationName)}
    </span>
  );
}
