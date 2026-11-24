# Quick 261124-s3n — selo "Noiva" no card da agenda

**Pedido (24/11/2026):** o card da noiva na agenda deveria ter uma marcação dizendo que é de noiva; não tinha.

## Feito
- `ScheduleAppointment.bridalBadge` ("Noiva" | "Debutante" | null), derivado de `bridalRole === 'bride'` + `bridalEventKind`.
- `AppointmentCard`: selo roxo cheio (primary-700, texto branco) ao lado do nome, na visão Dia e Semana; convive com o selo "Teste" (claro). Aria-label e tooltip citam "noiva"/"debutante".
- Acompanhantes e atendimento social ficam sem selo.
- Teste: `agenda-selo-noiva.test.tsx` (noiva, debutante, teste da noiva, acompanhante/social).

## Observação de dados (staging)
- Serviços "Maquiagem noiva" e "Penteado noiva" já têm 90 min no catálogo, e o agendamento usa essa duração.
- Os atendimentos de noiva importados em 11/11 (14–21/11) ficaram com 60 min (padrão do script de importação).
- Pacotes Decidida, Essencial, Essence, Spa dos 15 e Ouro Rosa não têm etapas de make/penteado no cronograma.
