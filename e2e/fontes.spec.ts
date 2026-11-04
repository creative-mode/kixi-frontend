import { test, expect, type Page } from '@playwright/test';

/**
 * As fontes vêm do next/font (#521): a família calculada é a que o next/font gera, e não o nome literal
 * «Plus Jakarta Sans» (que já não tem @font-face e cairia na fonte do sistema), e essa família está carregada.
 */
async function familia(page: Page, seletor: string) {
  return page.evaluate(async (sel) => {
    await document.fonts.ready;
    const el = document.querySelector(sel);
    if (!el) return { erro: `sem ${sel}` };
    const primeira = getComputedStyle(el).fontFamily.split(',')[0].trim();
    const peso = getComputedStyle(el).fontWeight;
    return { primeira, carregada: document.fonts.check(`${peso} 16px ${primeira}`) && [...document.fonts].some((f) => `"${f.family}"` === primeira || f.family === primeira) };
  }, seletor);
}

for (const [rota, seletor] of [['/', 'h1'], ['/doar', 'h1'], ['/aluno/entrar', 'h1'], ['/aluno/cadastro', 'body']] as const) {
  test(`${rota}: ${seletor} na Plus Jakarta Sans do next/font, já carregada`, async ({ page }) => {
    await page.goto(rota);
    const { primeira, carregada, erro } = await familia(page, seletor);
    expect(erro).toBeUndefined();
    expect(primeira, 'família do next/font, não o nome literal sem @font-face').not.toMatch(/^["']?Plus Jakarta Sans["']?$/);
    expect(primeira, 'família do next/font').toMatch(/jakarta/i);
    expect(carregada, `${primeira} carregada`).toBe(true);
  });
}

test('landing: o título pixel usa a Press Start 2P do next/font', async ({ page }) => {
  await page.goto('/');
  const pixel = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--font-pixel'));
  expect(pixel, '--font-pixel aponta para a variável do next/font').toMatch(/pixel|Press_Start/i);
});
