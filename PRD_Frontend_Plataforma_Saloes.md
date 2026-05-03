# PRD de Frontend

**Plataforma de Gestão Inteligente para Salões de Beleza**

Aplicação web React, design system, estado, performance e acessibilidade

---

**Versão:** 1.0
**Data:** Maio de 2026
**Autor:** Daniel Leite Rodrigues

---

## Controle de Versões

| Versão | Data       | Autor                  | Descrição                                                  |
|--------|------------|------------------------|-------------------------------------------------------------|
| 1.0    | 02/05/2026 | Daniel Leite Rodrigues | Versão inicial do documento                                 |

---

## Sumário

1. [Introdução](#1-introdução)
2. [Arquitetura da Aplicação](#2-arquitetura-da-aplicação)
3. [Estrutura de Código](#3-estrutura-de-código)
4. [Design System](#4-design-system)
5. [Gerenciamento de Estado](#5-gerenciamento-de-estado)
6. [Camada de Dados](#6-camada-de-dados)
7. [Roteamento e Navegação](#7-roteamento-e-navegação)
8. [Formulários e Validação](#8-formulários-e-validação)
9. [Telas Críticas](#9-telas-críticas)
10. [Performance no Cliente](#10-performance-no-cliente)
11. [Acessibilidade](#11-acessibilidade)
12. [Internacionalização](#12-internacionalização)
13. [Padrões de Código](#13-padrões-de-código)
14. [Decisões Pendentes](#14-decisões-pendentes)
15. [Anexos](#anexos)

---

## 1. Introdução

### 1.1 Propósito

Este PRD define a camada de frontend da plataforma de gestão para salões. Detalha a arquitetura da aplicação web, o design system, o gerenciamento de estado, a integração com a API GraphQL, padrões de formulário, performance no navegador e acessibilidade. Serve como referência para o time que vai construir e evoluir a interface.

### 1.2 Relação com outros documentos

- **SDD da plataforma:** princípios gerais e visão de produto vivem no SDD. Padrões de teste seguem a Seção 3 do SDD.
- **PRD de Backend:** o frontend consome a API GraphQL definida lá. Convenções de schema, persisted queries e tratamento de erros são compartilhadas.
- **PRD de Banco de Dados:** referenciado indiretamente. O frontend não conhece tabelas, apenas tipos GraphQL.

### 1.3 Escopo

Cobre:

- Arquitetura da aplicação web React.
- Estrutura de pastas, componentes, hooks.
- Design system: tokens, componentes base, padrões visuais.
- Estado de servidor (Apollo) e estado de UI (React + Zustand).
- Formulários com React Hook Form e Zod.
- Telas críticas e seus padrões de UX.
- Performance, acessibilidade e i18n.

Não cobre:

- App mobile React Native (PRD próprio futuro).
- Página pública de agendamento online (Fase 3, PRD próprio).
- Painel administrativo da plataforma (uso interno, escopo separado).

### 1.4 Stack tecnológica

Definida no SDD, Seção 5.1. Resumo:

- **Framework:** React 18 com TypeScript
- **Build:** Vite 5
- **Roteamento:** React Router 6
- **Estado servidor:** Apollo Client 3
- **Estado UI:** Zustand 4 + React Context
- **Formulários:** React Hook Form 7 + Zod 3
- **Estilo:** Tailwind CSS 3 + shadcn/ui
- **Ícones:** Lucide React
- **Gráficos:** Recharts
- **Datas:** date-fns + date-fns-tz
- **Testes:** Vitest, Testing Library, Playwright

### 1.5 Princípios

- **Mobile-first com foco em tablet:** o salão usa tablet o dia inteiro. Layouts pensados para 768px primeiro, ajustados para desktop e celular depois.
- **Performance percebida acima de tudo:** carregamento rápido da agenda e da comanda definem se o sistema é usável no dia a dia.
- **Componentização rigorosa:** componente complexo é construído por composição de componentes simples e testados.
- **Acessibilidade não é opcional:** contraste, navegação por teclado e leitores de tela são requisitos, não bônus.
- **Tipo é contrato:** TypeScript strict, tipos do GraphQL gerados automaticamente, sem `any` em código de produção.
- **Tudo testado conforme SDD Seção 3:** sem exceção.

---

## 2. Arquitetura da Aplicação

### 2.1 Estilo

SPA (Single Page Application) com React, servida estaticamente via CDN. Sem SSR no MVP. Justificativa: aplicação interna autenticada, SEO não é requisito, complexidade de SSR não compensa o ganho.

Reavaliar SSR/SSG quando criar a página pública de agendamento online (Fase 3 do roteiro).

### 2.2 Camadas

A aplicação organiza-se em camadas concêntricas, espelhando a Clean Architecture do backend:

```
┌─────────────────────────────────────────────┐
│  Pages (rotas, layouts)                     │
│  ┌───────────────────────────────────────┐  │
│  │  Features (telas e fluxos)            │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │  Components (UI compartilhada)  │  │  │
│  │  │  ┌───────────────────────────┐  │  │  │
│  │  │  │  Design System (tokens)   │  │  │  │
│  │  │  └───────────────────────────┘  │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
│  Infrastructure (Apollo, Zustand, helpers)  │
└─────────────────────────────────────────────┘
```

- **Design System:** tokens e primitivos visuais (cores, tipografia, espaçamentos, componentes base).
- **Components:** componentes reutilizáveis em múltiplas features (Avatar, EmptyState, ConfirmDialog).
- **Features:** módulos por bounded context (Agenda, Comanda, Clientes). Cada feature tem suas próprias telas, hooks e componentes específicos.
- **Pages:** entradas de rota, layouts, providers.
- **Infrastructure:** clientes (Apollo, fetch), stores globais, helpers.

### 2.3 Organização por feature

Cada feature alinha-se com um bounded context do backend:

| Feature           | Bounded Context backend equivalente |
|-------------------|-------------------------------------|
| `auth`            | `identity`                          |
| `organization`    | `identity`                          |
| `members`         | `identity`                          |
| `catalog`         | `catalog`                           |
| `clients`         | `clients`                           |
| `bridal`          | `clients` + `scheduling`            |
| `schedule`        | `scheduling`                        |
| `orders`          | `pos`                               |
| `finance`         | `finance`                           |
| `commissions`     | `commissions`                       |
| `contracts`       | `contracts`                         |
| `communication`   | `communication`                     |
| `reports`         | `reporting`                         |

### 2.4 Renderização

- **Code splitting por rota:** cada página é um chunk separado, carregado sob demanda via `React.lazy`.
- **Prefetch oportunista:** ao passar o mouse sobre link de navegação, prefetcha o chunk e a query principal.
- **Streaming de dados:** Apollo retorna dados parciais enquanto sub-queries carregam.
- **Skeletons sempre que possível:** nada de spinner solitário em tela.

---

## 3. Estrutura de Código

### 3.1 Layout de pastas

```
frontend/
├── src/
│   ├── main.tsx                         # bootstrap
│   ├── App.tsx                          # providers + roteador
│   ├── router.tsx                       # definição de rotas
│   ├── design-system/                   # tokens e primitivos
│   │   ├── tokens/
│   │   ├── primitives/                  # Button, Input, Dialog (shadcn)
│   │   └── icons.ts
│   ├── components/                      # UI reutilizável
│   │   ├── EmptyState/
│   │   ├── ConfirmDialog/
│   │   ├── DataTable/
│   │   └── ...
│   ├── features/
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── pages/
│   │   │   ├── api/                     # queries/mutations específicas
│   │   │   └── auth.routes.tsx
│   │   ├── schedule/
│   │   ├── orders/
│   │   └── ...
│   ├── pages/
│   │   ├── DashboardLayout.tsx
│   │   ├── PublicLayout.tsx
│   │   └── NotFound.tsx
│   ├── infrastructure/
│   │   ├── apollo/
│   │   │   ├── client.ts
│   │   │   ├── cache.ts
│   │   │   └── persisted-queries.json   # gerado no build
│   │   ├── stores/
│   │   │   ├── auth.store.ts
│   │   │   └── ui.store.ts
│   │   ├── i18n/
│   │   └── analytics/
│   ├── lib/                             # helpers puros
│   │   ├── date.ts
│   │   ├── currency.ts
│   │   ├── phone.ts
│   │   └── validation.ts
│   ├── types/
│   │   └── graphql.ts                   # gerado automaticamente
│   └── styles/
│       └── globals.css
├── public/
├── tests/
│   ├── e2e/
│   └── helpers/
├── codegen.ts                           # config do GraphQL Code Generator
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

### 3.2 Convenções de nomenclatura

| Tipo                | Convenção                       | Exemplo                                |
|---------------------|---------------------------------|----------------------------------------|
| Arquivo de componente | PascalCase, sufixo `.tsx`     | `AppointmentCard.tsx`                  |
| Hook                | camelCase, prefixo `use`        | `useAppointment`, `useDebounce`        |
| Helper / lib        | camelCase                       | `formatCurrency`, `parsePhoneNumber`   |
| Store Zustand       | camelCase, sufixo `.store.ts`   | `auth.store.ts`                        |
| Tipo / interface    | PascalCase                      | `Appointment`, `ScheduleProps`         |
| Constante           | UPPER_SNAKE_CASE                | `MAX_PAGE_SIZE`                        |
| Variável CSS        | kebab-case                      | `--color-primary-500`                  |

### 3.3 Estrutura de uma feature

Cada feature segue o template:

```
features/schedule/
├── api/
│   ├── queries.graphql                  # arquivo GraphQL
│   └── mutations.graphql
├── components/
│   ├── DayView/
│   │   ├── DayView.tsx
│   │   ├── DayView.test.tsx
│   │   └── index.ts
│   ├── AppointmentCard/
│   ├── CreateAppointmentDialog/
│   └── TimeBlockBar/
├── hooks/
│   ├── useScheduleFilters.ts
│   ├── useAppointmentMutations.ts
│   └── useDragAppointment.ts
├── pages/
│   ├── SchedulePage.tsx
│   └── BridalSchedulePage.tsx
├── types/
│   └── schedule.types.ts
├── schedule.routes.tsx
└── index.ts                             # barrel export
```

### 3.4 Tamanho de componente

- **Componente atômico:** menos de 50 linhas, uma responsabilidade clara.
- **Componente de tela:** até 200 linhas. Acima disso, refatorar em sub-componentes.
- **Hook customizado:** até 100 linhas. Acima disso, dividir em hooks menores ou extrair para serviço.

Componentes grandes não são proibidos, mas pull request acima de 300 linhas em um único componente exige justificativa.

---

## 4. Design System

### 4.1 Princípios

- **Tokens antes de componentes:** cor, espaçamento e tipografia definidos como variáveis CSS, consumidos via Tailwind.
- **Composição sobre customização:** componentes base (Button, Input, Dialog) são minimalistas. Variações se constroem por composição.
- **Acessível por padrão:** todo componente do design system é navegável por teclado e tem suporte a leitor de tela.

### 4.2 Tokens

#### 4.2.1 Cores

Paleta semântica em vez de cores cruas. Cada cor tem variações de 50 a 900.

```css
:root {
  /* Cores primárias */
  --color-primary-50:  #EEEDFE;
  --color-primary-500: #5D54C7;
  --color-primary-700: #3C3489;
  --color-primary-900: #26215C;

  /* Cores semânticas */
  --color-success-500: #1D9E75;
  --color-warning-500: #EF9F27;
  --color-error-500:   #D85A30;
  --color-info-500:    #185FA5;

  /* Neutros */
  --color-neutral-0:   #FFFFFF;
  --color-neutral-50:  #FAFAF8;
  --color-neutral-200: #E5E3DC;
  --color-neutral-500: #888780;
  --color-neutral-800: #2C2C2A;

  /* Cores funcionais */
  --color-background: var(--color-neutral-50);
  --color-surface:    var(--color-neutral-0);
  --color-text:       var(--color-neutral-800);
  --color-text-muted: var(--color-neutral-500);
  --color-border:     var(--color-neutral-200);
}
```

Modo escuro previsto, ativado via classe `.dark` no `<html>`.

#### 4.2.2 Tipografia

```css
:root {
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* Escala tipográfica */
  --text-xs:   0.75rem;   /* 12px */
  --text-sm:   0.875rem;  /* 14px */
  --text-base: 1rem;      /* 16px */
  --text-lg:   1.125rem;  /* 18px */
  --text-xl:   1.25rem;   /* 20px */
  --text-2xl:  1.5rem;    /* 24px */
  --text-3xl:  1.875rem;  /* 30px */
}
```

Texto base 16px no desktop, 15px no mobile (preserva legibilidade em tablet).

#### 4.2.3 Espaçamentos e raios

Sistema base 4px. Múltiplos: 4, 8, 12, 16, 20, 24, 32, 48, 64.

Raios: 4px (pequenos), 8px (médios), 12px (cards), 9999px (pílulas).

### 4.3 Componentes base

Construídos sobre shadcn/ui (Radix UI por baixo). Lista mínima:

| Componente       | Uso                                                        |
|------------------|------------------------------------------------------------|
| Button           | Ação primária, secundária, destrutiva, ghost               |
| IconButton       | Ações compactas em listas                                  |
| Input            | Texto, número, email, telefone                             |
| Textarea         | Texto longo                                                |
| Select           | Lista de opções fixa                                       |
| Combobox         | Lista pesquisável (clientes, profissionais)                |
| DatePicker       | Seleção de data                                            |
| TimePicker       | Seleção de horário                                         |
| Checkbox         | Booleano                                                   |
| Switch           | Booleano com ação imediata                                 |
| RadioGroup       | Escolha única                                              |
| Dialog           | Modal de confirmação ou formulário                         |
| Drawer           | Painel lateral (formulários longos no mobile)              |
| Sheet            | Bottom sheet no mobile                                     |
| Toast            | Feedback efêmero                                           |
| Tabs             | Navegação dentro de tela                                   |
| Card             | Agrupador visual                                           |
| Badge            | Status, tags                                               |
| Avatar           | Foto de cliente, profissional                              |
| Tooltip          | Dica em hover                                              |
| Popover          | Menu contextual                                            |
| Skeleton         | Placeholder durante loading                                |
| EmptyState       | Estado vazio com call-to-action                            |
| DataTable        | Listagem paginada com filtros e ordenação                  |

### 4.4 Padrões visuais

#### 4.4.1 Densidade

Duas densidades:

- **Confortável (padrão):** espaçamentos amplos, ideal para tablet e mobile.
- **Compacta:** menos espaço, ideal para usuários avançados em desktop, ativada via preferência.

#### 4.4.2 Estados

Todo elemento interativo tem cinco estados visualmente distintos: default, hover, focus, active, disabled. Estados de erro e sucesso para inputs.

#### 4.4.3 Feedback de ação

- **Ação rápida (< 1s):** sem feedback explícito além da mudança visual.
- **Ação média (1 a 3s):** botão entra em estado loading, fica desabilitado.
- **Ação lenta (> 3s):** progresso explícito ou rodapé persistente "Salvando...".
- **Ação concluída:** toast verde, 3 segundos.
- **Ação falhada:** toast vermelho com texto da mensagem de erro, persistente até clicar.

### 4.5 Documentação visual

Storybook como documentação viva do design system. Cada componente tem:

- Story principal com props padrão.
- Stories de variações (sizes, states, com/sem ícone).
- Documentação de props auto-gerada via TypeScript.
- Testes de regressão visual via Chromatic ou Playwright.

---

## 5. Gerenciamento de Estado

### 5.1 Categorias

O frontend lida com quatro categorias de estado, cada uma com sua ferramenta:

| Categoria              | Origem                  | Ferramenta                |
|------------------------|-------------------------|---------------------------|
| Estado de servidor     | API GraphQL             | Apollo Client             |
| Estado de UI global    | Sessão, tema, sidebar   | Zustand                   |
| Estado de UI local     | Hover, foco, abertura   | useState do React         |
| Estado de formulário   | Inputs do usuário       | React Hook Form           |

Princípio: cada estado vive na ferramenta certa. Não usar Apollo para guardar UI, não usar Zustand para guardar dados de servidor.

### 5.2 Apollo Client

#### 5.2.1 Configuração

```typescript
const apolloClient = new ApolloClient({
  uri: import.meta.env.VITE_GRAPHQL_URL,
  cache: new InMemoryCache({ typePolicies }),
  link: from([
    errorLink,
    authLink,
    persistedQueryLink,
    retryLink,
    httpLink,
  ]),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network' },
  },
});
```

#### 5.2.2 Cache normalizado

Apollo normaliza por `__typename` + `id`. Tipos com identidade composta (ex: comissão por par profissional+data) precisam de `keyFields` customizado em `typePolicies`.

#### 5.2.3 Persisted queries

Ativadas em produção via `createPersistedQueryLink`. Frontend envia apenas hash, backend resolve para a query original. Detalhes no PRD de Backend, Seção 4.2.

#### 5.2.4 Otimistic updates

Aplicadas em mutations onde feedback imediato melhora UX significativamente:

- Marcar agendamento como confirmado.
- Adicionar item à comanda.
- Curtir/desfavoritar cliente.

Não aplicadas em operações com cálculo complexo (fechar comanda, calcular comissão) — risco de discrepância visível.

### 5.3 Zustand

Stores globais para estado de UI que precisa persistir entre rotas:

- `auth.store`: usuário autenticado, organização atual, permissões.
- `ui.store`: sidebar aberta, tema, densidade, idioma.
- `notifications.store`: toasts, banners de sistema.

Cada store é um arquivo, com slices se ficar grande. Sem reducers — funções diretas que mutam estado via Immer interno do Zustand.

### 5.4 Context vs Zustand

- **Context:** quando o estado é específico de uma sub-árvore (ex: `OrderProvider` dentro da tela de comanda).
- **Zustand:** quando o estado é global ou compartilhado entre features distantes.

---

## 6. Camada de Dados

### 6.1 GraphQL Code Generator

Tipos TypeScript gerados automaticamente do schema do backend. Roda em watch durante desenvolvimento e no CI.

```typescript
// codegen.ts
export default {
  schema: 'http://localhost:3000/graphql',
  documents: 'src/**/*.graphql',
  generates: {
    'src/types/graphql.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typed-document-node',
      ],
    },
    'src/infrastructure/apollo/persisted-queries.json': {
      plugins: ['persisted-query-hashes'],
    },
  },
};
```

Resultado: queries e mutations totalmente tipadas, autocompletar funcionando, mudanças no schema causam erro de compilação no frontend.

### 6.2 Padrão de uso

#### 6.2.1 Query

```typescript
// features/schedule/api/queries.graphql
query Appointments($filter: AppointmentFilter!) {
  appointments(filter: $filter) {
    edges {
      node {
        id
        startsAt
        endsAt
        status
        client { id fullName phone }
        professional { id displayName }
        services { id name durationMinutes }
      }
    }
  }
}

// uso no componente
const { data, loading, error } = useAppointmentsQuery({
  variables: { filter: { date: today, professionalId } },
});
```

#### 6.2.2 Mutation

```typescript
const [createAppointment, { loading }] = useCreateAppointmentMutation({
  refetchQueries: ['Appointments'],
  onCompleted: (data) => {
    if (data.createAppointment.errors.length > 0) {
      toast.error(data.createAppointment.errors[0].message);
      return;
    }
    toast.success('Agendamento criado.');
    closeDialog();
  },
});
```

#### 6.2.3 Subscription

Usadas com parcimônia. Implementação via `@apollo/client/link/ws`.

```typescript
useAppointmentUpdatedSubscription({
  variables: { organizationId },
  onData: ({ data }) => {
    // atualiza cache normalizado, não dispara re-render manual
  },
});
```

### 6.3 Tratamento de erros

Hierarquia espelhando o backend (PRD de Backend, Seção 4.6):

- **UserError no payload:** vira mensagem amigável no toast.
- **AuthenticationError:** redireciona para login, limpa store.
- **AuthorizationError:** mostra tela "Sem permissão" com link para administrador.
- **InfrastructureError:** toast genérico ("Algo deu errado") e reporta ao Sentry.

Interceptado em `errorLink` do Apollo:

```typescript
const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  graphQLErrors?.forEach((err) => {
    switch (err.extensions?.code) {
      case 'UNAUTHENTICATED': handleAuthExpired(); break;
      case 'FORBIDDEN': showPermissionDenied(); break;
      default: reportToSentry(err, operation);
    }
  });
});
```

### 6.4 Loading states

Padrão hierárquico:

1. **Skeleton em primeiro carregamento:** quando ainda não há dados em cache.
2. **Stale-while-revalidate em refetch:** mostra dados antigos com indicador sutil de atualização.
3. **Spinner em ação:** apenas em mutations e em casos onde skeleton não cabe.

Nunca tela em branco. Nunca loading cobrindo conteúdo já carregado.

---

## 7. Roteamento e Navegação

### 7.1 Estrutura de rotas

```
/login
/select-organization
/setup-totp

/{org}/dashboard
/{org}/schedule
/{org}/schedule/:date
/{org}/clients
/{org}/clients/:clientId
/{org}/clients/:clientId/anamnesis
/{org}/bridal/:groupId
/{org}/orders/:orderId
/{org}/catalog/services
/{org}/catalog/products
/{org}/catalog/packages
/{org}/finance/cashier
/{org}/finance/payments
/{org}/finance/forecast
/{org}/contracts
/{org}/contracts/:contractId
/{org}/commissions
/{org}/reports
/{org}/settings/organization
/{org}/settings/members
/{org}/settings/roles
/{org}/settings/communication
```

### 7.2 Estrutura de URL

- **Identificadores são UUIDs:** evita expor sequência ou ordem de cadastro.
- **Filtros são query params:** `/schedule?date=2026-05-15&professionalId=...`
- **Estado de UI é local:** modal aberto, aba selecionada não vai para URL exceto se compartilhamento for relevante.
- **Org no path:** subdomínio é fonte primária do tenant (ex: `studio.plataforma.com.br/schedule`). O `{org}` no path é redundância para permitir que admins da plataforma acessem múltiplas orgs no mesmo domínio.

### 7.3 Code splitting

```typescript
const SchedulePage = lazy(() => import('./features/schedule/pages/SchedulePage'));
const OrdersPage = lazy(() => import('./features/orders/pages/OrdersPage'));

<Routes>
  <Route path="/:org/schedule" element={<SchedulePage />} />
  <Route path="/:org/orders/:orderId" element={<OrdersPage />} />
</Routes>
```

Cada rota é um chunk. Layout principal e dependências comuns ficam no bundle inicial.

### 7.4 Proteção de rotas

`<ProtectedRoute>` valida:

- Sessão ativa (existe access token válido).
- Organização selecionada.
- Permissão para a rota (ex: `/finance/*` exige `finance.view`).

Falha em qualquer validação redireciona para login ou para tela apropriada.

### 7.5 Navegação

- **Sidebar persistente em desktop:** com ícones e labels.
- **Bottom nav em mobile:** ícones para 5 destinos principais (Agenda, Comandas, Clientes, Financeiro, Mais).
- **Breadcrumb em telas profundas:** clientes > João Silva > Anamnese.
- **Atalhos de teclado:** documentados em diálogo acessível por `?`.

---

## 8. Formulários e Validação

### 8.1 Stack

- **React Hook Form:** gerenciamento de estado e re-render mínimo.
- **Zod:** schema de validação compartilhado com backend quando possível.
- **Componentes de formulário:** `<FormField>`, `<FormControl>`, `<FormMessage>` do shadcn/ui.

### 8.2 Padrão

```typescript
const schema = z.object({
  fullName: z.string().min(3, 'Nome muito curto'),
  phone: z.string().regex(/^\+?\d{10,15}$/, 'Telefone inválido'),
  birthDate: z.date().optional(),
});

type FormValues = z.infer<typeof schema>;

const form = useForm<FormValues>({
  resolver: zodResolver(schema),
  defaultValues: { fullName: '', phone: '' },
});

const onSubmit = (values: FormValues) => {
  createClient({ variables: { input: values } });
};
```

### 8.3 Validação cliente vs servidor

- **Cliente:** validação rápida, formato, presença, consistência básica. Feedback imediato.
- **Servidor:** validação de regra de negócio, unicidade, autorização. Source of truth.

Mensagens de erro do servidor são mapeadas em campos correspondentes do formulário via `setError`.

### 8.4 UX de formulário

- **Validação on blur, não on change:** evita feedback agressivo enquanto o usuário digita.
- **Submit desabilitado até formulário válido:** previne tentativas erradas.
- **Loading no botão de submit, não em overlay:** mantém contexto visual.
- **Foco automático no primeiro campo com erro:** acelera correção.
- **Confirmação ao sair com mudanças não salvas:** dialog "Você tem alterações não salvas".

### 8.5 Campos brasileiros

Inputs com máscara automática:

- **Telefone:** `(11) 99999-9999`, normalizado para `+5511999999999` antes do envio.
- **CPF/CNPJ:** detectado pelo tamanho, formatado adequadamente.
- **CEP:** `00000-000`, busca automática de endereço via ViaCEP.
- **Dinheiro:** `R$ 1.234,56`, normalizado para centavos antes do envio.
- **Data:** `DD/MM/AAAA`, com calendar picker como alternativa.

Helpers em `lib/format.ts` para entrada e saída.

---

## 9. Telas Críticas

### 9.1 Definição

Telas críticas são as mais usadas e que mais impactam a percepção de qualidade do produto. Elas têm requisitos extras de performance, polimento e teste.

Lista inicial:

- Agenda do dia
- Detalhe do agendamento
- Comanda aberta
- Painel financeiro
- Cadastro de cliente
- Cronograma de noiva

### 9.2 Agenda do dia

#### 9.2.1 Layout

- **Eixo X:** profissionais, ordenados conforme preferência da organização.
- **Eixo Y:** horários do dia (8h às 22h por padrão, configurável), com slots de 15 minutos.
- **Cards de agendamento:** posicionados na grade conforme `startsAt` e `endsAt`. Cor por status.
- **Bloqueios:** sobrepostos como áreas hachuradas, com motivo no hover.

#### 9.2.2 Interações

- **Clicar no slot vazio:** abre dialog para criar agendamento, já com horário e profissional preenchidos.
- **Clicar no card:** abre painel lateral com detalhes do agendamento.
- **Drag & drop:** mover agendamento para outro horário ou profissional. Confirma antes de aplicar.
- **Resize:** arrastar borda inferior para mudar duração (apenas com permissão).

#### 9.2.3 Performance

- Renderizar 50 a 100 agendamentos por dia sem travamento perceptível.
- Atualização via subscription propaga em < 1 segundo.
- Mudança de dia carrega em < 500ms (com cache, instantâneo).

### 9.3 Comanda aberta

#### 9.3.1 Layout

- **Cabeçalho:** cliente, profissional principal, hora de abertura.
- **Lista de itens:** serviços e produtos consumidos. Cada linha com profissional executor, valor, desconto.
- **Lateral direita:** subtotal, descontos, total. Histórico de pagamentos parciais.
- **Botões fixos no rodapé:** "Adicionar serviço", "Adicionar produto", "Receber pagamento", "Fechar comanda".

#### 9.3.2 Interações

- **Adicionar item:** combobox com busca em catálogo. Suporta múltiplos profissionais por item (split de comissão).
- **Editar item:** ajustar quantidade, valor, desconto, profissional.
- **Receber pagamento:** dialog com método, valor, parcelas.
- **Fechar comanda:** valida que `paid >= total`. Se faltar, oferece adicionar pagamento.

#### 9.3.3 Estado em tempo real

Várias pessoas podem ver a mesma comanda. Atualização via subscription mostra:

- Avatar de quem está visualizando no momento.
- Notificação quando outro usuário modifica algo.
- Resolução de conflito otimista: quem fechou primeiro vence, segundo vê erro amigável.

### 9.4 Cronograma de noiva

#### 9.4.1 Layout

- **Lista lateral:** noiva e acompanhantes do grupo.
- **Eixo principal:** linha do tempo do dia do evento, com cada cliente em uma faixa.
- **Sugestão da IA:** botão "Sugerir cronograma ótimo" preenche a linha com base em duração de serviços e profissionais disponíveis.

#### 9.4.2 Interações

- **Drag & drop intuitivo:** arrastar cliente para faixa, ajustar horário arrastando.
- **Conflitos visuais:** sobreposições destacadas em vermelho.
- **Validação contínua:** se uma acompanhante depende do mesmo profissional da noiva, o sistema avisa.
- **Exportar:** PDF com cronograma para entregar à cliente.

### 9.5 Painel financeiro

#### 9.5.1 Layout

- **Cards superiores:** faturamento do dia/mês, despesas, comissões, lucro estimado.
- **Gráfico principal:** linha de faturamento por dia do mês, comparado com mês anterior.
- **Listas laterais:** próximos vencimentos, contratos próximos, alertas.

#### 9.5.2 Filtros

- Período (hoje, semana, mês, customizado).
- Profissional (impacta comissões e atendimentos).
- Forma de pagamento.

Filtros refletem em URL para compartilhamento.

#### 9.5.3 Performance

Painel financeiro é a query mais cara da plataforma. Estratégias:

- Cache em Redis com TTL de 5 minutos (definido no PRD de Backend).
- Skeleton bem desenhado durante primeira carga.
- Atualização em background sem travar a tela.

---

## 10. Performance no Cliente

### 10.1 Métricas alvo

Web Vitals em conexão 4G de mediana brasileira (Moto G4 simulado):

| Métrica                          | Alvo P75 |
|----------------------------------|----------|
| LCP (Largest Contentful Paint)   | < 2,5s   |
| INP (Interaction to Next Paint)  | < 200ms  |
| CLS (Cumulative Layout Shift)    | < 0,1    |
| FCP (First Contentful Paint)     | < 1,8s   |
| TTFB (Time to First Byte)        | < 600ms  |

Métricas específicas de aplicação:

| Operação                                    | Alvo P95 |
|---------------------------------------------|----------|
| Carregamento inicial (com cache)            | < 800ms  |
| Carregamento da agenda do dia               | < 1s     |
| Mudança entre rotas                         | < 400ms  |
| Submit de formulário com sucesso            | < 1,5s   |

### 10.2 Estratégias

#### 10.2.1 Bundle

- **Tree shaking agressivo:** Vite cuida disso, mas evitar imports do tipo `import * as`.
- **Code splitting por rota:** já mencionado.
- **Análise de bundle no CI:** alerta se bundle inicial passar de 200KB gzipped.
- **Importações dinâmicas para libs pesadas:** Recharts só carrega quando o gráfico renderiza.

#### 10.2.2 Imagens

- **Formato:** WebP com fallback PNG/JPG.
- **Lazy loading:** atributo `loading="lazy"` em imagens fora da viewport.
- **Tamanhos responsivos:** `srcset` para fornecer variantes de resolução.
- **Avatar com placeholder:** iniciais coloridas enquanto a foto carrega.

#### 10.2.3 Renderização

- **`React.memo` cirurgicamente:** apenas em componentes provadamente custosos. Não preventivamente.
- **Virtualização em listas longas:** `react-virtual` para lista de clientes (>500 itens) e agenda densa.
- **`useMemo` e `useCallback` com critério:** apenas quando referência estável é necessária ou cálculo é caro.

#### 10.2.4 Cache

- **Apollo InMemoryCache:** padrão para queries. Sobrevive entre rotas.
- **Service Worker (Workbox):** cacheia bundles e assets estáticos. Atualização em background com prompt para o usuário.
- **localStorage:** preferências do usuário (tema, densidade, organização padrão).
- **sessionStorage:** dados sensíveis que devem sumir ao fechar aba.

### 10.3 Monitoramento

- **Real User Monitoring (RUM):** via Sentry Performance ou similar. Coleta Web Vitals reais de todos os usuários.
- **Alertas:** disparam quando P75 de LCP ou INP regride mais de 20% em release.
- **Painel público de performance:** visível ao time, com tendências por release.

---

## 11. Acessibilidade

### 11.1 Nível alvo

WCAG 2.1 AA em todas as telas críticas. AAA em fluxos de cadastro e financeiro quando viável.

### 11.2 Práticas obrigatórias

- **Contraste mínimo 4,5:1** em texto normal, 3:1 em texto grande.
- **Todo elemento interativo navegável por teclado:** Tab, Enter, Espaço, setas onde fizer sentido.
- **Focus ring visível e estilizado:** nunca remover sem substituir.
- **Atributos ARIA corretos:** `aria-label`, `aria-describedby`, `aria-live` onde aplicável.
- **Headings hierárquicos:** apenas um `<h1>` por tela, `<h2>` para seções, sem pular níveis.
- **Imagens com alt texto:** descritivo, não decorativo. Decorativas usam `alt=""`.
- **Formulários com `<label>` associado:** sempre, mesmo quando visualmente escondido.
- **Mensagens de erro lidas por screen reader:** via `role="alert"` ou `aria-live="polite"`.
- **Componentes de Radix:** usados quando possível (já são acessíveis por design).

### 11.3 Testes automatizados

- **axe-core no CI:** roda contra todas as páginas em build de PR.
- **Storybook a11y addon:** valida cada componente isoladamente.
- **Lint:** `eslint-plugin-jsx-a11y` ativo, com regras estritas.

### 11.4 Testes manuais

- **Navegação só por teclado:** suite mensal cobrindo fluxos críticos.
- **Screen reader:** NVDA no Windows, VoiceOver no Mac. Validação trimestral.
- **Zoom 200%:** layout deve continuar usável.

### 11.5 Casos específicos

- **Modo redução de movimento:** respeita `prefers-reduced-motion`. Animações longas viram instantâneas.
- **Modo alto contraste:** respeita `prefers-contrast: high`.
- **Fontes do sistema:** respeita configuração do usuário (texto não trava em px, usa rem).

---

## 12. Internacionalização

### 12.1 Stack

- **react-i18next:** carregamento lazy de bundles de idioma.
- **ICU MessageFormat:** suporte a plurais e gênero.
- **date-fns:** formatação de datas com locale brasileiro.

### 12.2 Idiomas

- **Lançamento:** apenas pt-BR.
- **Estrutura preparada para multi-idioma:** strings nunca hardcoded em componentes.
- **Próximos previstos:** es-ES (mercado latino-americano), en-US (parceiros internacionais).

### 12.3 Padrão

```typescript
// arquivos de tradução: /src/infrastructure/i18n/locales/pt-BR.json
{
  "schedule.empty": "Nenhum agendamento para este dia",
  "schedule.create": "Novo agendamento",
  "client.greeting": "Olá, {name}!"
}

// uso
const { t } = useTranslation();
<button>{t('schedule.create')}</button>
<h1>{t('client.greeting', { name: client.fullName })}</h1>
```

### 12.4 Formatação

- **Moeda:** `R$ 1.234,56` via `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
- **Datas:** `02 de maio de 2026` ou `02/05/2026` conforme contexto. Sempre via date-fns com locale.
- **Plurais:** ICU MessageFormat lida com regras pt-BR (zero, one, other).
- **Telefone:** formato brasileiro `(11) 99999-9999` na UI, E.164 (`+5511999999999`) na API.

### 12.5 Configuração

Idioma resolvido em ordem:

1. Preferência salva do usuário (em `users.locale`).
2. Configuração da organização (em `organizations.locale`).
3. `Accept-Language` do navegador.
4. Fallback `pt-BR`.

---

## 13. Padrões de Código

### 13.1 TypeScript

- **Strict mode obrigatório.**
- **Sem `any`** em código de produção. Em integrações com libs sem tipos, usar `unknown` e validar com Zod.
- **`as const` para tuplas e literais.**
- **Branded types** para identificadores: `type ClientId = string & { __brand: 'ClientId' }`.

### 13.2 Componentes

- **Function components only.** Sem class components.
- **Props tipadas com interface ou type alias:** sempre.
- **Default exports apenas em pages.** Demais usam named exports para refactor mais fácil.
- **Composição sobre herança:** componente filho recebe via children ou render prop.
- **Hooks em ordem clara:** primeiro estado, depois effects, depois callbacks, depois render.

### 13.3 Estilo

- **Tailwind primeiro:** classes utilitárias para 90% dos casos.
- **CSS modules em casos específicos:** animações complexas, layouts irregulares.
- **`clsx` para composição condicional de classes.**
- **`cva` (class-variance-authority) para variants** de componentes do design system.

### 13.4 Lint e formatação

- ESLint com plugins: `@typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `eslint-plugin-import`.
- Prettier compartilhado com backend.
- Husky + lint-staged: roda lint e format apenas nos arquivos modificados.

### 13.5 Testes

Padrões definidos no SDD, Seção 3. Reforço dos pontos específicos do frontend:

- **Unitários:** hooks customizados, helpers, lógica de cálculo. Testing Library para componentes complexos.
- **Componente:** Storybook + interaction tests para componentes do design system.
- **E2E:** Playwright para fluxos críticos. Lista mínima alinhada com a do SDD.
- **Regressão visual:** Chromatic ou Playwright com screenshots, em componentes do design system.
- **Acessibilidade:** axe-core no CI, conforme Seção 11.

### 13.6 Documentação

- **Storybook como documentação viva** do design system.
- **README por feature** descrevendo escopo, componentes principais e dependências.
- **JSDoc em hooks e helpers** quando o nome não for autoexplicativo.
- **ADRs em `/docs/decisions/`** alinhados com os do backend.

---

## 14. Decisões Pendentes

### 14.1 SPA puro vs SSR/SSG

MVP é SPA. Reavaliar quando:

- Página pública de agendamento online for prioridade (Fase 3).
- Compartilhamento de links de agenda virar feature.

Opções: Next.js (full migration) ou Remix (alternativa). Migração tem custo, decisão fica para quando o requisito aparecer.

### 14.2 Apollo vs TanStack Query

Apollo é a escolha padrão para GraphQL. TanStack Query é mais leve e flexível, mas exige escrever wrapper para cada operação. Decisão atual: Apollo. Reavaliar se cache normalizado virar mais problema do que solução (raro).

### 14.3 shadcn/ui vs Mantine vs Material UI

shadcn é a escolha por flexibilidade total (código no projeto) e estética moderna. Mantine tem mais componentes prontos. Material UI tem ecossistema maior mas estética mais datada. Decisão atual: shadcn. Reavaliar se aparecer escassez crônica de componentes específicos.

### 14.4 Zustand vs Redux Toolkit

Zustand é mais simples e suficiente para o estado global atual. Redux Toolkit traz devtools e ecossistema. Decisão atual: Zustand. Migrar para RTK só se aparecer necessidade real de devtools avançados ou middleware complexo.

### 14.5 Vite vs Next.js como build tool

Vite escolhido pela velocidade em dev e simplicidade. Next.js daria SSR de graça mas adiciona complexidade. Decisão atual: Vite. Casa com a escolha de SPA puro.

### 14.6 Subscriptions: WebSocket via Apollo vs alternativas

Apollo WebSocket Link é o padrão. Alternativas (SSE, polling longo) são mais simples mas menos flexíveis. Decisão atual: WebSocket. Subscriptions usadas com parcimônia para conter complexidade.

### 14.7 PWA agora ou depois

PWA com service worker e instalação na tela inicial agrega valor para tablet do salão (uso offline parcial, ícone na home). Mas adiciona complexidade. Decisão pendente: avaliar tempo de implementação contra valor após primeiros pilotos.

---

## Anexos

### Anexo A — Mapeamento de telas para bounded contexts

| Tela                              | Feature       | Backend module    | Permissão necessária         |
|-----------------------------------|---------------|-------------------|------------------------------|
| Login                             | auth          | identity          | -                            |
| Selecionar organização            | auth          | identity          | -                            |
| Dashboard                         | dashboard     | reporting         | dashboard.view               |
| Agenda do dia                     | schedule      | scheduling        | appointment.read             |
| Detalhe do agendamento            | schedule      | scheduling        | appointment.read             |
| Lista de clientes                 | clients       | clients           | client.read                  |
| Detalhe do cliente                | clients       | clients           | client.read                  |
| Anamnese do cliente               | clients       | clients           | anamnesis.read               |
| Grupos de noivas                  | bridal        | clients           | bridal.read                  |
| Cronograma de noiva               | bridal        | scheduling        | schedule.create              |
| Comanda aberta                    | orders        | pos               | order.read                   |
| Catálogo de serviços              | catalog       | catalog           | catalog.read                 |
| Catálogo de produtos              | catalog       | catalog           | catalog.read                 |
| Caixa                             | finance       | finance           | finance.cashier              |
| Painel financeiro                 | finance       | finance           | finance.view                 |
| Previsibilidade financeira        | finance       | finance           | finance.forecast             |
| Contratos                         | contracts     | contracts         | contract.read                |
| Comissões                         | commissions   | commissions       | commission.view              |
| Relatórios                        | reports       | reporting         | report.view                  |
| Configurações da organização     | organization  | identity          | organization.manage          |
| Membros e perfis                  | members       | identity          | member.manage                |

### Anexo B — Próximos passos

- Validar este PRD com o time.
- Configurar projeto Vite com TypeScript, Tailwind, ESLint e Prettier.
- Configurar GraphQL Code Generator.
- Implementar bootstrap: providers (Apollo, Auth, Theme, Router).
- Implementar o design system mínimo (tokens + 10 componentes base).
- Construir primeira feature (auth) como referência arquitetural.
- Configurar Storybook e Playwright.
- Estabelecer baseline de Web Vitals.

### Anexo C — Glossário específico de frontend

| Termo                | Definição                                                                              |
|----------------------|----------------------------------------------------------------------------------------|
| Feature              | Módulo organizado por bounded context, contendo telas, componentes e hooks específicos |
| Design System        | Conjunto de tokens, componentes base e padrões visuais reutilizáveis                   |
| Cache normalizado    | Estratégia do Apollo de armazenar entidades por tipo + id, com refs entre elas         |
| Optimistic update    | Atualização imediata da UI antes da resposta do servidor, com rollback em caso de falha|
| Code splitting       | Divisão do bundle em chunks carregados sob demanda                                     |
| Web Vitals           | Conjunto de métricas oficiais do Google para qualidade de experiência web              |
| INP                  | Interaction to Next Paint, métrica que substitui FID a partir de 2024                  |
| CLS                  | Cumulative Layout Shift, mede pulos visuais durante carregamento                       |
| Persisted query      | Query GraphQL pré-aprovada, identificada por hash, executada no backend                |
| RUM                  | Real User Monitoring, coleta de métricas de usuários reais em produção                 |
