import logoUrl from '@/assets/marca/logo-horizontal-principal.svg';

export function Logo() {
  return (
    <div className="mb-lg flex justify-center">
      <img src={logoUrl} alt="Gestor Beauty" className="h-10 w-auto" />
    </div>
  );
}
