import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ContractAcceptPage } from '../public/ContractAcceptPage';
import { ContractDocument } from '../public/ContractDocument';
import { formatDateLongBR, parseBold, splitParagraphs } from '../lib/contract-rich-text';
import { debutanteAVistaSnapshot, noivaSnapshot } from './public-snapshot-fixture';

const CONTRACT = {
  orgName: 'Studio JS',
  code: 'CT-2030-001',
  eventDate: '2030-06-15',
  version: 1,
  text: 'CONTRATO DE TESTE\n<b>nao e html</b>',
  textSha256: 'a'.repeat(64),
  accepted: false,
  acceptedAt: null,
  acceptedName: null,
  isCurrentVersion: true,
  expiresAt: '2030-07-01T00:00:00.000Z',
  snapshot: null,
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/aceite/org-1/tok-1']}>
      <Routes>
        <Route path="/aceite/:orgId/:token" element={<ContractAcceptPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function fillForm(cpf = '529.982.247-25') {
  fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Maria da Silva' } });
  fireEvent.change(screen.getByLabelText('CPF da contratante'), { target: { value: cpf } });
  fireEvent.click(screen.getByLabelText('Li e aceito os termos deste contrato'));
}

describe('ContractAcceptPage', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renderiza o texto como texto puro e desabilita "Aceito" sem CPF válido', async () => {
    fetchMock.mockResolvedValueOnce(json(200, CONTRACT));
    renderPage();
    expect(await screen.findByText(/CONTRATO DE TESTE/)).toBeInTheDocument();
    expect(screen.getByText(/<b>nao e html<\/b>/)).toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'Aceito' });
    expect(button).toBeDisabled();
    fillForm('111.111.111-11');
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText('CPF da contratante'), { target: { value: '52998224725' } });
    expect(screen.getByLabelText('CPF da contratante')).toHaveValue('529.982.247-25');
    expect(button).toBeEnabled();
  });

  it('explica o que falta para habilitar "Aceito" (descrição acessível do botão)', async () => {
    fetchMock.mockResolvedValueOnce(json(200, CONTRACT));
    renderPage();
    await screen.findByText(/CONTRATO DE TESTE/);
    const button = screen.getByRole('button', { name: 'Aceito' });
    const all = 'Para aceitar, falta: nome completo, CPF válido e marcar “Li e aceito”.';
    expect(screen.getByText(all)).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-describedby', 'accept-missing-hint');
    expect(button).toHaveAccessibleDescription(all);

    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Maria da Silva' } });
    fireEvent.change(screen.getByLabelText('CPF da contratante'), { target: { value: '529.982.247-25' } });
    expect(button).toHaveAccessibleDescription('Para aceitar, falta: marcar “Li e aceito”.');

    fireEvent.click(screen.getByLabelText('Li e aceito os termos deste contrato'));
    expect(button).toBeEnabled();
    expect(screen.queryByText(/Para aceitar, falta/)).not.toBeInTheDocument();
    expect(button).not.toHaveAttribute('aria-describedby');
  });

  it('envia o aceite com textSha256 e mostra "Contrato aceito" com link do PDF', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, CONTRACT))
      .mockResolvedValueOnce(json(201, { accepted: true, acceptedAt: '2030-01-01T12:00:00.000Z' }));
    renderPage();
    await screen.findByText(/CONTRATO DE TESTE/);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Aceito' }));

    expect(await screen.findByText(/^Contrato aceito em/)).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toContain('/public/contracts/org-1/tok-1/accept');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      fullName: 'Maria da Silva',
      cpf: '529.982.247-25',
      accepted: true,
      textSha256: CONTRACT.textSha256,
    });
    const pdf = screen.getByRole('link', { name: 'Baixar PDF' });
    expect(pdf).toHaveAttribute('href', expect.stringContaining('/public/contracts/org-1/tok-1/pdf'));
  });

  it('404 mostra a mensagem de link inválido', async () => {
    fetchMock.mockResolvedValueOnce(json(404, { code: 'NOT_FOUND', message: 'Link inválido ou expirado.' }));
    renderPage();
    expect(
      await screen.findByText('Este link é inválido ou expirou. Peça um novo link ao estúdio.'),
    ).toBeInTheDocument();
  });

  it('409 TEXT_CHANGED mostra aviso de atualização', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, CONTRACT))
      .mockResolvedValueOnce(json(409, { code: 'TEXT_CHANGED', message: 'x' }));
    renderPage();
    await screen.findByText(/CONTRATO DE TESTE/);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Aceito' }));
    await waitFor(() =>
      expect(
        screen.getByText('O contrato foi atualizado. Recarregue a página para ler a nova versão.'),
      ).toBeInTheDocument(),
    );
  });

  it('429 mostra aviso de excesso de tentativas', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, CONTRACT))
      .mockResolvedValueOnce(new Response('Too Many Requests', { status: 429 }));
    renderPage();
    await screen.findByText(/CONTRATO DE TESTE/);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Aceito' }));
    expect(await screen.findByText('Muitas tentativas. Aguarde um minuto.')).toBeInTheDocument();
  });
});

