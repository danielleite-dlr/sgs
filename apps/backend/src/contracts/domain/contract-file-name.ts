/** Nome do PDF: {NOIVA|DEBUTANTE}_{NOME}_{DD-MM-AAAA}_{PACOTE}.pdf (A-Z0-9_, sem acento). */

function slug(s: string | null | undefined, fallback: string): string {
  const cleaned = (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return cleaned.length > 0 ? cleaned : fallback;
}

export function contractFileName(
  kind: 'noiva' | 'debutante',
  personName: string,
  eventDate: string,
  packageName: string | null,
): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(eventDate);
  const date = m ? `${m[3]}-${m[2]}-${m[1]}` : slug(eventDate, 'SEM_DATA');
  return `${kind === 'noiva' ? 'NOIVA' : 'DEBUTANTE'}_${slug(personName, 'SEM_NOME')}_${date}_${slug(packageName, 'SEM_PACOTE')}.pdf`;
}
