import { expect, test, type Locator } from '@playwright/test';
import { readSeedState } from '../support/seed-state';
import { loginViaUi } from '../support/ui';

// Agenda no celular (lote 2): UX-02 e UX-03.
test.use({ viewport: { width: 412, height: 915 }, hasTouch: true });

const MIN = 44;

async function expectAlvo44(el: Locator, nome: string) {
  const box = await el.boundingBox();
  expect(box, `${nome} sem caixa`).not.toBeNull();
  expect(box!.width, `${nome}: largura`).toBeGreaterThanOrEqual(MIN);
  expect(box!.height, `${nome}: altura`).toBeGreaterThanOrEqual(MIN);
}

test('UX-02: botão "Filtros" com texto e alvos de toque de 44 px', async ({ page }) => {
  const seed = readSeedState();
  await loginViaUi(page, seed.owner.email, seed.owner.password);
  await page.goto('/agenda');

  const filtros = page.getByTestId('filters-open');
  await expect(filtros).toBeVisible();
  await expect(filtros).toHaveText(/Filtros/);
  await expectAlvo44(filtros, 'Filtros');

  // Sem botões de profissionais na barra do topo: o filtro fica no painel (quick 261112-e7v).
  await expect(page.getByTestId('prof-avatars')).toHaveCount(0);

  // Painel de filtros: "Todos" e cada profissional com 44 px.
  await filtros.click();
  const painel = page.getByRole('dialog');
  await expect(painel).toBeVisible();
  // O painel entra deslizando; medir durante a animação dá larguras como 43,99998 px.
  await painel.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((an) => an.finished)),
  );
  const todos = painel.getByRole('button', { name: 'Todos', exact: true });
  await expectAlvo44(todos, 'Todos');
  const pros = painel.getByRole('button', { name: / — (visível|oculto)$/ });
  const m = await pros.count();
  expect(m).toBeGreaterThan(0);
  for (let i = 0; i < m; i++) await expectAlvo44(pros.nth(i), `profissional ${i}`);
});

test('UX-03: formulário de agendamento ocupa a tela e avisa que há mais campos', async ({
  page,
}) => {
  const seed = readSeedState();
  await loginViaUi(page, seed.owner.email, seed.owner.password);
  await page.goto('/agenda');

  await page.getByRole('button', { name: 'Agendar', exact: true }).click();
  const form = page.getByTestId('visit-form');
  await expect(form).toBeVisible();

  const corpo = page.getByTestId('visit-form-body');
  const box = await corpo.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(915 * 0.6);
  // Sem margem interna herdada do diálogo: o corpo usa a largura da tela.
  expect(box!.width).toBeGreaterThanOrEqual(400);

  // O rodapé com "Salvar" continua à vista.
  await expect(page.getByTestId('visit-submit')).toBeInViewport();

  const aviso = page.getByTestId('visit-scroll-hint');
  await expect(aviso).toHaveText('Role para ver mais campos');
  await expect(aviso).toBeVisible();

  await corpo.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  await expect(aviso).toBeHidden();

  for (const campo of [
    page.getByTestId('visit-line-0-time'),
    page.getByTestId('visit-line-0-duration'),
    page.getByTestId('visit-add-line'),
  ]) {
    await campo.scrollIntoViewIfNeeded();
    await expect(campo).toBeVisible();
    await expect(campo).toBeInViewport();
  }
});
