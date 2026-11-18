import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const caminhoSw = join(__dirname, '../../public/sw.js');
const codigo = readFileSync(caminhoSw, 'utf8');

type Handler = (event: unknown) => void;

function carregarSw(janelas: Array<{ url: string; focus: () => Promise<void>; postMessage: () => void }> = []) {
  const handlers: Record<string, Handler> = {};
  const self = {
    addEventListener: (type: string, fn: Handler) => {
      handlers[type] = fn;
    },
    registration: { showNotification: vi.fn(async (_t: string, _o: Record<string, unknown>) => {}) },
    clients: {
      matchAll: vi.fn(async () => janelas),
      openWindow: vi.fn(async () => {}),
      claim: vi.fn(async () => {}),
    },
    skipWaiting: vi.fn(),
    location: { origin: 'https://sgs.exemplo' },
  };
  vm.runInNewContext(codigo, { self, URL });
  return { handlers, self };
}

async function enviarPush(sw: ReturnType<typeof carregarSw>, json: () => unknown) {
  const promessas: Promise<unknown>[] = [];
  sw.handlers.push({ data: { json }, waitUntil: (p: Promise<unknown>) => promessas.push(p) });
  await Promise.all(promessas);
}

async function clicar(sw: ReturnType<typeof carregarSw>, data: unknown) {
  const promessas: Promise<unknown>[] = [];
  const close = vi.fn();
  sw.handlers.notificationclick({
    notification: { close, data },
    waitUntil: (p: Promise<unknown>) => promessas.push(p),
  });
  await Promise.all(promessas);
  return close;
}

describe('service worker de push', () => {
  it('mostra a notificação com título, corpo, tag e rota', async () => {
    const sw = carregarSw();
    const route = '/agenda?data=2026-11-20&visao=day&agendamento=abc';
    await enviarPush(sw, () => ({
      title: 'Novo agendamento',
      body: 'Ana · 14:00',
      data: { route, appointmentId: 'abc' },
    }));
    expect(sw.self.registration.showNotification).toHaveBeenCalledWith('Novo agendamento', {
      body: 'Ana · 14:00',
      icon: '/icons/icon-192.png',
      tag: 'appt-abc',
      data: { route },
    });
  });

  it('usa tag de grupo quando vem groupId', async () => {
    const sw = carregarSw();
    await enviarPush(sw, () => ({ title: 'Lote', data: { groupId: 'g1', route: '/agenda' } }));
    const opcoes = sw.self.registration.showNotification.mock.calls[0][1] as unknown as { tag: string };
    expect(opcoes.tag).toBe('grupo-g1');
  });

  it.each([
    ['sem data', () => ({ title: 'X' })],
    ['texto que não é JSON', () => { throw new Error('não é JSON'); }],
    ['título vazio', () => ({ title: '', body: 'b' })],
  ])('push %s ainda notifica com título padrão', async (_nome, json) => {
    const sw = carregarSw();
    await enviarPush(sw, json as () => unknown);
    const chamadas = sw.self.registration.showNotification.mock.calls;
    expect(chamadas).toHaveLength(1);
    if (_nome !== 'sem data') expect(chamadas[0][0]).toBe('Gestor Beauty');
  });

  it.each(['https://evil.com', '//evil.com', '/agenda/../admin', '/financeiro'])(
    'rota adulterada %s vira /agenda',
    async (route) => {
      const sw = carregarSw();
      await enviarPush(sw, () => ({ title: 'X', data: { route } }));
      const opcoes = sw.self.registration.showNotification.mock.calls[0][1] as unknown as {
        data: { route: string };
      };
      expect(opcoes.data.route).toBe('/agenda');
    },
  );

  it('clique com janela aberta foca e avisa o app, sem openWindow', async () => {
    const win = { url: 'https://sgs.exemplo/dashboard', focus: vi.fn(async () => {}), postMessage: vi.fn() };
    const sw = carregarSw([win]);
    const route = '/agenda?agendamento=abc';
    const close = await clicar(sw, { route });
    expect(close).toHaveBeenCalled();
    expect(win.focus).toHaveBeenCalled();
    expect(win.postMessage).toHaveBeenCalledWith({ type: 'sgs-open-route', route });
    expect(sw.self.clients.openWindow).not.toHaveBeenCalled();
  });

  it('clique sem janela abre a rota', async () => {
    const sw = carregarSw([]);
    await clicar(sw, { route: '/agenda?agendamento=abc' });
    expect(sw.self.clients.openWindow).toHaveBeenCalledWith('/agenda?agendamento=abc');
  });

  it('clique com rota adulterada abre /agenda', async () => {
    const sw = carregarSw([]);
    await clicar(sw, { route: 'https://evil.com' });
    expect(sw.self.clients.openWindow).toHaveBeenCalledWith('/agenda');
  });

  it('install e activate assumem o controle', async () => {
    const sw = carregarSw();
    sw.handlers.install({});
    expect(sw.self.skipWaiting).toHaveBeenCalled();
    const promessas: Promise<unknown>[] = [];
    sw.handlers.activate({ waitUntil: (p: Promise<unknown>) => promessas.push(p) });
    await Promise.all(promessas);
    expect(sw.self.clients.claim).toHaveBeenCalled();
  });

  it('não tem fetch, caches nem importScripts (D-03)', () => {
    expect(codigo).not.toContain("addEventListener('fetch'");
    expect(codigo).not.toContain('caches');
    expect(codigo).not.toContain('importScripts');
  });

  it('paridade: AGENDA_ROUTE_RE igual no sw.js, no push-route.ts e no shared', () => {
    const extrair = (arquivo: string) =>
      /AGENDA_ROUTE_RE = (\/.+\/);/.exec(readFileSync(arquivo, 'utf8'))?.[1];
    const sw = extrair(caminhoSw);
    expect(sw).toBeTruthy();
    expect(extrair(join(__dirname, '../infrastructure/native/push-route.ts'))).toBe(sw);
    expect(extrair(join(__dirname, '../../../../packages/shared/src/push.ts'))).toBe(sw);
  });
});
