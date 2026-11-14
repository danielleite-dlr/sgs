---
phase: 07-app-android-gestor-beauty-com-capacitor
plan: 05
type: execute
wave: 2
depends_on: ["07-01"]
files_modified:
  - apps/frontend/src/infrastructure/native/platform.ts
  - apps/frontend/src/infrastructure/native/push-route.ts
  - apps/frontend/src/infrastructure/native/native-push.ts
  - apps/frontend/src/infrastructure/native/device-token.api.ts
  - apps/frontend/src/infrastructure/native/__tests__/push-route.test.ts
  - apps/frontend/src/infrastructure/native/__tests__/use-native-push.test.ts
  - apps/frontend/src/infrastructure/native/__tests__/device-token-api.test.ts
  - apps/frontend/src/features/operations/pages/SchedulePage.tsx
  - apps/frontend/src/features/operations/__tests__/schedule-deep-link.test.tsx
autonomous: true
requirements: [C-03, C-04]

must_haves:
  truths:
    - "No navegador nada muda: todo código de plugin fica atrás de Capacitor.isNativePlatform() e de import() dinâmico"
    - "O toque na notificação só navega para rotas /agenda (allowlist); qualquer outra rota no payload é ignorada"
    - "Abrir /agenda?data=2026-11-20&visao=day&agendamento=<id> mostra a agenda daquele dia com o atendimento aberto (D-14)"
    - "O token do aparelho é registrado no backend e guardado localmente; no logout ele pode ser removido sem bloquear a saída"
    - "A permissão de notificação (Android 13+) é pedida no máximo uma vez, depois do login (Claude's Discretion)"
  artifacts:
    - path: "apps/frontend/src/infrastructure/native/push-route.ts"
      provides: "isAllowedPushRoute, savePendingRoute, consumePendingRoute"
      exports: ["isAllowedPushRoute", "savePendingRoute", "consumePendingRoute"]
    - path: "apps/frontend/src/infrastructure/native/native-push.ts"
      provides: "addPushListeners, registerForPush"
      exports: ["addPushListeners", "registerForPush"]
    - path: "apps/frontend/src/infrastructure/native/device-token.api.ts"
      provides: "registerDeviceToken, unregisterCurrentDeviceToken"
      contains: "registerDeviceToken(input: $input)"
  key_links:
    - from: "apps/frontend/src/features/operations/pages/SchedulePage.tsx"
      to: "AppointmentDetailsDialog"
      via: "searchParams 'agendamento' -> setDetailsId"
      pattern: "agendamento"
    - from: "apps/frontend/src/infrastructure/native/native-push.ts"
      to: "@capacitor/push-notifications"
      via: "import() dinâmico atrás de isNativeApp()"
      pattern: "import\\('@capacitor/push-notifications'\\)"
---

<objective>
Criar a camada nativa do frontend como biblioteca isolada e testada (`src/infrastructure/native/`): detecção de app, allowlist e rota pendente do toque, listeners e registro do push, chamadas GraphQL do token; e fazer a agenda abrir o atendimento indicado pelo parâmetro `agendamento` (D-14).

Purpose: C-03/C-04 sem tocar no layout; a ligação com o App/login/logout é o 07-08.
Output: 4 módulos em `infrastructure/native`, `SchedulePage` com `?agendamento=`, testes com `@capacitor/*` mockado.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-CONTEXT.md
@.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-RESEARCH.md

**Ambiente de execução:** igual ao 07-01. Frontend SEM prettier: formatação manual, aspas simples nos arquivos novos, ~100 colunas; manter o estilo do arquivo existente ao editar (`SchedulePage.tsx` usa aspas duplas). Nunca importar `tailwind.config.ts` em `src`. Testes: `corepack pnpm --filter @sgs/frontend exec vitest run <padrão>`.

