import simboloUrl from '@/assets/marca/simbolo-principal.svg';

/** Símbolo da marca Gestor Beauty (menu recolhido, topo do celular e gaveta). */
export function BrandMark() {
  return (
    <img
      src={simboloUrl}
      alt=""
      aria-hidden="true"
      data-testid="brand-symbol"
      className="h-8 w-8 shrink-0"
    />
  );
}
