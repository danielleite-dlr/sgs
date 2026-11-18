import { expect, test } from '@playwright/test';

test.describe('Fase 8 - app instalável no iPhone', () => {
  test('manifest do Gestor Beauty é servido como standalone', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.status()).toBe(200);
    const manifest = await res.json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.name).toBe('Gestor Beauty');
  });

  test('service worker é servido e trata push', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain('showNotification');
  });

  test('a página liga o manifest e o apple-touch-icon', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  });

  test('apple-touch-icon existe', async ({ request }) => {
    const res = await request.get('/icons/apple-touch-icon-180.png');
    expect(res.status()).toBe(200);
  });
});
