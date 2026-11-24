# Quick 261124-mkp — agendamento pela agenda entra no grupo + "Agendar agora"

**Pedido (24/11/2026):** madrinha Maria Edileide tinha só penteado; incluíram maquiagem e agendaram pela agenda. O filtro da noiva não trazia a make (agendamento ficou sem `bridal_group_id`). Esperado: ir sozinho ou perguntar se já insere na agenda.

## Feito
- Backend `createVisit`/`createAppointment`: sem grupo e sem pacote, se a cliente é de **um** grupo ativo com evento no dia do atendimento, entra no grupo como `event`, com cobertura do contrato quando coberta; recalcula bloqueios de deslocamento. Fora do dia, segue social (`bridal/bridal-autolink.ts`).
- Grupo da noiva: salvar serviço novo do evento numa pessoa abre "Agendar agora?"; "Abrir na agenda" leva a `/agenda?data=<evento>&novo=1&cliente=..&nome=..&servicos=..`.
- Agenda lê o link e abre o novo agendamento com a cliente e os serviços (duração padrão do catálogo).
- Testes: integração `quick-261124-mkp-autolink.e2e.spec.ts`; vitest `agendar-servico-adicionado.test.tsx` e `visit-form-prefill.test.tsx`.

## Dados (staging)
- Make da Maria Edileide (20/11) ligada ao grupo "Noiva Evillyn Assis" via SQL; nenhum outro caso igual.
- Noivas 14–21/11: 15 atendimentos esticados para 90 min (Karolina e Ester: penteado empurrado 30 min). Ficaram em 60 min os makes de 14/11 de Camilla, Sheyla e Nathá (profissional com cliente logo depois). Backup em `/root/sgs-backups/`.
