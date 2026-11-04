import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { FORBIDDEN_REASONS } from '../landing/lib/forbidden-reasons';

/**
 * Cobertura dos pontos de entrada e dos estados difíceis (#523): axe nas rotas de entrada e de erro, os três
 * passos da doação, o 403 por motivo e o foco visível ao navegar por teclado. Corre no portátil, no Pixel 5 e
 * com movimento reduzido (`playwright.config.ts`).
 *
 * Nada aqui cria contas nem envia doações: o registo até ao onboarding e o envio da doação já têm jornada
 * própria (`journeys.spec.ts`, `qualidade.spec.ts`), e o mock é em memória.
 */
const PASSWORD = process.env.E2E_PASSWORD ?? 'Kixi1234!';

/** Violações sérias ou críticas, em texto legível para o relatório (como em `qualidade.spec.ts`). */
async function graves(page: Page) {
  const { violations } = await new AxeBuilder({ page }).disableRules(['region']).analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} x${v.nodes.length}: ${v.nodes[0]?.html.slice(0, 120)}`);
}

const ENTRADA = ['/aluno/entrar', '/aluno/cadastro', '/aluno/recuperar', '/manager/login', '/manager/recuperar'];
const ERRO = ['/nao-existe-523', '/aluno/nao-existe-523', '/403', '/403?reason=role', '/403?reason=student-manager', '/403?reason=manager'];

// Um teste por rota: o relatório diz qual falhou, e nenhuma partilha o prazo de outra.
for (const rota of [...ENTRADA, ...ERRO]) {
  test(`axe sem violações sérias: ${rota}`, async ({ page }) => {
    await page.goto(rota);
    await page.waitForLoadState('networkidle');
    expect(await graves(page), rota).toEqual([]);
  });
}

test('403: cada motivo com o seu texto e destino, e o desconhecido neutro', async ({ page }) => {
  for (const [reason, config] of Object.entries(FORBIDDEN_REASONS)) {
    await page.goto(`/403?reason=${reason}`);
    await expect(page.getByText(config.message), reason).toBeVisible();
    await expect(page.getByRole('link', { name: config.primary.label }), reason).toHaveAttribute('href', config.primary.href);
  }
  await page.goto('/403?reason=qualquer-coisa');
  await expect(page.getByText('Não tens permissão para abrir esta página.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Voltar ao início' }).first()).toHaveAttribute('href', '/');
});

test('doação: os três passos sem violações sérias', async ({ page }) => {
  await page.goto('/doar');
  await page.waitForLoadState('networkidle');
  expect(await graves(page), '/doar passo 1 (enunciado)').toEqual([]);

  // Uma folha com texto, que passa a análise de qualidade: o passo 2 é sempre alcançado, não depende de sementes.
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1600;
    const context = canvas.getContext('2d')!;
    const image = context.createImageData(canvas.width, canvas.height);
    let seed = 523;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const offset = (y * canvas.width + x) * 4;
        const isText = y % 48 < 6 && x > 120 && x < 1080 && (x + Math.floor(y / 48) * 19) % 97 < 72;
        const shade = isText ? 22 : 244 + (seed % 9);
        image.data[offset] = shade;
        image.data[offset + 1] = shade;
        image.data[offset + 2] = shade;
        image.data[offset + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), 'image/png'));
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], 'prova.png', { type: 'image/png' }));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('.dn-files__item')).toHaveCount(1);
  await expect(page.locator('.dn-files__size')).not.toHaveText('a reduzir…', { timeout: 30_000 });

  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByLabel('Instituição')).toBeVisible();
  expect(await graves(page), '/doar passo 2 (origem)').toEqual([]);

  await page.getByLabel('Instituição').fill('Escola E2E');
  await page.getByLabel('Disciplina').fill('Matemática');
  await page.getByLabel('Tipo de prova').selectOption('Teste');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByLabel(/Tenho direito/)).toBeVisible();
  expect(await graves(page), '/doar passo 3 (envio)').toEqual([]);
});

test('landing → cadastro: o CTA leva ao formulário, sem violações sérias', async ({ page }) => {
  await page.goto('/');
  await page.locator('header.site-header').getByRole('link', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/aluno\/cadastro/);
  await expect(page.getByTestId('aluno-cadastro-submeter')).toBeVisible();
  expect(await graves(page), '/aluno/cadastro vindo da landing').toEqual([]);
});

/** O elemento com foco tem um indicador visível: contorno ou sombra, e está dentro do ecrã. */
async function focoVisivel(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return 'sem foco';
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const indicador = (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none';
    if (!indicador) return `sem indicador: ${el.outerHTML.slice(0, 80)}`;
    if (box.width < 1 || box.height < 1 || box.bottom < 0 || box.top > window.innerHeight) return `fora do ecrã: ${el.outerHTML.slice(0, 80)}`;
    return 'ok';
  });
}

test('teclado: o skip link aparece com foco visível e leva ao conteúdo', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kixi-consent', 'necessary'));
  for (const rota of ['/', '/doar']) {
    await page.goto(rota);
    // O Tab só vai para o skip link depois de a página estar pronta (a apresentação da landing hidrata tarde).
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Saltar para o conteúdo' }), rota).toBeFocused();
    expect(await focoVisivel(page), rota).toBe('ok');
    await page.keyboard.press('Enter');
    await expect(page.locator('main#conteudo'), rota).toBeFocused();
  }

  await page.goto('/aluno/entrar');
  await page.getByLabel('Utilizador ou email').fill('12345');
  await page.locator('#password').fill(PASSWORD);
  await page.getByTestId('aluno-entrar-submeter').click();
  await expect(page).toHaveURL(/\/aluno\/inicio/);
  await page.waitForLoadState('networkidle');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Saltar para o conteúdo' })).toBeFocused();
  expect(await focoVisivel(page), '/aluno/inicio').toBe('ok');
});

/** Atrasa a resposta do envio do formulário (a server action) para lá dos 4 s, sem mexer no servidor. */
async function atrasarEnvio(page: Page, caminho: string, ms: number) {
  await page.route(`**${caminho}`, async (route) => {
    if (route.request().method() === 'POST') await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue();
  });
}

// Um teste por app: cada um com a sua sessão (a do aluno levaria o login do gestor para outro lado).
for (const entrada of [
  { rota: '/aluno/entrar', utilizador: 'Utilizador ou email', valor: '12345', botao: 'aluno-entrar-submeter', depois: /\/aluno\/inicio/ },
  { rota: '/manager/login', utilizador: 'Nome de utilizador ou e-mail', valor: process.env.E2E_ADMIN_USERNAME ?? 'admin@kixi.ao', botao: 'gestor-entrar-submeter', depois: /\/manager\/?$/ },
]) {
  test(`login lento (#543) em ${entrada.rota}: passados 4 s diz que está a demorar, com o botão desativado`, async ({ page }) => {
    test.setTimeout(45_000);
    await atrasarEnvio(page, entrada.rota, 6000);
    await page.goto(entrada.rota);
    await page.getByLabel(entrada.utilizador).fill(entrada.valor);
    await page.locator('#password').fill(PASSWORD);
    const aviso = page.getByTestId('aviso-lento');
    await page.getByTestId(entrada.botao).click();
    await expect(page.getByTestId(entrada.botao), entrada.rota).toBeDisabled();
    await page.waitForTimeout(2500);
    await expect(aviso, `${entrada.rota}: antes dos 4 s não há aviso`).toHaveText('');
    await expect(aviso, entrada.rota).toContainText('Está a demorar mais do que o normal', { timeout: 4000 });
    await expect(page, entrada.rota).toHaveURL(entrada.depois, { timeout: 15_000 });
  });
}
