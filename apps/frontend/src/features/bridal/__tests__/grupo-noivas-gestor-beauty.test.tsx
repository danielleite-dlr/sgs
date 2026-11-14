import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ServicesQuery } from '@/features/catalog/api/servicos.api';
import { useAuthStore } from '@/infrastructure/stores/auth.store';
import { BridalGroupQuery, type BridalGroupData } from '../api/bridal.api';
import { BridalTimelineQuery } from '../api/timeline.api';
import { BridalScheduleEditor } from '../components/BridalScheduleEditor';
import { BridalTimelineTab } from '../components/BridalTimelineTab';
import { BridalGroupDetailPage } from '../pages/BridalGroupDetailPage';
import type { ScheduleRow } from '../lib/schedule-rows';
import { debutanteGroup, group, member } from './bridal-fixtures';

const servicesMock: MockedResponse = {
  request: { query: ServicesQuery },
  variableMatcher: () => true,
  maxUsageCount: 20,
  result: { data: { services: [] } },
};

function renderPage(g: BridalGroupData & { __typename: string }) {
  const mock: MockedResponse = {
    request: { query: BridalGroupQuery },
    variableMatcher: () => true,
    maxUsageCount: 20,
    result: { data: { bridalGroup: g } },
  };
  return render(
    <MockedProvider mocks={[mock, servicesMock]}>
      <MemoryRouter initialEntries={['/noivas/g1']}>
        <Routes>
          <Route path="/noivas/:id" element={<BridalGroupDetailPage />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

afterEach(() => {
  useAuthStore.setState({ roleName: null });
});

const noiva = group({
  id: 'g1',
  name: 'Noiva julia Souza',
  eventTime: '16:00',
  readyBy: '2026-12-05T17:00:00.000Z',
  packageName: 'Glam',
  members: [
    member({
      id: 'm1',
      role: 'bride',
      clientName: 'JULIA SOUZA',
      clientPhone: '11987654321',
      coveredByContract: true,
    }),
    member({ id: 'm2', clientName: 'bia da Silva' }),
  ],
});

describe('Grupo de noivas no padrão Gestor Beauty', () => {
  it('título e trilha usam o nome padronizado, sem maiúsculas forçadas', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    renderPage(noiva);
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Noiva Julia Souza');
    const atual = document.querySelector('[aria-current="page"]') as HTMLElement;
    expect(atual.textContent).toBe('Noiva Julia Souza');
    expect(atual.className).not.toContain('uppercase');
    expect(screen.getByRole('link', { name: 'Noivas' }).className).not.toContain('uppercase');
  });

  it('a ficha do evento tem rótulos pequenos e horários tabulares', async () => {
    renderPage(noiva);
    const ficha = await screen.findByTestId('bg-detail-sheet');
    expect(ficha.className).toContain('rounded-md border border-neutral-200 bg-white');
    const dts = ficha.querySelectorAll('dt');
    expect(dts.length).toBeGreaterThan(4);
    dts.forEach((dt) => {
      expect(dt.className).toContain('text-overline uppercase text-neutral-500');
    });
    expect(screen.getByTestId('bg-detail-event-time').className).toContain('tabular-nums');
    expect(screen.getByTestId('bg-detail-ready-by').className).toContain('tabular-nums');
  });

  it.each([
    ['active', 'Ativo', 'before:bg-success-500'],
    ['completed', 'Concluído', 'before:bg-status-done'],
    ['cancelled', 'Cancelado', 'before:bg-error-500'],
  ])('status %s vira selo com ponto', async (status, label, ponto) => {
    renderPage(group({ id: 'g1', status }));
    const badge = await screen.findByTestId('group-status');
    expect(badge).toHaveTextContent(label);
    expect(badge.className).toContain(ponto);
  });

  it('responsável vazio aparece como "não definida" em aviso', async () => {
    renderPage(debutanteGroup({ id: 'g1', responsibleClientId: null, responsibleName: null }));
    const dd = await screen.findByTestId('bg-detail-responsible');
    expect(dd).toHaveTextContent('não definida');
    expect(dd.querySelector('span')?.className).toContain('text-warning-700');
  });

  it('pessoas: nome em serifa e caixa normal, cobertura em selo com ponto', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    renderPage(noiva);
    const linha = await screen.findByTestId('member-m1');
    const nome = linha.querySelector('.font-serif') as HTMLElement;
    expect(nome.textContent).toBe('Julia Souza');
    expect(nome.className).not.toContain('uppercase');
    expect(screen.getByTestId('member-m2')).toHaveTextContent('Bia da Silva');
    expect(linha).toHaveTextContent('(11) 98765-4321');
    expect(screen.getByTestId('coverage-badge-m1').className).toContain('before:bg-success-500');
    expect(screen.getByTestId('coverage-badge-m2').className).toContain('before:bg-status-done');
    expect(screen.getByRole('heading', { level: 2, name: 'Pessoas do grupo' }).className).toContain(
      'font-serif text-headline-sm',
    );
    expect(linha.closest('thead, table')?.querySelector('thead')?.className).toContain(
      'bg-neutral-100 text-left text-overline uppercase text-neutral-500',
    );
  });

  it('cronograma da agenda: campos de 44 px, horas tabulares e cabeçalho novo', () => {
    const rows: ScheduleRow[] = [
      {
        key: 'r0',
        groupMemberId: 'm1',
        personLabel: 'Julia',
        role: 'bride',
        serviceId: 'sv1',
        serviceName: 'Maquiagem',
        professionalId: 'p1',
        professionalName: 'Paula',
        date: '2026-12-05',
        start: '08:00',
        end: '09:00',
      },
    ];
    render(
      <BridalScheduleEditor
        rows={rows}
        onChange={() => undefined}
        professionalsByService={{ sv1: [{ id: 'p1', name: 'Paula' }] }}
      />,
    );
    expect(screen.getByTestId('row-0-prof').className).toContain('h-11');
    expect(screen.getByTestId('row-0-start').className).toContain('h-11');
    expect(screen.getByTestId('row-0-start').className).toContain('tabular-nums');
    expect(screen.getByTestId('row-0-end').className).toContain('tabular-nums');
    expect(
      screen.getByTestId('schedule-editor').querySelector('thead')?.className,
    ).toContain('bg-neutral-100 text-left text-overline uppercase text-neutral-500');
  });

  it('aba do cronograma do dia usa títulos em serifa e campos de 44 px', async () => {
    useAuthStore.setState({ roleName: 'MANAGER' });
    const oficial: MockedResponse = {
      request: { query: BridalTimelineQuery },
      variableMatcher: () => true,
      maxUsageCount: 20,
      result: { data: { bridalTimeline: null } },
    };
    render(
      <MockedProvider mocks={[oficial]}>
        <BridalTimelineTab group={noiva} onChanged={() => undefined} />
      </MockedProvider>,
    );
    const h2 = await screen.findByRole('heading', { level: 2, name: 'Cronograma oficial' });
    expect(h2.className).toContain('font-serif text-headline-sm');
    expect(screen.getByRole('heading', { level: 2, name: 'Nova simulação' })).toBeInTheDocument();
    expect(screen.getByTestId('timeline-package').className).toContain('h-11');
    expect(screen.getByText('Pacote').className).toContain('text-overline uppercase');
  });
});
