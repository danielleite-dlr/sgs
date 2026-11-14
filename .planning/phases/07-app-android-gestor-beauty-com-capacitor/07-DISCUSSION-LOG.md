# Phase 7: App Android Gestor Beauty com Capacitor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-14
**Phase:** 07-app-android-gestor-beauty-com-capacitor
**Areas discussed:** Servidor do app, Como distribuir, Notificações, Ícone/splash/acesso

---

## Antes da discussão
- Público: Equipe do salão ✓ (vs Clientes/noivas, Os dois)
- Plataforma: Só Android ✓ (vs Android e iPhone)
- Nome: Gestor Beauty ✓ (vs SGS, Studio JS)
- Sem PWA: só Capacitor e depois Expo (fala da usuária)

## Servidor do app

| Option | Description | Selected |
|--------|-------------|----------|
| sgs.jessicaseixasmakeup.com.br | Mesmo ambiente já usado pelo Studio JS | ✓ |
| Produção separada | Criar ambiente de produção antes (999.3) | |

| Option | Description | Selected |
|--------|-------------|----------|
| Carregar do servidor | Telas vêm do site; atualiza na hora | ✓ |
| Telas dentro do app | Empacotadas; cada melhoria exige nova versão | |
| Dentro do app + live update | Empacotadas com atualização automática | |

| Option | Description | Selected |
|--------|-------------|----------|
| Aviso e tentar de novo | Tela "Sem conexão" | ✓ |
| Agenda do dia offline | Guardar a última agenda | |

## Como distribuir

| Option | Description | Selected |
|--------|-------------|----------|
| Teste interno da Play | Só convidadas, sem revisão demorada | ✓ |
| Play Store pública | Exige 12 testadoras/14 dias e revisão | |
| APK direto | Sem conta, atualização manual | |

| Option | Description | Selected |
|--------|-------------|----------|
| Pessoa física (sua) | US$ 25, nome da usuária | ✓ |
| Empresa (CNPJ) | Exige D-U-N-S | |
| Ainda não sei | Pendente | |

## Notificações

- Quem recebe: A profissional + gestoras ✓ (vs Só a profissional, Só gestoras)
- Eventos: Novo agendamento ✓, Cancelamento ✓ (Remarcação e Avisos do sino não marcados)
- Autor recebe: Não ✓ (vs Sim)
- Ao tocar: Abre a agenda no dia ✓ (vs Só abre o app)
- Noivas: Uma por profissional ✓ (vs Uma por atendimento)

## Ícone, splash e acesso

- Ícone: Claude cria um provisório ✓ (vs Usuária manda o logo, Usar o favicon)
- Splash: Ícone no fundo papel ✓ (vs Fundo roxo)
- Acesso: Todos os papéis ✓ (vs Só gestoras e profissionais)

## Claude's Discretion
Versão mínima do Android, botão voltar, safe area/teclado, armazenamento da sessão, momento do pedido de permissão de notificação, local do projeto Android no monorepo, onde gerar o build, dedup/limpeza de tokens.

## Deferred Ideas
Loja pública, push de remarcação e alertas do sino, agenda offline, produção separada, iOS/Expo, logo oficial, biometria.
