import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BridalScheduleEditor } from '../components/BridalScheduleEditor';
import { professionalKey, type ScheduleRow } from '../lib/schedule-rows';

const row = (key: string, role: string, personLabel: string): ScheduleRow => ({
  key,
  groupMemberId: key,
  personLabel,
  role,
  serviceId: 'sv1',
  serviceName: 'Maquiagem',
  professionalId: '',
  date: '2026-12-05',
  start: '',
  end: '',
});

function renderEditor(byService: Record<string, { id: string; name: string; isFixed?: boolean }[]>) {
  return render(
    <MemoryRouter>
      <BridalScheduleEditor
        rows={[row('a', 'bride', 'Ana'), row('b', 'companion', 'Bia')]}
        onChange={() => undefined}
        professionalsByService={byService}
      />
    </MemoryRouter>,
  );
}

describe('BridalScheduleEditor (11 D-19)', () => {
  it('professionalKey separa a lista da noiva da lista do serviço', () => {
    expect(professionalKey('sv1', 'bride')).toBe('sv1|bride');
    expect(professionalKey('sv1', 'companion')).toBe('sv1');
  });

  it('noiva usa a lista |bride e acompanhante usa a do serviço', () => {
    renderEditor({
      'sv1|bride': [{ id: 'p1', name: 'Paula', isFixed: true }],
      sv1: [
        { id: 'p1', name: 'Paula', isFixed: true },
        { id: 'p2', name: 'Paulo', isFixed: false },
      ],
    });
    const bride = within(screen.getByTestId('row-0-prof'));
    const comp = within(screen.getByTestId('row-1-prof'));
    expect(bride.queryByText('Paulo (não fixa)')).not.toBeInTheDocument();
    expect(bride.getByText('Paula')).toBeInTheDocument();
    expect(comp.getByText('Paulo (não fixa)')).toBeInTheDocument();
  });

  it('lista da noiva vazia mostra o aviso com link para /profissionais', () => {
    renderEditor({ 'sv1|bride': [], sv1: [{ id: 'p1', name: 'Paula', isFixed: true }] });
    const warn = screen.getByTestId('row-0-bride-empty');
    expect(warn).toHaveTextContent('Atende noiva/debutante');
    expect(within(warn).getByRole('link')).toHaveAttribute('href', '/profissionais');
    expect(screen.queryByTestId('row-1-bride-empty')).not.toBeInTheDocument();
  });
});
