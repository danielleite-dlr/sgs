# Diretriz de Produto — Plataforma Modular por Nichos

**Data:** 2026-09-27  
**Status:** Diretriz aprovada

## Visão

O SGS será uma plataforma SaaS modular e verticalizada. No onboarding, o cliente escolhe o nicho do negócio e recebe um ambiente pré-configurado com os módulos, fluxos e campos mais adequados à sua operação.

O cliente poderá ativar novos módulos posteriormente, sem precisar trocar de plano, sistema ou organização.

> O SGS se adapta ao negócio: o cliente escolhe o nicho, começa com os módulos certos e adiciona novas capacidades conforme cresce.

## Nichos iniciais

O lançamento deve começar com três templates:

1. **Estúdio de noivas** — template principal e laboratório do produto.
2. **Salão de beleza**.
3. **Profissional autônomo**.

Nichos futuros podem incluir barbearia, clínica de estética, nail designer, maquiadora, spa e tattoo/piercing. Eles não devem bloquear a arquitetura inicial.

## Templates iniciais

### Estúdio de noivas

- Clientes e grupos de noivas
- Agenda e serviços
- Pacotes e orçamentos
- Eventos
- Contratos e aceite digital
- Parcelas e cobranças
- Equipe e escala por evento
- Checklist operacional
- Financeiro e relatórios

### Salão de beleza

- Clientes
- Agenda
- Serviços e pacotes
- Profissionais e comissões
- Caixa e financeiro
- Estoque
- Fidelidade
- Lembretes
- Relatórios

### Profissional autônomo

- Clientes
- Agenda
- Serviços
- Reservas online
- Pagamentos
- Lembretes
- Histórico de atendimentos
- Relatórios básicos

## Catálogo de módulos

Além dos módulos ativados pelo template, o cliente poderá adicionar:

- Estoque
- Financeiro avançado
- Contratos
- Cobrança recorrente
- Comissões
- Marketing e campanhas
- WhatsApp
- Fidelidade
- Prontuário/anamnese
- Agenda avançada
- Relatórios avançados
- Multiunidade
- Portal do cliente

## Regras de produto

1. O núcleo comum deve estar disponível para todos os nichos: organização, usuários e permissões, clientes, serviços, agenda, notificações, configurações e dashboard básico.
2. Templates são conjuntos de módulos e configurações iniciais; não devem criar implementações duplicadas por nicho.
3. O cliente pode ativar módulos depois do onboarding.
4. Módulos devem reutilizar o modelo de dados centralizado. Contratos usam clientes, cobranças usam contratos, eventos usam agenda, comissões usam serviços e relatórios usam dados financeiros.
5. Ativação e desativação de módulos devem respeitar dependências e preservar o histórico dos dados.
6. Cada módulo deve declarar suas dependências, permissões, rotas, eventos e configurações padrão.
7. A interface deve esconder módulos não ativos sem impedir sua ativação pelo catálogo.
8. A arquitetura será um modular monolith com bounded contexts, evitando acoplamento específico a um único nicho.

## Posicionamento

O SGS não deve competir apenas como mais uma agenda. O diferencial é administrar o negócio inteiro, do primeiro orçamento ao atendimento, cobrança e análise de rentabilidade.

Para o estúdio de noivas, a prioridade competitiva é resolver contrato, aceite, parcelas, operação por evento, equipe e margem — áreas menos atendidas por agendas genéricas.

## Sequenciamento

O template de estúdio de noivas será o primeiro caso completo. Durante sua implementação, funcionalidades reutilizáveis devem ser extraídas para o núcleo ou para módulos independentes. Só depois devem ser criados os templates de salão e profissional autônomo.

## Critérios de evolução

Um novo nicho só deve ser criado quando houver:

- conjunto de problemas e fluxos próprios claramente identificados;
- módulos reutilizáveis já existentes ou especificados;
- permissões e dados necessários definidos;
- template inicial testável sem duplicar domínio existente.