describe('contract-rich-text', () => {
  it('parseBold, splitParagraphs e formatDateLongBR', () => {
    expect(parseBold('a **b** c')).toEqual([
      { text: 'a ', bold: false },
      { text: 'b', bold: true },
      { text: ' c', bold: false },
    ]);
    expect(splitParagraphs('a\nb\n\n\nc')).toEqual(['a\nb', 'c']);
    expect(formatDateLongBR('2026-11-04')).toBe('04 de novembro de 2026');
  });
});

describe('ContractDocument', () => {
  it('renderiza a noiva com orçamento, parcelas, negrito e assinaturas', () => {
    const { container } = render(<ContractDocument snapshot={noivaSnapshot} />);
    const doc = screen.getByLabelText('Texto do contrato');
    expect(doc).toHaveTextContent('Contratante: Maria da Silva');
    expect(doc).not.toHaveTextContent('Debutante:');
    expect(doc).toHaveTextContent('Pacote contratado: PACOTE GLAM');
    expect(doc).toHaveTextContent('(CONSULTORIA, TESTE)');
    expect(doc).toHaveTextContent('Serviço Adicional: Dia da noiva extra');
    expect(doc).toHaveTextContent('10% OFF');
    expect(doc).toHaveTextContent('- R$ 100,00');
    expect(doc).toHaveTextContent('Total: R$ 3.200,00');
    expect(doc).toHaveTextContent('SINAL 1/2');
    expect(doc).toHaveTextContent('SINAL 2/2');
    expect(doc).toHaveTextContent('RESTANTE PAGAMENTO');
    expect(doc).toHaveTextContent('Até 10 dias antes do evento');
    expect(doc).toHaveTextContent('Osasco, 04 de novembro de 2026');
    expect(doc).toHaveTextContent('CONTRATANTE');
    expect(doc).toHaveTextContent('STUDIO JÉSSICA SEIXAS BEAUTY');
    expect(container.querySelector('strong')).not.toBeNull();
    expect(screen.getByText('II. Do objeto:').tagName).toBe('STRONG');
    expect(container.querySelectorAll('th[scope="col"]').length).toBeGreaterThanOrEqual(5);
  });

  it('debutante à vista mostra Debutante e não mostra RESTANTE PAGAMENTO', () => {
    render(<ContractDocument snapshot={debutanteAVistaSnapshot} />);
    const doc = screen.getByLabelText('Texto do contrato');
    expect(doc).toHaveTextContent('Debutante: Ana da Silva');
    expect(doc).toHaveTextContent('À VISTA');
    expect(doc).not.toHaveTextContent('RESTANTE PAGAMENTO');
  });
});

describe('ContractAcceptPage com snapshot', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('usa o documento estruturado quando há snapshot', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json(200, { ...CONTRACT, snapshot: noivaSnapshot }));
    renderPage();
    const doc = await screen.findByLabelText('Texto do contrato');
    expect(doc).toHaveTextContent('Maria da Silva');
    expect(doc).toHaveTextContent('Orçamento');
    expect(screen.getAllByLabelText('Texto do contrato')).toHaveLength(1);
  });

  it('versão legada continua como texto corrido', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json(200, CONTRACT));
    renderPage();
    const doc = await screen.findByLabelText('Texto do contrato');
    expect(doc).toHaveTextContent('CONTRATO DE TESTE');
    expect(doc).not.toHaveTextContent('Orçamento');
  });
});
