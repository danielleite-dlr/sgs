function capitalizar(palavra: string): string {
  const minuscula = palavra.toLocaleLowerCase("pt-BR");
  return minuscula.charAt(0).toLocaleUpperCase("pt-BR") + minuscula.slice(1);
}

/**
 * Nome curto do profissional para avatares no celular (UX-02):
 * primeiro nome + inicial do segundo com ponto, em caixa normal.
 * "Maria Aparecida Silva" -> "Maria A."; vazio -> "?".
 */
export function shortProfessionalName(full: string): string {
  const partes = full.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeiro = capitalizar(partes[0]);
  if (partes.length === 1) return primeiro;
  const inicial = partes[1].charAt(0).toLocaleUpperCase("pt-BR");
  return `${primeiro} ${inicial}.`;
}
