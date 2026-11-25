# Phase 10: Permissões por usuário - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-24
**Phase:** 10-permiss-es-por-usu-rio
**Areas discussed:** Tirar ou dar, Tamanho do item, Quem mexe em quem, Onde fica a tela, Ao ganhar, Quando vale

---

## Tirar ou dar

| Option | Description | Selected |
|--------|-------------|----------|
| Tirar e dar | Liga ou desliga qualquer área por pessoa; o papel é só o ponto de partida | ✓ |
| Só tirar | O papel é o teto | |
| Dar com limite | Pode dar, mas algumas áreas nunca saem de Admin/Gerente | |

## Tamanho do item

| Option | Description | Selected |
|--------|-------------|----------|
| Cada submenu | Cada item do menu sozinho, com controle da área para todos de uma vez | ✓ |
| Só áreas grandes | Agenda, Clientes, Financeiro, Noivas, Comercial… | |
| Áreas + alguns itens | Áreas grandes e itens sensíveis do Financeiro/Relatórios | |

## Quem mexe em quem

| Option | Description | Selected |
|--------|-------------|----------|
| Admin tudo; Gerente abaixo | Admin intocável e ajusta todos; Gerente só Atendente/Profissional, nem a si mesmo | ✓ |
| Admin e Gerente iguais | Ambos ajustam qualquer um menos o Admin dono | |
| Só o Admin | Gerente só vê | |

## Onde fica a tela

| Option | Description | Selected |
|--------|-------------|----------|
| Perfis de acesso + atalho | Tela em Profissionais e botão "Acessos" no editar profissional; só por pessoa | ✓ |
| Por pessoa e por papel | Também muda o padrão do papel para o salão | |
| Só no editar profissional | Aba "Acessos", sem tela própria | |

## Ao ganhar

| Option | Description | Selected |
|--------|-------------|----------|
| Igual ao Gerente | Vê e mexe como o Gerente, sem o recorte "só o meu" | ✓ |
| Só ver | Ganha só consulta | |
| Continua no recorte dela | Ganha a área, mas vê só o próprio onde o papel é recortado | |

## Quando vale

| Option | Description | Selected |
|--------|-------------|----------|
| Na hora | API recusa já; menu atualiza em ~1 min ou ao trocar de tela | ✓ |
| No próximo login | Mais simples; no app instalado pode levar dias | |

## Claude's Discretion

Modelo de dados dos ajustes, itens sempre ligados, dependências entre itens, "voltar ao padrão", auditoria, troca de papel, push respeitando o item desligado.

## Deferred Ideas

Padrão do papel para o salão todo; permissão por ação dentro da tela.
