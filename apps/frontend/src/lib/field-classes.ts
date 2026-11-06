// Classes de campo compartilhadas do layout Gestor Beauty (fase 6, D-10, D-13, D-14).
// Ficam fora dos .tsx de componente por causa da regra react-refresh/only-export-components.

// Select nativo (<select>) com o mesmo visual do Input: 44 px, raio 6 px, borda #E2DFE5 e
// foco por borda roxa de 1,5 px, sem halo.
export const NATIVE_SELECT_CLASS =
  'flex h-11 min-h-[44px] w-full rounded-md border border-neutral-200 bg-white px-[14px] text-body text-neutral-800 focus-visible:outline-none focus-visible:border-primary-500 focus-visible:shadow-[inset_0_0_0_0.5px_#570080] disabled:cursor-not-allowed disabled:opacity-50';

// Rótulo curto de campo em maiúsculas pequenas (D-13). Nunca usar em nome de pessoa.
export const FIELD_LABEL_CLASS = 'text-overline uppercase text-neutral-500';
