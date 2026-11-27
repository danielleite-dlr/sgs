# Phase 12: Ajustar cadastro de agendamento - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-27
**Phase:** 12-ajustar-cadastro-de-agendamento
**Areas discussed:** Cliente, Serviços e horários, Profissional, Sinal/pacote/observações (marcadas); pedidos concretos só em pacote, data e sequência

---

## Pedido livre do usuário

"O pacote deve ser apresentado logo na parte de cima do modal, não somente no final. No campo data não está vindo a parte do calendário para abertura do calendário e seleção. Embora coloque o horário, se selecionado um pacote os serviços não podem estar no mesmo horário; algum deve ir para a sequência do outro, podendo o atendente editar na hora ou posteriormente."

## Posição do pacote

| Option | Description | Selected |
|--------|-------------|----------|
| Logo após cliente e data | Cliente → Data → Pacote → Serviços | |
| Primeiro campo do modal | Pacote antes de tudo | |
| Other | "Há pacotes para clientes sociais e o mesmo deve aparecer ao lado do select de serviço, ou seleciona um ou outro" | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Em cada linha | Serviço \| Pacote por linha; pacote expande em sequência a partir da linha | ✓ |
| Só na primeira linha | Pacote troca todas as linhas | |
| Um único select misturado | Serviços e pacotes no mesmo select | |

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, como já é | Sociais sempre; noiva/debutante só no contrato | ✓ |
| Todos para qualquer cliente | Sem filtro | |

| Option | Description | Selected |
|--------|-------------|----------|
| Um pacote por agendamento | Pacote + avulsos; sem mudança no backend | ✓ |
| Vários pacotes | Backend e comanda com vários pacotes | |

## Sequência

| Option | Description | Selected |
|--------|-------------|----------|
| Os seguintes se ajustam | Cascata ao editar | |
| Só monta a sequência ao escolher | Depois cada horário é manual | ✓ |

## Calendário

| Option | Description | Selected |
|--------|-------------|----------|
| Ícone que abre um calendário | Digita ou clica no dia; visual Gestor Beauty | ✓ |
| Calendário nativo do aparelho | input type=date | |

## Claude's Discretion

- Forma do seletor Serviço | Pacote; marcação das linhas do pacote; biblioteca do calendário.

## Deferred Ideas

- Vários pacotes por agendamento; cascata de horários.
