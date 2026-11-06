import { expect, test, type Locator } from '@playwright/test';
import { loginViaUi } from '../support/ui';
import { installReadOnlyGuard, loadAuditEnv } from './audit-helpers';

const env = loadAuditEnv();
const EVID = '../../.planning/phases/05-uso-no-dia-a-dia/05-audit-evidence/mobile';

async function alvo(el: Locator, nome: string) {
  const b = await el.boundingBox();
  expect(b, nome).not.toBeNull();
  expect(b!.width, `${nome}: largura`).toBeGreaterThanOrEqual(44);
  expect(b!.height, `${nome}: altura`).toBeGreaterThanOrEqual(44);
}

// Somente leitura: o guard bloqueia toda mutation de negócio; o diálogo é
// aberto e fechado com "Cancelar", sem salvar.
test('UX-02 e UX-03 no staging (celular, somente leitura)', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'só celular');
  const blocked: string[] = [];
  await installReadOnlyGuard(page, blocked);
  await loginViaUi(page, env.email, env.password);
  await page.goto('/agenda');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  const filtros = page.getByTestId('filters-open');
  await expect(filtros).toHaveText(/Filtros/);
  await alvo(filtros, 'Filtros');
  const avatares = page.getByTestId('prof-avatars').getByRole('button');
  const n = await avatares.count();
  const nomes: string[] = [];
  for (let i = 0; i < n; i++) {
    await alvo(avatares.nth(i), `avatar ${i}`);
    nomes.push((await avatares.nth(i).locator('span').nth(1).innerText()).trim());
  }
  console.log(`avatares: ${n}, nomes curtos: ${JSON.stringify(nomes.map((x) => x.length > 0))}`);
  await page.screenshot({ path: `${EVID}/05-10-agenda-dia.png` });

  await page.getByTestId('view-week').click();
  await page.screenshot({ path: `${EVID}/05-10-agenda-semana.png` });

  await filtros.click();
  const painel = page.getByRole('dialog');
  await alvo(painel.getByRole('button', { name: 'Todos', exact: true }), 'Todos');
  const pros = painel.getByRole('button', { name: / — (visível|oculto)$/ });
  const m = await pros.count();
  for (let i = 0; i < m; i++) await alvo(pros.nth(i), `profissional ${i}`);
  console.log(`painel: Todos + ${m} profissionais com 44 px`);
  await page.keyboard.press('Escape');
  await expect(painel).toBeHidden();

  await page.getByRole('button', { name: 'Agendar', exact: true }).click();
  await expect(page.getByTestId('visit-form')).toBeVisible();
  const corpo = page.getByTestId('visit-form-body');
  const b = await corpo.boundingBox();
  const vh = page.viewportSize()!.height;
  console.log(`corpo do formulário: ${Math.round(b!.height)}px de ${vh}px, largura ${Math.round(b!.width)}px`);
  expect(b!.height).toBeGreaterThanOrEqual(vh * 0.6);
  await expect(page.getByTestId('visit-scroll-hint')).toBeVisible();
  await page.screenshot({ path: `${EVID}/05-10-agenda-novo-agendamento.png` });
  await corpo.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  await expect(page.getByTestId('visit-scroll-hint')).toBeHidden();
  for (const id of ['visit-line-0-time', 'visit-line-0-duration', 'visit-add-line']) {
    const c = page.getByTestId(id);
    await c.scrollIntoViewIfNeeded();
    await expect(c).toBeInViewport();
  }
  await page.getByRole('button', { name: 'Cancelar' }).click();
  expect(blocked).toEqual([]);
});
