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
    await page.waitForLoadState('networkidle');
    // Um aviso aparece quando o servidor falha ao carregar a aba (o ranking de amigos já tem dados reais).
    const definir = (mode: string) => page.request.post('/aluno/api/mock-fault', { data: { mode } });
    try {
      expect((await definir('500')).ok()).toBeTruthy();
      await page.getByRole('tab', { name: 'Escola' }).click();
      const aviso = page.locator('[data-slot="alert"]').first();
      await expect(aviso).toBeVisible();
      const caixa = await aviso.boundingBox();
      // Antes da correção o texto ficava numa coluna de largura zero: mais de 280 px de altura.
      expect(caixa!.height).toBeLessThan(120);
      expect(caixa!.width).toBeGreaterThan(250);
    } finally {
      await definir('');
    }
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
    for (const nome of [/Perfil de/, /Kixi, início/, /Pesquisar escolas/]) {
      const caixa = await page.locator('header.sticky').getByRole('link', { name: nome }).first().boundingBox();
      expect(caixa?.height ?? 0, String(nome)).toBeGreaterThanOrEqual(44);
    }
  });
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

  // O travão do tutor (#192) não pode falhar aberto: se a leitura das tentativas cair,
  // não se sabe se a prova está a correr. A conta 12345 tem uma tentativa viva na prova 2.
  test('com o servidor em baixo o tutor não abre durante a prova', async ({ page }) => {
    await alunoLogin(page);
    const definir = (mode: string) => page.request.post('/aluno/api/mock-fault', { data: { mode } });

    await page.goto('/aluno/tutor?statementId=2');
    await expect(page.getByRole('heading', { name: 'O tutor está fechado durante a prova' })).toBeVisible();

    try {
      expect((await definir('500')).ok()).toBeTruthy();
      await page.goto('/aluno/tutor?statementId=2');
      await expect(page.getByText('Não foi possível confirmar o estado da prova')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Voltar à prova' })).toBeVisible();
    } finally {
      await definir('');
    }

    await page.goto('/aluno/tutor?statementId=2');
    await expect(page.getByRole('heading', { name: 'O tutor está fechado durante a prova' })).toBeVisible();
  });
});

/** Amigos (#139): convidar, aceitar e o ranking de amigos com dados reais em vez de "chega em breve". */
test.describe('amigos e ranking de amigos', () => {
  test('o aluno aceita um pedido recebido e vê o amigo e o ranking de amigos', async ({ page }) => {
    await alunoLogin(page);
    await page.goto('/aluno/ranking');
    // Sem esperar pela hidratação o clique no separador perde-se na build de produção.
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: 'Amigos' }).click();
    await expect(page.getByRole('region', { name: 'Amigos' })).toBeVisible();
    await expect(page.getByText(/chega em breve|não está disponível/i)).toHaveCount(0);
    // A lista chega depois da hidratação: espera pela amiga que já está aceite antes de olhar para os pedidos.
    await expect(page.getByRole('region', { name: 'Amigos' })).toContainText('Sara P.');
    // O mock guarda o estado entre tentativas: numa repetição o pedido já foi aceite.
    const pedidos = page.getByRole('region', { name: 'Pedidos recebidos' });
    if (await pedidos.isVisible()) {
      await pedidos.getByRole('button', { name: 'Aceitar' }).click();
    }
    await expect(page.getByRole('region', { name: 'Amigos' })).toContainText('Nuno D.');
    await expect(pedidos).toHaveCount(0);
    expect(await graves(page)).toEqual([]);
  });
});