<interfaces>
Existentes:
```ts
// apps/frontend/src/infrastructure/apollo/client.ts → export const apolloClient (authLink injeta Bearer + X-Organization-Id)
// apps/frontend/src/features/operations/lib/agenda-link.ts
export function toAgendaDateParam(date: Date): string;          // datas LOCAIS
export function parseAgendaDate(value: string | null): Date | null;
export function parseAgendaView(value: string | null): 'day' | 'week' | null;
// SchedulePage.tsx: const [searchParams] = useSearchParams(); selectedDate/view iniciam de 'data'/'visao';
//   const [detailsId, setDetailsId] = useState<string | null>(null); <AppointmentDetailsDialog appointment={...find(a => a.id === detailsId)} open={detailsId !== null} .../>
// Teste de referência que já renderiza SchedulePage com MockedProvider: src/features/operations/__tests__/agenda-gestor-beauty.test.tsx
```
Contrato que este plano CRIA (07-08 e 07-10 consomem):
```ts
// platform.ts
export function isNativeApp(): boolean; // Capacitor.isNativePlatform()
// push-route.ts (cópia das regras de packages/shared/src/push.ts)
export const AGENDA_ROUTE_RE: RegExp;
export function isAllowedPushRoute(route: unknown): route is string;
export const PENDING_ROUTE_KEY = 'sgs-pending-route';
export function savePendingRoute(route: unknown): void;     // só grava se isAllowedPushRoute (sessionStorage)
export function consumePendingRoute(): string | null;       // lê, apaga e revalida
// device-token.api.ts
export const DEVICE_TOKEN_KEY = 'sgs-device-token';
export const REGISTER_DEVICE_TOKEN: DocumentNode; export const UNREGISTER_DEVICE_TOKEN: DocumentNode;
export async function registerDeviceToken(token: string): Promise<void>;          // mutate + localStorage.setItem(DEVICE_TOKEN_KEY)
export async function unregisterCurrentDeviceToken(): Promise<void>;             // se houver token local: mutate; SEMPRE remove a chave (finally)
// native-push.ts
export const PUSH_CHANNEL_ID = 'agenda';
export const PUSH_ASKED_KEY = 'sgs-push-asked';
export interface PushListenerHandlers { onToken(token: string): void; onOpenRoute(route: string): void; onForeground(title: string, body: string): void }
export async function addPushListeners(h: PushListenerHandlers): Promise<() => void>;   // no-op fora do app
export async function registerForPush(): Promise<'registered' | 'denied' | 'skipped'>;  // canal + permissão (1x) + register()
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Biblioteca nativa (platform, push-route, device-token.api, native-push) com @capacitor/* mockado</name>
  <files>apps/frontend/src/infrastructure/native/platform.ts, apps/frontend/src/infrastructure/native/push-route.ts, apps/frontend/src/infrastructure/native/native-push.ts, apps/frontend/src/infrastructure/native/device-token.api.ts, apps/frontend/src/infrastructure/native/__tests__/push-route.test.ts, apps/frontend/src/infrastructure/native/__tests__/use-native-push.test.ts, apps/frontend/src/infrastructure/native/__tests__/device-token-api.test.ts</files>
  <read_first>
    - packages/shared/src/push.ts (regras a copiar: AGENDA_ROUTE_RE, isAllowedPushRoute)
    - packages/shared/src/graphql/device-tokens.ts (texto das mutations a copiar)
    - apps/frontend/src/infrastructure/apollo/client.ts (apolloClient)
    - apps/frontend/src/features/auth/api/auth.api.ts (padrão gql)
    - apps/frontend/src/test-setup.ts (mock de localStorage)
    - .planning/phases/07-app-android-gestor-beauty-com-capacitor/07-RESEARCH.md (Pattern 2, 3, 4; Code Examples "Hook de registro")
  </read_first>
  <behavior>
    - push-route: isAllowedPushRoute aceita '/agenda' e '/agenda?data=2026-11-20&visao=day&agendamento=x'; recusa 'https://evil.com/agenda', '//evil.com', '/agenda/../admin', '/comanda/1', 'javascript:alert(1)', 42, undefined
    - savePendingRoute('/agenda?data=2026-11-20&visao=day') grava em sessionStorage['sgs-pending-route']; savePendingRoute('/admin') não grava; consumePendingRoute() devolve a rota e apaga; segunda chamada devolve null; valor adulterado no storage ('/admin') → null
    - device-token.api: registerDeviceToken('tok') chama apolloClient.mutate com REGISTER_DEVICE_TOKEN e variables { input: { token: 'tok', platform: 'android', provider: 'fcm' } } e grava localStorage['sgs-device-token']='tok'; unregisterCurrentDeviceToken sem token local não chama mutate; com token local chama UNREGISTER com { token } e remove a chave MESMO se o mutate rejeitar (a rejeição se propaga para o chamador decidir)
    - native-push (vi.mock de '../platform', '@capacitor/push-notifications'): fora do app addPushListeners devolve função no-op e não importa o plugin; no app registra 'registration', 'pushNotificationActionPerformed' e 'pushNotificationReceived'; toque com data.route '/agenda?...' chama onOpenRoute; com data.route '/admin' ou sem route NÃO chama; recebido em primeiro plano chama onForeground(title, body); o retorno remove os 3 handles
    - registerForPush: cria canal { id: 'agenda', name: 'Agenda', importance: 4 }; permissão 'granted' → register() e 'registered'; 'prompt' e sem 'sgs-push-asked' → grava a chave, requestPermissions(), se granted register(); 'prompt' com a chave já gravada → não pede de novo e devolve 'denied'; 'denied' → 'denied' sem register; fora do app → 'skipped'
  </behavior>
  <action>
1. `platform.ts`: `import { Capacitor } from '@capacitor/core'; export function isNativeApp(): boolean { return Capacitor.isNativePlatform(); }`.
2. `push-route.ts`: cópia das regras do shared (comentário `// Cópia de packages/shared/src/push.ts — o Docker do frontend não enxerga o workspace.`) + `PENDING_ROUTE_KEY` em `sessionStorage` (try/catch: sem storage, ignora).
3. `device-token.api.ts`:
```ts
import { gql } from '@apollo/client';
import { apolloClient } from '@/infrastructure/apollo/client';

export const DEVICE_TOKEN_KEY = 'sgs-device-token';

// Mesmo texto de packages/shared/src/graphql/device-tokens.ts.
export const REGISTER_DEVICE_TOKEN = gql`
  mutation RegisterDeviceToken($input: RegisterDeviceTokenInput!) {
    registerDeviceToken(input: $input)
  }
