const FORMATO_LONGO = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
});

/** Data por extenso do topo: "Quinta-feira, 12 de novembro de 2026". */
export function formatLongDate(date: Date): string {
  const texto = FORMATO_LONGO.format(date);
  return texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1);
}
