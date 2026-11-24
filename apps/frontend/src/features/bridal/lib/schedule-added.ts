// "Agendar agora" depois de incluir serviço do evento numa pessoa do grupo (quick 261124-mkp).

/** Serviços do evento acrescentados agora (não estavam salvos antes), na ordem da lista. */
export function newEventServiceIds(
  before: { serviceId: string; purpose: string }[],
  after: { serviceId: string; purpose: string }[],
): string[] {
  const left = before.filter((b) => b.purpose === 'event').map((b) => b.serviceId);
  const out: string[] = [];
  for (const a of after) {
    if (a.purpose !== 'event') continue;
    const i = left.indexOf(a.serviceId);
    if (i >= 0) left.splice(i, 1);
    else out.push(a.serviceId);
  }
  return out;
}

/** Link da agenda no dia do evento com o novo agendamento aberto e preenchido (261124-mkp). */
export function agendaNewVisitHref(
  eventDate: string,
  clientId: string,
  clientName: string,
  serviceIds: string[],
): string {
  const p = new URLSearchParams({
    data: eventDate.slice(0, 10),
    visao: 'day',
    novo: '1',
    cliente: clientId,
    nome: clientName,
    servicos: serviceIds.join(','),
  });
  return `/agenda?${p.toString()}`;
}
