import 'reflect-metadata';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { REQUIRED_ACCESS_KEY } from '../decorators/require-access.decorator';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { ACCESS_GATES, ACCESS_ITEM_IDS } from './access-catalog';

const RESOLVER_TYPE_METADATA = 'graphql:resolver_type';
const RESOLVER_NAME_METADATA = 'graphql:resolver_name';

/**
 * Operações com @RequirePermission que NÃO levam item de acesso por desenho (fase 10).
 * Quem entra aqui precisa de motivo; o teste também falha se o nome deixar de existir.
 */
export const ACCESS_EXEMPT: ReadonlySet<string> = new Set([
  'members', // listas de seleção usadas por todas as telas (agenda, comissões, comanda)
  'allMembers', // idem, incluindo inativos, para históricos
  'professionalsForService', // escolha de profissional no agendamento, vale para quem agenda
  'suggestProfessionals', // fase 11: sugestão de profissional no agendamento, vale para quem agenda
  'pendingInvitations', // convites pendentes: gestão de equipe, não é uma área do menu
  'acceptInvitation', // convite aceito pelo próprio convidado
  'notifications', // sino de notificações: de todos, sem área
  'unreadNotificationCount', // contador do sino
  'markNotificationRead', // marca a própria notificação
  'markAllNotificationsRead', // marca as próprias notificações
  'registerDeviceToken', // push do próprio aparelho
  'unregisterDeviceToken', // push do próprio aparelho
  'pushConfig', // configuração pública de push para o app
  'myAccess', // o acesso efetivo da própria pessoa
]);

interface Op {
  file: string;
  method: string;
  operation: string;
  hasPermission: boolean;
  access: string[] | undefined;
}

function listResolverFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listResolverFiles(full, out);
    else if (entry.name.endsWith('.resolver.ts')) out.push(full);
  }
  return out;
}

function collectOperations(): Op[] {
  const root = path.resolve(__dirname, '../../');
  const ops: Op[] = [];
  for (const file of listResolverFiles(root)) {
    const mod = require(file) as Record<string, unknown>;
    for (const exported of Object.values(mod)) {
      if (typeof exported !== 'function' || !exported.prototype) continue;
      const proto = exported.prototype as Record<string, unknown>;
      const classPerm = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, exported) as unknown;
      const classAccess = Reflect.getMetadata(REQUIRED_ACCESS_KEY, exported) as string[] | undefined;
      for (const method of Object.getOwnPropertyNames(proto)) {
        const fn = proto[method];
        if (method === 'constructor' || typeof fn !== 'function') continue;
        const type = Reflect.getMetadata(RESOLVER_TYPE_METADATA, fn) as string | undefined;
        if (type !== 'Query' && type !== 'Mutation') continue;
        const name = (Reflect.getMetadata(RESOLVER_NAME_METADATA, fn) as string | undefined) || method;
        const perm = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, fn) ?? classPerm;
        const access = (Reflect.getMetadata(REQUIRED_ACCESS_KEY, fn) ?? classAccess) as
          | string[]
          | undefined;
        ops.push({
          file: path.relative(root, file),
          method,
          operation: name,
          hasPermission: !!perm,
          access,
        });
      }
    }
  }
  return ops;
}

describe('10 — inventário de acesso da API', () => {
  const ops = collectOperations();
  const guarded = ops.filter((o) => o.hasPermission);

  it('encontra as operações (sanidade do glob)', () => {
    expect(guarded.length).toBeGreaterThanOrEqual(150);
  });

  it('toda operação com @RequirePermission tem @RequireAccess ou está em ACCESS_EXEMPT', () => {
    const missing = guarded
      .filter((o) => !(o.access && o.access.length > 0) && !ACCESS_EXEMPT.has(o.operation))
      .map((o) => `${o.file}#${o.method} (${o.operation})`);
    expect(missing).toEqual([]);
  });

  it('todo item ou porteiro citado em @RequireAccess existe no catálogo', () => {
    const unknown = ops
      .flatMap((o) =>
        (o.access ?? [])
          .filter((id) => !ACCESS_ITEM_IDS.has(id) && !(id in ACCESS_GATES))
          .map((id) => `${o.file}#${o.method} cita "${id}"`),
      );
    expect(unknown).toEqual([]);
  });

  it('ACCESS_EXEMPT só lista operações que existem (sem apodrecer)', () => {
    const names = new Set(ops.map((o) => o.operation));
    const stale = [...ACCESS_EXEMPT].filter((n) => !names.has(n));
    expect(stale).toEqual([]);
  });
});
