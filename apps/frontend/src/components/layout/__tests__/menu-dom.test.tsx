import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@/infrastructure/i18n';

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ logout: vi.fn(), applyAuthPayload: vi.fn() }),
}));

import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { IconRail } from '../IconRail';
import { AppDrawer } from '../AppDrawer';
import { SidebarNav } from '../SidebarNav';
import { PageHeader } from '../PageHeader';

// UX-10: aviso "item de lista dentro de item de lista" no console. A auditoria
// atribuiu ao menu; a causa estava na trilha (breadcrumb) do PageHeader, que
// aparece no topo de comanda, financeiro, comissões, noivas e contratos.
const AVISO = /validateDOMNesting|cannot appear as a descendant of|cannot be a descendant of|cannot be a child of/;

let spy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  useAuthStore.setState({ roleName: 'ADMIN' });
  spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  spy.mockRestore();
});

function avisosDeHtml(): string[] {
  return spy.mock.calls
    .map((args: unknown[]) => args.map(String).join(' '))
    .filter((m: string) => AVISO.test(m));
}

function expectHtmlDeListaValido(root: ParentNode) {
  expect(root.querySelectorAll('li > li')).toHaveLength(0);
  for (const li of Array.from(root.querySelectorAll('li'))) {
    expect(li.parentElement?.tagName, 'todo <li> dentro de <ul>/<ol>').toMatch(/^(UL|OL)$/);
  }
}

describe('UX-10 HTML válido no menu e na trilha do topo', () => {
  it('IconRail sem aviso e sem <li> dentro de <li>', () => {
    const { container } = render(
      <MemoryRouter>
        <IconRail />
      </MemoryRouter>,
    );
    expect(avisosDeHtml()).toEqual([]);
    expectHtmlDeListaValido(container);
  });

  it('AppDrawer (menu do celular) sem aviso e sem <li> dentro de <li>', () => {
    render(
      <MemoryRouter>
        <AppDrawer open onOpenChange={() => undefined} />
      </MemoryRouter>,
    );
    expect(avisosDeHtml()).toEqual([]);
    expectHtmlDeListaValido(document.body);
  });

  it('SidebarNav sem aviso e sem <li> dentro de <li>', () => {
    const { container } = render(
      <MemoryRouter>
        <SidebarNav />
      </MemoryRouter>,
    );
    expect(avisosDeHtml()).toEqual([]);
    expectHtmlDeListaValido(container);
  });

  it('trilha do PageHeader sem aviso e sem <li> dentro de <li>, mantendo os separadores', () => {
    const { container } = render(
      <MemoryRouter>
        <PageHeader
          title="Comanda C-2026-001"
          breadcrumbs={[
            { label: 'Financeiro', to: '/financeiro' },
            { label: 'Comandas', to: '/comanda' },
            { label: 'C-2026-001' },
          ]}
        />
      </MemoryRouter>,
    );
    expect(avisosDeHtml()).toEqual([]);
    expectHtmlDeListaValido(container);
    const itens = container.querySelectorAll('nav[aria-label="breadcrumb"] ol > li');
    expect(itens).toHaveLength(3);
    // 2 separadores (entre os 3 itens), escondidos do leitor de tela.
    expect(container.querySelectorAll('nav [role="presentation"][aria-hidden="true"]')).toHaveLength(2);
  });
});
