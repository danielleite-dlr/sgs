import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PublicLeadFormPage } from '../public/PublicLeadFormPage';

const FORM = {
  orgName: 'Studio JS',
  consentText: 'Autorizo o contato por WhatsApp.',
  consentTextVersion: 'v1',
  successMessage: null,
};

function json(status: number, body: unknown) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
}

function renderPage(url = '/contato/o1/t1') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/contato/:orgId/:token" element={<PublicLeadFormPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function fill() {
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText(/Telefone/), { target: { value: '11999990000' } });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('PublicLeadFormPage', () => {
  it('token inválido mostra Formulário indisponível', async () => {
    fetchMock.mockReturnValueOnce(json(404, { code: 'NOT_FOUND', message: 'x' }));
    renderPage();
    expect(await screen.findByText('Formulário indisponível')).toBeInTheDocument();
  });

  it('mostra o salão e o consentimento; sem consentimento não chama o POST', async () => {
    fetchMock.mockReturnValueOnce(json(200, FORM));
    renderPage();
    expect(await screen.findByText('Studio JS')).toBeInTheDocument();
    expect(screen.getByText(FORM.consentText)).toBeInTheDocument();
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('É preciso autorizar o contato')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('honeypot fora da tela e vazio no POST; mostra a mensagem de sucesso', async () => {
    fetchMock
      .mockReturnValueOnce(json(200, FORM))
      .mockReturnValueOnce(json(201, { ok: true, message: 'Recebemos seu contato!' }));
    renderPage();
    await screen.findByText('Studio JS');
    const honey = document.querySelector('input[name="website"]') as HTMLInputElement;
    expect(honey.tabIndex).toBe(-1);
    expect(honey.autocomplete).toBe('off');
    expect((honey.parentElement as HTMLElement).style.left).toBe('-10000px');
    fill();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Recebemos seu contato!')).toBeInTheDocument();
    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body.website).toBe('');
    expect(body.consent).toBe(true);
    expect(body.kind).toBe('noiva');
    expect(fetchMock.mock.calls[1][0]).toContain('/public/leads/o1/t1');
  });

  it('400 mostra a mensagem do backend e 429 a de tentativas', async () => {
    fetchMock
      .mockReturnValueOnce(json(200, FORM))
      .mockReturnValueOnce(json(400, { code: 'PHONE_INVALID', message: 'Telefone inválido.' }))
      .mockReturnValueOnce(json(429, {}));
    renderPage();
    await screen.findByText('Studio JS');
    fill();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Telefone inválido.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(
      await screen.findByText('Muitas tentativas. Tente de novo em um minuto.'),
    ).toBeInTheDocument();
  });

  it('com ?embed=1 não mostra o cabeçalho', async () => {
    fetchMock.mockReturnValueOnce(json(200, FORM));
    renderPage('/contato/o1/t1?embed=1');
    await screen.findByLabelText('Nome');
    await waitFor(() => expect(screen.queryByText('Studio JS')).toBeNull());
  });
});
