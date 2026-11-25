import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import type { MockedResponse } from '@apollo/client/testing';
import '@/infrastructure/i18n';
import { toast } from 'sonner';
import { MemberAccessPanel } from '../components/MemberAccessPanel';
import {
  MemberAccessQuery,
  ResetMemberAccessMutation,
  SetMemberAccessMutation,
  type MemberAccessData,
} from '../access-admin.api';
import type { AccessItemData } from '../access.api';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

function item(
  id: string,
  label: string,
  group: string,
  groupLabel: string,
  extra: Partial<AccessItemData> = {},
): AccessItemData {
  return {
    id,
    label,
    group,
    groupLabel,
    enabled: true,
    defaultEnabled: true,
    source: 'DEFAULT',
    adjustable: true,
    lockReason: null,
    permissions: [],
    ...extra,
  };
}

function access(over: Partial<MemberAccessData> = {}): MemberAccessData {
  return {
    memberId: 'm2',
    displayName: 'Bruno Souza',
    roleName: 'ATTENDANT',
    editable: true,
    lockReason: null,
    adjustedCount: 0,
    items: [
      item('fin-previsao', 'Previsão de caixa', 'financeiro', 'Financeiro'),
      item('fin-comandas', 'Comandas', 'financeiro', 'Financeiro'),
      item('fin-admin', 'Só admin', 'financeiro', 'Financeiro', {
        enabled: false,
        adjustable: false,
        lockReason: 'Apenas Admin pode receber este item.',
      }),
      item('agenda', 'Agenda', 'operacao', 'Operação'),
    ],
    ...over,
  };
}

const queryMock = (a: MemberAccessData): MockedResponse => ({
  request: { query: MemberAccessQuery, variables: { memberId: 'm2' } },
  result: { data: { memberAccess: a } },
});

function setMock(
  changes: Array<{ itemId: string; enabled: boolean }>,
  result: MockedResponse['result'],
): MockedResponse {
  return {
    request: { query: SetMemberAccessMutation, variables: { input: { memberId: 'm2', changes } } },
    result,
  };
}

function renderPanel(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <MemberAccessPanel memberId="m2" />
    </MockedProvider>,
  );
}

describe('MemberAccessPanel', () => {
  it('agrupa por área e mostra texto Padrão do papel / Ajustado', async () => {
    const a = access({
      adjustedCount: 1,
      items: [
        item('fin-previsao', 'Previsão de caixa', 'financeiro', 'Financeiro', {
          enabled: false,
          source: 'DENIED',
        }),
        item('agenda', 'Agenda', 'operacao', 'Operação'),
      ],
    });
    renderPanel([queryMock(a)]);
    const fin = await screen.findByTestId('access-group-financeiro');
    expect(fin).toHaveTextContent('Financeiro');
    expect(screen.getByTestId('access-item-fin-previsao')).toHaveTextContent('Ajustado');
    expect(screen.getByTestId('access-item-agenda')).toHaveTextContent('Padrão do papel');
    expect(screen.getByRole('switch', { name: 'Previsão de caixa' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('clicar no switch envia a mudança e mostra "Acesso atualizado."', async () => {
    const saved = access({
      adjustedCount: 1,
      items: access().items.map((i) =>
        i.id === 'fin-previsao' ? { ...i, enabled: false, source: 'DENIED' as const } : i,
      ),
    });
    let called = false;
    const m = setMock([{ itemId: 'fin-previsao', enabled: false }], {
      data: { setMemberAccess: { access: saved, errors: [] } },
    });
    m.result = () => {
      called = true;
      return { data: { setMemberAccess: { access: saved, errors: [] } } };
    };
    renderPanel([queryMock(access()), m]);
    fireEvent.click(await screen.findByRole('switch', { name: 'Previsão de caixa' }));
    await waitFor(() => expect(called).toBe(true));
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Previsão de caixa' })).toHaveAttribute(
        'aria-checked',
        'false',
      ),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Acesso atualizado.');
    expect(screen.getByTestId('access-item-fin-previsao')).toHaveTextContent('Ajustado');
  });

  it('controle da área desliga só os itens ajustáveis e fica misto quando parte', async () => {
    const mixed = access({
      items: access().items.map((i) => (i.id === 'fin-comandas' ? { ...i, enabled: false } : i)),
    });
    const { unmount } = renderPanel([queryMock(mixed)]);
    const group = await screen.findByRole('switch', { name: 'Toda a área Financeiro' });
    expect(group).toHaveAttribute('aria-checked', 'mixed');
    unmount();

    let sent = false;
    const m = setMock(
      [
        { itemId: 'fin-previsao', enabled: false },
        { itemId: 'fin-comandas', enabled: false },
      ],
      { data: { setMemberAccess: { access: access(), errors: [] } } },
    );
    m.result = () => {
      sent = true;
      return { data: { setMemberAccess: { access: access(), errors: [] } } };
    };
    renderPanel([queryMock(access()), m]);
    const sw = await screen.findByRole('switch', { name: 'Toda a área Financeiro' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(sw);
    await waitFor(() => expect(sent).toBe(true));
  });

  it('item travado fica desabilitado e mostra o motivo', async () => {
    renderPanel([queryMock(access())]);
    const sw = await screen.findByRole('switch', { name: 'Só admin' });
    expect(sw).toBeDisabled();
    expect(sw).toHaveAttribute('aria-describedby', 'access-lock-fin-admin');
    expect(screen.getByText('Apenas Admin pode receber este item.')).toBeInTheDocument();
  });

  it('editable false trava tudo e mostra o motivo da pessoa', async () => {
    renderPanel([
      queryMock(access({ editable: false, lockReason: 'Você não pode ajustar o próprio acesso.' })),
    ]);
    expect(await screen.findByTestId('access-person-lock')).toHaveTextContent(
      'Você não pode ajustar o próprio acesso.',
    );
    for (const sw of screen.getAllByRole('switch')) expect(sw).toBeDisabled();
  });

  it('Voltar ao padrão: desabilitado sem ajustes; com ajustes pede confirmação e chama reset', async () => {
    const { unmount } = renderPanel([queryMock(access())]);
    expect(await screen.findByTestId('access-reset')).toBeDisabled();
    unmount();

    let done = false;
    const reset: MockedResponse = {
      request: { query: ResetMemberAccessMutation, variables: { memberId: 'm2' } },
      result: () => {
        done = true;
        return { data: { resetMemberAccess: { access: access(), errors: [] } } };
      },
    };
    renderPanel([queryMock(access({ adjustedCount: 2 })), reset]);
    const btn = await screen.findByTestId('access-reset');
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(await screen.findByText('Voltar ao padrão?')).toBeInTheDocument();
    expect(done).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao padrão' }));
    await waitFor(() => expect(done).toBe(true));
  });

  it('erro de domínio aparece em toast e o estado fica o do servidor', async () => {
    const m = setMock([{ itemId: 'fin-previsao', enabled: false }], {
      data: {
        setMemberAccess: {
          access: null,
          errors: [{ code: 'ACCESS_TARGET_ADMIN', message: 'Não é possível ajustar um Admin.', field: null }],
        },
      },
    });
    renderPanel([queryMock(access()), m]);
    fireEvent.click(await screen.findByRole('switch', { name: 'Previsão de caixa' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não é possível ajustar um Admin.'));
    expect(screen.getByRole('switch', { name: 'Previsão de caixa' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
