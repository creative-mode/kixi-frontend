import { expect, test, type Page } from '@playwright/test';

/**
 * Analytics de produto atrás do consentimento (#219). O critério é verificável no
 * Network: sem «Aceitar», não sai um único pedido para o Google e a app funciona por
 * igual. Prende-se aqui para não regredir quando os eventos entrarem.
 */
const THIRD_PARTY = /(^|\.)(googletagmanager\.com|google-analytics\.com|doubleclick\.net)$/;

/** Todos os pedidos que saem para domínios de analytics de terceiros. */
function watchThirdParty(page: Page): string[] {
  const seen: string[] = [];
  page.on('request', (request) => {
    try {
      if (THIRD_PARTY.test(new URL(request.url()).hostname)) seen.push(request.url());
    } catch {
      // pedido sem URL válida: não é o caso que aqui se mede
    }
  });
  return seen;
}

test.describe('analítica atrás do consentimento (#219)', () => {
  test('sem escolha, o banner aparece e não sai nada para terceiros', async ({ page }) => {
    const terceiros = watchThirdParty(page);
    await page.goto('/');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(terceiros, 'antes de aceitar não pode haver pedidos a terceiros').toEqual([]);
  });

  test('«Só necessários» fecha o banner e não sai nada para terceiros', async ({ page }) => {
    const terceiros = watchThirdParty(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Só necessários' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // Recarregar prova que a escolha ficou guardada: o banner não volta e nada sai.
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(terceiros, 'depois de recusar não pode haver pedidos a terceiros').toEqual([]);
  });

  test('«Aceitar» carrega o Google Analytics', async ({ page }) => {
    // A CI constrói a landing com um `NEXT_PUBLIC_GA_ID` de teste (`.github/workflows/e2e.yml`).
    // Sem propriedade configurada não há script para carregar, por isso o teste salta fora da CI.
    test.skip(!process.env.NEXT_PUBLIC_GA_ID, 'precisa de NEXT_PUBLIC_GA_ID no build (a CI define)');
    // O script é servido localmente: o que se prova é que, consentido, o pedido sai.
    await page.route('**/googletagmanager.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }),
    );
    const pedidoGa = page.waitForRequest((request) => /googletagmanager\.com/.test(request.url()));
    await page.goto('/');
    await page.getByRole('button', { name: 'Aceitar' }).click();
    expect((await pedidoGa).url()).toContain('googletagmanager.com');
  });
});
