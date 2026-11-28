/** Máscaras BR compartilhadas (data/hora). Valor/CPF/telefone: ver catalog/utils. */
export function maskTime(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export { maskDateBR, brDateToIso, isoToBrDate } from '@/lib/date-br';