`;
export const UNREGISTER_DEVICE_TOKEN = gql`
  mutation UnregisterDeviceToken($token: String!) {
    unregisterDeviceToken(token: $token)
  }
`;
```
   + as duas funções do contrato (`platform: 'android'`, `provider: 'fcm'`, sem `appVersion`).
4. `native-push.ts`: exatamente o contrato; sempre `if (!isNativeApp())` antes de `const { PushNotifications } = await import('@capacitor/push-notifications')`. `addPushListeners` NÃO cria canal nem pede permissão (só listeners, para captar o toque que abriu o app a frio — o plugin retém o evento até o primeiro listener). `registerForPush`: `createChannel({ id: PUSH_CHANNEL_ID, name: 'Agenda', description: 'Novos agendamentos e cancelamentos', importance: 4, visibility: 1 })`; `checkPermissions()`; trata `'prompt'` e `'prompt-with-rationale'` como prompt; grava `localStorage[PUSH_ASKED_KEY] = '1'` antes de `requestPermissions()`; `register()` só com `'granted'`.
5. Testes (escrever primeiro): `vi.mock('../platform', () => ({ isNativeApp: vi.fn(() => true) }))`, `vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: { addListener: vi.fn(async (ev, cb) => { handlers[ev] = cb; return { remove: vi.fn() }; }), createChannel: vi.fn(), checkPermissions: vi.fn(), requestPermissions: vi.fn(), register: vi.fn() } }))`, `vi.mock('@/infrastructure/apollo/client', () => ({ apolloClient: { mutate: vi.fn() } }))`. `beforeEach`: `localStorage.clear(); sessionStorage.clear()`.
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run src/infrastructure/native && corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "import('@capacitor/push-notifications')" apps/frontend/src/infrastructure/native/native-push.ts` encontra ≥ 1 linha
    - `grep -rn "from '@capacitor/push-notifications'" apps/frontend/src --include=*.ts --include=*.tsx | grep -v __tests__` não encontra import estático
    - `grep -n "registerDeviceToken(input: \$input)" apps/frontend/src/infrastructure/native/device-token.api.ts` encontra a linha
    - `grep -n "sgs-pending-route" apps/frontend/src/infrastructure/native/push-route.ts` e `grep -n "sgs-push-asked" apps/frontend/src/infrastructure/native/native-push.ts` encontram as linhas
    - `corepack pnpm --filter @sgs/frontend exec vitest run push-route use-native-push device-token-api` sai 0
  </acceptance_criteria>
  <done>Camada nativa testada, inerte no navegador, pronta para ser ligada no 07-08.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Agenda abre o atendimento indicado por ?agendamento= (D-14)</name>
  <files>apps/frontend/src/features/operations/pages/SchedulePage.tsx, apps/frontend/src/features/operations/__tests__/schedule-deep-link.test.tsx</files>
  <read_first>
    - apps/frontend/src/features/operations/pages/SchedulePage.tsx (linhas ~727-760: estado inicial de data/visão e detailsId; ~1254-1268: AppointmentDetailsDialog)
    - apps/frontend/src/features/operations/lib/agenda-link.ts (parseAgendaDate/parseAgendaView)
    - apps/frontend/src/features/operations/__tests__/agenda-gestor-beauty.test.tsx (mocks de AppointmentsQuery/TimeBlocksQuery/MembersQuery e render de SchedulePage)
    - apps/frontend/src/features/operations/__tests__/appointment-details-dialog.test.tsx (o que o diálogo mostra, para afirmar no teste)
  </read_first>
  <behavior>
    - Renderizar SchedulePage em MemoryRouter com initialEntries ['/agenda?data=2026-11-20&visao=day&agendamento=a1'] e mocks devolvendo o atendimento a1 nesse dia → o diálogo de detalhes abre com o atendimento a1 (afirmar pelo nome da cliente dentro do role 'dialog')
    - Depois de abrir, o parâmetro 'agendamento' é removido da URL (replace), então fechar o diálogo não o reabre
    - '?agendamento=inexistente' → nenhum diálogo abre e a agenda mostra o dia normalmente
    - Mudança de URL com a página já montada (navegar para '/agenda?data=2026-11-21&visao=day&agendamento=a2') → a data selecionada passa para 21/11 e o diálogo abre com a2 (toque na notificação com o app já na agenda)
  </behavior>
  <action>
Em `SchedulePage.tsx` (manter aspas duplas e estilo do arquivo):
1. Trocar `const [searchParams] = useSearchParams();` por `const [searchParams, setSearchParams] = useSearchParams();`.
2. `const deepLinkId = searchParams.get("agendamento");` e um efeito que, quando `deepLinkId` muda, sincroniza a data e a visão vindas da URL: `const d = parseAgendaDate(searchParams.get("data")); if (d) setSelectedDate(d); const v = parseAgendaView(searchParams.get("visao")); if (v) setView(v);`.
3. Outro efeito: quando `deepLinkId` existe e `appointmentsData?.appointments` contém `a.id === deepLinkId`, chamar `setDetailsId(deepLinkId)` e remover o parâmetro com `setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete("agendamento"); return next; }, { replace: true })`. Se os dados do dia carregaram e o id não está lá, também remover o parâmetro (sem abrir nada).
4. Não mexer em mais nada da página. Comentário curto: `// Fase 7 (D-14): toque na notificação abre o atendimento no dia.`
5. Teste `schedule-deep-link.test.tsx` com os casos do `<behavior>`, reaproveitando as fábricas/mocks de `agenda-gestor-beauty.test.tsx` (copiar o mínimo necessário; datas locais com `new Date(2026, 10, 20, 14, 0)`).
  </action>
  <verify>
    <automated>cd /root/sgs && corepack pnpm --filter @sgs/frontend exec vitest run schedule-deep-link agenda-gestor-beauty agenda-link && corepack pnpm --filter @sgs/frontend typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n '"agendamento"' apps/frontend/src/features/operations/pages/SchedulePage.tsx` encontra ≥ 2 linhas
    - `grep -n "setSearchParams" apps/frontend/src/features/operations/pages/SchedulePage.tsx` encontra a linha
    - `grep -c "it(" apps/frontend/src/features/operations/__tests__/schedule-deep-link.test.tsx` ≥ 3
    - `corepack pnpm --filter @sgs/frontend exec vitest run` (suíte toda) sai 0
  </acceptance_criteria>
  <done>A rota do push abre a agenda no dia certo com o atendimento aberto, inclusive com a página já montada.</done>
</task>

</tasks>

<verification>
- `corepack pnpm --filter @sgs/frontend exec vitest run` verde
- `corepack pnpm --filter @sgs/frontend typecheck && corepack pnpm --filter @sgs/frontend lint` verdes
- `corepack pnpm --filter @sgs/frontend build` verde (bundle web continua gerando; plugins em chunks dinâmicos)
</verification>

<success_criteria>
Toque → rota segura → agenda com o atendimento aberto (C-04), e registro/remoção do token pronto para ligar (C-03), sem efeito no navegador.
</success_criteria>

<output>
After completion, create `.planning/phases/07-app-android-gestor-beauty-com-capacitor/07-05-SUMMARY.md`
</output>