/** Comparação entre escolas (#129): consentimento, escolas com poucos alunos e a métrica de XP. */
test.describe('ranking global e métrica', () => {
  test('o global pede consentimento, explica porque está vazio e o XP muda a tabela', async ({ page }) => {
    await alunoLogin(page);
    await page.goto('/aluno/ranking');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: 'Global' }).click();
    // O mock guarda o consentimento entre tentativas: numa repetição já foi dado.
    const participar = page.getByRole('button', { name: 'Quero participar' });
    const retirar = page.getByRole('button', { name: /Deixar de participar/ });
    // Espera pela resposta do servidor: antes dela a página ainda mostra a tabela da aba anterior.
    await expect(page.getByText(/Comparar-te com alunos de outras escolas|pelo menos 10 alunos/)).toBeVisible();
    if (await participar.isVisible()) {
      // Um clique dado antes de a página reagir perde-se: repete até a explicação aparecer.
      await expect(async () => {
        if (await participar.isVisible()) await participar.click();
        await expect(page.getByText(/pelo menos 10 alunos/)).toBeVisible({ timeout: 2000 });
      }).toPass({ timeout: 15_000 });
    }
    await expect(page.getByText(/pelo menos 10 alunos/)).toBeVisible();
    await expect(retirar).toBeVisible();
    expect(await graves(page)).toEqual([]);
    await retirar.click();
    await expect(participar).toBeVisible();

    await page.getByRole('tab', { name: 'Turma' }).click();
    await page.getByLabel('Ordenar por').selectOption('xp');
    await expect(page.locator('th', { hasText: /^XP$/ })).toBeVisible();
    await page.getByLabel('Período').selectOption('month');
    // O período entra no pedido: sem erro, com a tabela ou com o estado vazio, mas nunca um aviso.
    await expect(page.getByLabel('Período')).toHaveValue('month');
    await expect(page.locator('th', { hasText: /^XP$/ }).or(page.getByText('Ainda não há dados'))).toBeVisible();
    await expect(page.locator('[data-slot="alert"]')).toHaveCount(0);
    expect(await graves(page)).toEqual([]);
  });

  test('no telemóvel os filtros das provas ficam recolhidos e aplicam-se ao mudar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/aluno/entrar');
    await page.getByLabel('Utilizador ou email').fill('12345');
    await page.locator('#password').fill(process.env.E2E_PASSWORD ?? 'Kixi1234!');
    await page.getByTestId('aluno-entrar-submeter').click();
    await expect(page).toHaveURL(/\/aluno\/inicio/);
    await page.goto('/aluno/provas');
    const filtros = page.getByRole('button', { name: /^Filtros/ });
    await expect(filtros).toBeVisible();
    await expect(page.getByLabel('Tipo de prova')).toBeHidden();
    await filtros.click();
    await expect(page.getByLabel('Tipo de prova')).toBeVisible();
    const opcao = await page.getByLabel('Tipo de prova').locator('option:not([value=""])').first().getAttribute('value');
    await page.getByLabel('Tipo de prova').selectOption(opcao!);
    await expect(page).toHaveURL(/tipo=/);
    await expect(page.getByRole('button', { name: /^Filtros \(1\)/ })).toBeVisible();
  });
});

test.describe('auditoria de UX do aluno', () => {
  test('no telemóvel o perfil não transborda e os campos cumprem os 44 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/aluno/entrar');
    const campos = await page.locator('input:not([type=hidden])').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
    expect(Math.min(...campos), 'altura dos campos').toBeGreaterThanOrEqual(44);
    const link = await page.getByRole('link', { name: 'Criar conta' }).boundingBox();
    expect(link?.height ?? 0).toBeGreaterThanOrEqual(44);
    await page.getByLabel('Utilizador ou email').fill('12345');
    await page.locator('#password').fill(process.env.E2E_PASSWORD ?? 'Kixi1234!');
    await page.getByTestId('aluno-entrar-submeter').click();
    await expect(page).toHaveURL(/\/aluno\/inicio/);
    await page.goto('/aluno/perfil');
    await expect(page.getByRole('button', { name: 'Terminar sessão' })).toBeVisible();
    const transborda = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(transborda, 'scroll horizontal no perfil').toBe(false);
    const botao = await page.getByRole('button', { name: 'Editar perfil' }).boundingBox();
    expect((botao?.x ?? 0) + (botao?.width ?? 0)).toBeLessThanOrEqual(390);
  });
});
