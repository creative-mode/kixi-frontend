import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Qualidade que as jornadas felizes não apanham (#317): acessibilidade com axe-core, ecrãs de erro,
 * títulos por página e telemóvel. Estas verificações teriam falhado com o aviso partido, a prova sem
 * saída e os botões sem nome que chegaram a produção.
 */
const PASSWORD = process.env.E2E_PASSWORD ?? 'Kixi1234!';
const ADMIN = process.env.E2E_ADMIN_USERNAME ?? 'admin@kixi.ao';

test.setTimeout(120_000);

const VIEWPORTS = [
  { nome: 'portátil', size: { width: 1366, height: 860 } },
  { nome: 'telemóvel', size: { width: 390, height: 844 } },
] as const;

async function alunoLogin(page: Page) {
  await page.goto('/aluno/entrar');
  await page.getByLabel('Utilizador ou email').fill('12345');
  await page.locator('#password').fill(PASSWORD);
  await page.getByTestId('aluno-entrar-submeter').click();
  await expect(page).toHaveURL(/\/aluno\/inicio/);
}

async function gestorLogin(page: Page) {
  await page.goto('/manager/login');
  await page.getByLabel('Username ou email').fill(ADMIN);
  await page.locator('#password').fill(PASSWORD);
  await page.getByTestId('gestor-entrar-submeter').click();
  await expect(page).toHaveURL(/\/manager\/?$/);
}

/** Violações sérias ou críticas, em texto legível para o relatório. */
async function graves(page: Page) {
  const { violations } = await new AxeBuilder({ page }).disableRules(['region']).analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} x${v.nodes.length}: ${v.nodes[0]?.html.slice(0, 120)}`);
}

const ALUNO = ['/aluno/inicio', '/aluno/provas', '/aluno/ranking', '/aluno/perfil', '/aluno/prova/1/detalhe'];
const GESTOR = ['/manager', '/manager/school-year', '/manager/statements', '/manager/exam-rooms'];
const LANDING = ['/', '/doar', '/privacidade', '/cookies'];

for (const vp of VIEWPORTS) {
  test.describe(`acessibilidade, ${vp.nome}`, () => {
    test.use({ viewport: vp.size, isMobile: vp.size.width < 500 });

    test('aluno sem violações sérias', async ({ page }) => {
      await alunoLogin(page);
      for (const rota of ALUNO) {
        await page.goto(rota);
        await page.waitForLoadState('networkidle');
        expect(await graves(page), rota).toEqual([]);
        if (vp.size.width < 500) await test.info().attach(`aluno${rota.replaceAll('/', '-')}`, { body: await page.screenshot(), contentType: 'image/png' });
      }
    });

    test('gestor sem violações sérias', async ({ page }) => {
      await gestorLogin(page);
      for (const rota of GESTOR) {
        await page.goto(rota);
        await page.waitForLoadState('networkidle');
        expect(await graves(page), rota).toEqual([]);
      }
    });

    test('landing sem violações sérias', async ({ page }) => {
      for (const rota of LANDING) {
        await page.goto(rota);
        await page.waitForLoadState('networkidle');
        expect(await graves(page), rota).toEqual([]);
      }
    });
  });
}

test.describe('ecrãs de erro do aluno', () => {
  test('prova inexistente: em português, com saída e sem tentar de novo', async ({ page }) => {
    await alunoLogin(page);
    await page.goto('/aluno/prova/999999');
    await expect(page.getByText('Esta prova não existe ou já não está disponível.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Voltar às provas' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(/statement not found|not found/i);
  });

  test('página que não existe tem título e saída', async ({ page }) => {
    await alunoLogin(page);
    await page.goto('/aluno/nao-existe');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Voltar ao início' })).toBeVisible();
  });
});

test.describe('avisos do aluno', () => {
  test('um aviso sem ícone ocupa a largura toda e não parte o texto em colunas', async ({ page }) => {
    await alunoLogin(page);
    await page.goto('/aluno/ranking');
    await page.getByRole('tab', { name: 'Amigos' }).click();
    const aviso = page.locator('[data-slot="alert"]').first();
    await expect(aviso).toBeVisible();
    const caixa = await aviso.boundingBox();
    // Antes da correção o texto ficava numa coluna de largura zero: mais de 280 px de altura.
    expect(caixa!.height).toBeLessThan(120);
    expect(caixa!.width).toBeGreaterThan(250);
  });
});

test.describe('títulos', () => {
  test('cada página do aluno e do gestor tem o seu título', async ({ page }) => {
    const titulos = new Map<string, string>();
    const ver = async (rota: string) => {
      await page.goto(rota);
      await page.waitForLoadState('networkidle');
      const titulo = await page.title();
      expect(titulo, rota).not.toBe('');
      expect(titulos.get(titulo), `${rota} repete o título de ${titulos.get(titulo)}: ${titulo}`).toBeUndefined();
      titulos.set(titulo, rota);
    };
    await alunoLogin(page);
    for (const rota of ALUNO) await ver(rota);
    const ctx = await page.context().browser()!.newContext();
    const gestor = await ctx.newPage();
    await gestorLogin(gestor);
    for (const rota of GESTOR) {
      await gestor.goto(rota);
      await gestor.waitForLoadState('networkidle');
      const titulo = await gestor.title();
      expect(titulos.get(titulo), `${rota} repete o título de ${titulos.get(titulo)}: ${titulo}`).toBeUndefined();
      titulos.set(titulo, rota);
    }
    await ctx.close();
  });
});

/** Alvos de toque (#348): o axe só falha abaixo de 24 px; no telemóvel exigimos mais nos ecrãs principais. */
test.describe('alvos de toque no telemóvel', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('os alvos do aluno não ficam abaixo dos 24 px e o cabeçalho cumpre os 44 px', async ({ page }) => {
    await alunoLogin(page);
    for (const rota of ['/aluno/inicio', '/aluno/provas', '/aluno/perfil']) {
      await page.goto(rota);
      await page.waitForLoadState('networkidle');
      const pequenos = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('a,button,input:not([type=hidden]),select,textarea')]
          .filter((e) => {
            const r = e.getBoundingClientRect();
            const inline = e.tagName === 'A' && getComputedStyle(e).display === 'inline';
            return r.width > 0 && r.height > 0 && !e.closest('.sr-only') && !inline && (r.width < 24 || r.height < 24);
          })
          .map((e) => `${e.tagName} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)} ${(e.getAttribute('aria-label') ?? e.textContent ?? '').trim().slice(0, 30)}`),
      );
      expect(pequenos, rota).toEqual([]);
    }
    await page.goto('/aluno/inicio');
    for (const nome of [/Perfil de/, /Kixi, início/, /Procurar provas/]) {
      const caixa = await page.locator('header.sticky').getByRole('link', { name: nome }).first().boundingBox();
      expect(caixa?.height ?? 0, String(nome)).toBeGreaterThanOrEqual(44);
    }
  });
/** Backend a falhar (#350): o aluno fica na aplicação com uma mensagem e uma saída, nunca no login nem em branco. */
test.describe('backend a falhar', () => {
  for (const modo of ['500', 'timeout'] as const) {
    test(`com o servidor em ${modo} o aluno continua dentro e vê uma mensagem`, async ({ page }) => {
      await alunoLogin(page);
      const definir = (mode: string) => page.request.post('/aluno/api/mock-fault', { data: { mode } });
      try {
        expect((await definir(modo)).ok()).toBeTruthy();
        for (const rota of ['/aluno/inicio', '/aluno/provas', '/aluno/perfil']) {
          await page.goto(rota);
          await page.waitForLoadState('networkidle');
          await expect(page, rota).not.toHaveURL(/entrar/);
          await expect(page.locator('#conteudo, main').first(), rota).toContainText(/\S/);
          expect(await page.getByRole('button', { name: /tentar (de )?novo/i }).count() + (await page.getByRole('link', { name: /tentar (de )?novo/i }).count()), `${rota} sem «Tentar de novo»`).toBeGreaterThan(0);
        }
      } finally {
        await definir('');
      }
      await page.goto('/aluno/inicio');
      await expect(page).toHaveURL(/\/aluno\/inicio/);
    });
  }
});
