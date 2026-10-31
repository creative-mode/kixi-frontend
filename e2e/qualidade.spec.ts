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
const GESTOR = ['/manager', '/manager/school-year', '/manager/statements', '/manager/exam-rooms', '/manager/verification', '/manager/moderacao'];
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

    test('gestor: o erro do login fica no ecrã e é anunciado (#542)', async ({ page }) => {
      await page.goto('/manager/login');
      await page.getByLabel('Username ou email').fill('nao-existe');
      await page.locator('#password').fill('errada');
      await page.getByTestId('gestor-entrar-submeter').click();

      // O Next injecta um `role="alert"` próprio (anunciador de rota): identificar o nosso pela frase.
      const alerta = page.getByRole('alert').filter({ hasText: 'Utilizador ou palavra-passe' });
      await expect(alerta).toContainText('Utilizador ou palavra-passe incorretos.');

      // O defeito era o toast sumir aos ~4 s: passado mais tempo do que isso, tem de continuar.
      await page.waitForTimeout(6000);
      await expect(alerta).toBeVisible();
      await expect(page.getByLabel('Username ou email')).toHaveValue('nao-existe');

      // Um só <main>, o do layout: a página não repete o landmark.
      await expect(page.locator('main')).toHaveCount(1);
      expect(await graves(page), '/manager/login').toEqual([]);
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
  test('uma falha de carregamento do ranking oferece repetição', async ({ page }) => {
    await alunoLogin(page);
    await page.goto('/aluno/ranking');
    await page.waitForLoadState('networkidle');
    // Um aviso aparece quando o servidor falha ao carregar a aba (o ranking de amigos já tem dados reais).
    const definir = (mode: string) => page.request.post('/aluno/api/mock-fault', { data: { mode } });
    try {
      expect((await definir('500')).ok()).toBeTruthy();
      await page.getByRole('tab', { name: 'Escola' }).click();
      const aviso = page.getByRole('status', { name: 'Não foi possível carregar o ranking' });
      await expect(aviso).toBeVisible();
      await expect(aviso.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
    } finally {
      await definir('');
    }
  });
});

test.describe('ranking acessível (#498)', () => {
  test('sincroniza o título com o carregamento, liga a aba ao painel e mostra a unidade da média', async ({ page }) => {
    await alunoLogin(page);
    await page.goto('/aluno/ranking');

    const turma = page.getByRole('tab', { name: 'Turma' });
    const painel = page.getByRole('tabpanel');
    const painelId = await painel.getAttribute('id');
    expect(painelId).not.toBeNull();
    await expect(turma).toHaveAttribute('aria-controls', painelId ?? '');
    await expect(painel).toHaveAttribute('aria-busy', 'false');

    await page.route('**/aluno/ranking', async (route) => {
      if (route.request().method() === 'POST' && route.request().headers()['next-action']) {
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
      await route.continue();
    });

    await page.getByRole('tab', { name: 'Escola' }).click();
    await expect(page.getByRole('heading', { name: 'A carregar Escola…' })).toBeVisible();
    await expect(painel).toHaveAttribute('aria-busy', 'true');
    await expect(painel.getByRole('table')).toHaveCount(0);
    await expect(page.locator('[role="status"][aria-live="polite"]')).toContainText('A carregar o ranking da Escola.');

    await expect(page.getByRole('heading', { name: 'Ranking · Escola' })).toBeVisible();
    await expect(painel).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('[role="status"][aria-live="polite"]')).toContainText('Ranking da Escola carregado');
    await expect(painel.getByRole('table')).toBeVisible();
    await expect(painel.locator('tbody tr').first().locator('td').nth(2)).toContainText('%');
    await expect(painel.getByText(/A tua média:/)).toContainText('%');
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
    for (const [papel, nome] of [['button', /Conta de/], ['link', /Kixi, início/], ['link', /Pesquisar escolas/]] as const) {
      const caixa = await page.locator('header.sticky').getByRole(papel, { name: nome }).first().boundingBox();
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
    await page.getByRole('tab', { name: 'Definições' }).click();
    await expect(page.getByRole('button', { name: 'Terminar sessão' })).toBeVisible();
    const transborda = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(transborda, 'scroll horizontal no perfil').toBe(false);
    const botao = await page.getByRole('button', { name: 'Editar perfil' }).boundingBox();
    expect((botao?.x ?? 0) + (botao?.width ?? 0)).toBeLessThanOrEqual(390);
  });
});

/** O início no telemóvel (#493): a coluna da direita só existe a partir de `lg`,
 *  por isso o progresso e os atalhos passam a ter um cartão próprio em baixo. */
test.describe('progresso do aluno no telemóvel (#493)', () => {
  test.describe('a 375 px', () => {
    test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

    test('mostra nível, XP, streak, para rever e próximas provas sem abrir o perfil', async ({ page }) => {
      await alunoLogin(page);
      await page.goto('/aluno/inicio');

      const cartao = page.getByTestId('mobile-progresso');
      await expect(cartao).toBeVisible();
      await expect(cartao.getByRole('heading', { name: 'O teu progresso' })).toBeVisible();
      await expect(cartao.getByText('Nível 1')).toBeVisible();
      await expect(cartao.getByText('120 XP no total')).toBeVisible();
      await expect(cartao.getByText(/1 dia de sequência/)).toBeVisible();
      await expect(page.locator('aside[aria-label="Destaques"]')).toBeHidden();

      // As secções nascem recolhidas; abrir «Para rever» mostra o tema e o tutor.
      const rever = page.getByTestId('mobile-para-rever');
      await expect(rever).toBeVisible();
      await expect(rever.getByRole('link', { name: 'Rever com o tutor' })).toBeHidden();
      await rever.locator('summary').click();
      await expect(rever.getByRole('link', { name: 'Rever com o tutor' })).toBeVisible();

      const proximas = page.getByTestId('mobile-proximas-provas');
      await expect(proximas).toBeVisible();
      await expect(proximas.getByRole('link', { name: 'Ver todas as provas' })).toBeHidden();
      await proximas.locator('summary').click();
      await expect(proximas.getByRole('link', { name: 'Ver todas as provas' })).toBeVisible();

      const transborda = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(transborda, 'scroll horizontal no início do telemóvel').toBe(false);
    });
  });

  test('em ecrã grande só a coluna da direita mostra o progresso', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 860 });
    await alunoLogin(page);
    await page.goto('/aluno/inicio');
    await expect(page.getByTestId('mobile-progresso')).toBeHidden();
    await expect(page.locator('aside[aria-label="Destaques"]')).toBeVisible();
    await expect(page.locator('aside[aria-label="Destaques"]').getByRole('heading', { name: 'O teu progresso' })).toBeVisible();
  });
});

/** O 404 da landing (#544): endereço partido devolve "Esta página não existe" em
 *  português, na marca do site, com saída clara - e o banner de cookies nunca por
 *  cima de nada. Antes era o 404 de omissão do Next: inglês, sem marca, sem saída. */
test.describe('404 da landing (#544)', () => {
  async function semEscolha(page: Page) {
    await page.addInitScript(() => localStorage.removeItem('kixi-consent'));
  }

  test('404 com status certo, título em português, marca e saída', async ({ page, request }) => {
    const resposta = await request.get('/nao-existe-xyz');
    expect(resposta.status(), 'o status HTTP').toBe(404);

    await semEscolha(page);
    await page.goto('/nao-existe-xyz');
    await expect(page).toHaveTitle(/Página não encontrada · Kixi/);
    await expect(page.getByRole('heading', { level: 1, name: 'Esta página não existe' })).toBeVisible();
    // A marca: o cabeçalho leva de volta ao início ("Kixi, início") e o texto é o meu.
    await expect(page.getByRole('link', { name: 'Kixi, início' })).toBeVisible();
    const inicio = page.getByRole('link', { name: 'Ir para o início' });
    await expect(inicio).toBeVisible();
    expect(await inicio.getAttribute('href')).toBe('/');
    // O segundo caminho: entrar. O cabeçalho e o corpo têm o seu; o rodapé pode repetir.
    expect(
      await page.getByRole('link', { name: 'Entrar' }).count(),
      'pelo menos o do cabeçalho e o do corpo',
    ).toBeGreaterThanOrEqual(2);
  });

  test('sem violações sérias de acessibilidade, com o banner na página', async ({ page }) => {
    await semEscolha(page);
    await page.goto('/nao-existe-xyz');
    await page.waitForLoadState('networkidle');
    expect(await page.locator('section.ck').count(), 'o banner faz parte da página').toBe(1);
    expect(await graves(page)).toEqual([]);
  });

  test.describe('no telemóvel', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test('o banner de cookies por cima, mas sem tapar o conteúdo do 404', async ({ page }) => {
      await semEscolha(page);
      await page.goto('/nao-existe-xyz');
      const bnn = page.locator('section.ck');
      await expect(bnn).toBeVisible();
      // O botão principal acaba antes do topo do banner: nada do que interessa
      // fica escondido por baixo dele (a altura do banner é contrato de outra issue).
      const cta = page.getByRole('link', { name: 'Ir para o início' });
      await expect(cta).toBeVisible();
      const ctaBox = await cta.boundingBox();
      const caixa = await bnn.boundingBox();
      expect((ctaBox?.y ?? 0) + (ctaBox?.height ?? 0), 'o botão acaba antes do banner').toBeLessThanOrEqual(caixa!.y);
      // E o título da conversa é o primeiro que se vê.
      await expect(page.getByRole('heading', { name: 'Esta página não existe' })).toBeInViewport();
    });
  });
});

/** Contraste do LCD (#520): o verde médio sobre verde claro ficava nos 3:1, longe
 *  dos 4,5 do texto pequeno. O axe não via: com hachuras e máscaras por cima, o
 *  fundo é ambíguo e a regra cala-se. Por isso trava-se o par de tokens. */
test.describe('contraste do LCD (#520)', () => {
  /** WCAG 2.x: luminância relativa e rácio, os mesmos do axe. */
  function razao(a: string, b: string) {
    const lum = (hex: string) => {
      const h = hex.replace('#', '');
      const [r, g, bl] = [0, 2, 4].map((i) => {
        const c = parseInt(h.slice(i, i + 2), 16) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const [claro, escuro] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (claro + 0.05) / (escuro + 0.05);
  }

  async function tokens(page: Page) {
    return page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const ler = (nome: string) => cs.getPropertyValue(nome).trim();
      return { fundo: ler('--lcd-0'), fundoAlt: ler('--lcd-1'), texto: ler('--lcd-3') };
    });
  }

  test('texto pequeno do LCD com pelo menos 4,5:1 nos dois fundos', async ({ page }) => {
    await page.goto('/');
    const t = await tokens(page);
    expect(t.texto, 'token do texto').toMatch(/^#[0-9a-f]{6}$/);
    expect(razao(t.texto, t.fundo), 'texto sobre lcd-0').toBeGreaterThanOrEqual(4.5);
    expect(razao(t.texto, t.fundoAlt), 'texto sobre lcd-1').toBeGreaterThanOrEqual(4.5);
  });

  test('axe sem falta de contraste nas zonas LCD', async ({ page }) => {
    // Apontado às zonas desta issue (o axe cala-se onde o fundo é ambíguo;
    // a página inteira já é coberta pelos testes de acessibilidade).
    for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const { violations } = await new AxeBuilder({ page })
        .include('.aud')
        .include('.pres__art')
        .withRules(['color-contrast'])
        .analyze();
      expect(violations.map((v) => v.id), `${viewport.width}px`).toEqual([]);
    }
  });

  test.describe('movimento reduzido', () => {
    test.use({ contextOptions: { reducedMotion: 'reduce' } });

    test('axe sem falta de contraste no modo still', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const { violations } = await new AxeBuilder({ page })
        .include('.aud')
        .withRules(['color-contrast'])
        .analyze();
      expect(violations.map((v) => v.id), 'still').toEqual([]);
      // O modo still mostra o cartucho parado e a lista: texto pequeno legível.
      // Sem `exact`: no still o texto vive na lista ("Fotografa a prova. Em segundos…").
      await expect(page.locator('#solucao').getByText(/Fotografa a prova/)).toBeVisible();
    });
  });
});

/** O banner de cookies no telemóvel (#545): frase curta que se lê toda, dois botões
 *  do mesmo peso e foco que não rouba nem prende - nunca um quarto do ecrã por
 *  cima do formulário, como o visitante viu em produção. */
test.describe('banner de cookies no telemóvel (#545)', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  /** 12% da altura do viewport: se a cópia mudar, o limite acompanha. */
  const LIMITE = Math.floor(844 * 0.12);

  /** Sem escolha guardada: é o visitante da primeira vez que o critério mede. */
  async function semEscolha(page: Page) {
    await page.addInitScript(() => localStorage.removeItem('kixi-consent'));
  }

  const banner = (page: Page) => page.locator('section.ck, body > section[role="dialog"]').first();

  const paginas = ['/', '/doar', '/aluno/entrar', '/aluno/cadastro'] as const;

  test('cabe em pouco mais de um décimo do ecrã nas páginas de entrada', async ({ page }) => {
    await semEscolha(page);
    for (const rota of paginas) {
      await page.goto(rota);
      await expect(banner(page), `banner em ${rota}`).toBeVisible();
      const caixa = await banner(page).boundingBox();
      expect(caixa?.height ?? Infinity, rota).toBeLessThanOrEqual(LIMITE);
    }
  });

  test('o texto lê-se todo e o Saber mais está à vista', async ({ page }) => {
    await semEscolha(page);
    // Sem corte: o parágrafo cabe inteiro na caixa do banner - nada de texto
    // escondido com link focável no escuro.
    for (const rota of ['/', '/aluno/entrar'] as const) {
      await page.goto(rota);
      const bnn = banner(page);
      await expect(bnn).toBeVisible();
      const dentro = await bnn.evaluate((el) => {
        const b = el.getBoundingClientRect();
        const p = el.querySelector('p')?.getBoundingClientRect();
        return p ? { fundoBanner: b.bottom, fundoTexto: p.bottom } : null;
      });
      expect(dentro, `texto em ${rota}`).not.toBeNull();
      expect(dentro!.fundoTexto, `texto cortado em ${rota}`).toBeLessThanOrEqual(dentro!.fundoBanner);
    }
    // Na landing o Saber mais existe sempre: visível e dentro do banner.
    await page.goto('/');
    const bnn = banner(page);
    const saber = bnn.getByRole('link', { name: 'Saber mais' });
    await expect(saber, 'Saber mais na landing').toBeInViewport();
    const caixas = await bnn.evaluate((el) => {
      const b = el.getBoundingClientRect();
      const l = el.querySelector('a[href*="cookies"]')?.getBoundingClientRect();
      return l ? { fundo: b.bottom, link: l.bottom } : null;
    });
    expect(caixas, 'Saber mais dentro do banner').not.toBeNull();
    expect(caixas!.link, 'Saber mais cortado').toBeLessThanOrEqual(caixas!.fundo);
    // No aluno o link só existe com APP_ORIGIN (produção): em dev fica de fora
    // em vez de apontar a um 404, por isso aqui só se verifica o parágrafo.
  });

  test('o banner não tapa o botão principal das páginas de entrada', async ({ page }) => {
    await semEscolha(page);
    for (const rota of ['/doar', '/aluno/entrar', '/aluno/cadastro'] as const) {
      await page.goto(rota);
      const bnn = banner(page);
      await expect(bnn).toBeVisible();
      const botao =
        rota === '/doar'
          ? page.getByRole('button', { name: 'Continuar' })
          : page.getByTestId(rota === '/aluno/entrar' ? 'aluno-entrar-submeter' : 'aluno-cadastro-submeter');
      // Como quem termina o formulário: até ao fim da página, onde a folga
      // inferior reserva espaço para o banner. O doar não faz scroll.
      if (rota !== '/doar') {
        await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
      }
      const caixas = await page.evaluate(() => {
        const b = document.querySelector('section.ck, body > section[role="dialog"]')?.getBoundingClientRect();
        return b ? { topo: b.top } : null;
      });
      const cta = await botao.boundingBox();
      expect(caixas, `banner em ${rota}`).not.toBeNull();
      expect((cta?.y ?? Infinity) + (cta?.height ?? 0), `botão tapado em ${rota}`).toBeLessThanOrEqual(caixas!.topo);
    }
  });

  test('os dois botões pesam o mesmo: tamanho, borda e fundo', async ({ page }) => {
    await semEscolha(page);
    await page.goto('/aluno/entrar');
    await expect(banner(page)).toBeVisible();
    const botaos = banner(page).getByRole('button', { name: /Só necessários|Aceitar/ });
    await expect(botaos).toHaveCount(2);
    const pesos = await botaos.evaluateAll((els) =>
      els.map((el) => {
        const s = getComputedStyle(el);
        return `${s.fontSize}|${s.borderTopWidth}|${s.backgroundColor}|${s.borderTopColor}`;
      }),
    );
    expect(new Set(pesos).size, `pesos: ${pesos.join(' vs ')}`).toBe(1);
  });

  test('o foco começa no banner e o Esc devolve-o ao corpo da página', async ({ page }) => {
    await semEscolha(page);
    // No doar ninguém tem autofocus: a hidratação traz o foco para o banner,
    // sem prender quem navega com o Tab.
    await page.goto('/doar');
    await expect(banner(page)).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => (document.activeElement as HTMLElement)?.role === 'dialog'))
      .toBe(true);
    await page.keyboard.press('Escape');
    // Critério real: o corpo, não só "fora do banner".
    await expect
      .poll(() => page.evaluate(() => (document.activeElement as HTMLElement)?.tagName))
      .toBe('BODY');
  });

  test('o banner não rouba o foco de quem está a escrever', async ({ page }) => {
    // Foco antes da hidratação: o input é SSR, os scripts (e o efeito do banner)
    // vêm depois. Se o guarda funciona, o foco fica no campo e o banner aparece.
    await semEscolha(page);
    await page.goto('/aluno/entrar', { waitUntil: 'commit' });
    await page.locator('#usernameOrEmail').waitFor({ state: 'attached' });
    await page.evaluate(() => document.getElementById('usernameOrEmail')?.focus());
    await expect(banner(page)).toBeVisible();
    await expect(page.getByLabel('Utilizador ou email')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByLabel('Utilizador ou email')).toBeFocused();
  });

  test('escolher uma das opções fecha o banner e devolve o foco ao corpo', async ({ page }) => {
    await semEscolha(page);
    await page.goto('/aluno/entrar');
    await expect(banner(page)).toBeVisible();
    await banner(page).getByRole('button', { name: 'Só necessários' }).click();
    await expect(banner(page)).toHaveCount(0);
    // Sem autofocus no formulário, o destino honesto é o corpo: foco em lado nenhum visível.
    await expect
      .poll(() => page.evaluate(() => (document.activeElement as HTMLElement)?.tagName))
      .toBe('BODY');
  });
});

/** Doação sem ecrã cortado (#515): com altura fixa e scroll escondido, zoom, teclado
 *  virtual ou paisagem deixavam campos e botões fora de vista. */
test.describe('doação sem ecrã cortado (#515)', () => {
  async function semEscolha(page: Page) {
    await page.addInitScript(() => localStorage.removeItem('kixi-consent'));
  }

  /** Avança o passo 0 com um PDF: não passa pela análise de imagem, entra limpo. */
  async function carregarPdf(page: Page) {
    await page.locator('input[type="file"]').setInputFiles({
      name: 'enunciado.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'),
    });
    await expect(page.getByText('enunciado.pdf')).toBeVisible();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByLabel('Instituição')).toBeVisible();
  }

  /** Preenche o passo 1 e avança para o envio. */
  async function irParaEnvio(page: Page) {
    await carregarPdf(page);
    await page.getByLabel('Instituição').fill('Escola E2E');
    await page.getByLabel('Disciplina').fill('Matemática');
    await page.getByLabel('Tipo de prova').selectOption('Teste');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByLabel(/Tenho direito/)).toBeVisible();
  }

  /** Controlos do ecrã atual, sem a armadilha anti-robôs (invisível de propósito). */
  function controlos(page: Page) {
    return page.locator(
      'fieldset.dn-screen:not([hidden]) input:not([name="website"]):not([type="hidden"]), ' +
        'fieldset.dn-screen:not([hidden]) select, ' +
        'fieldset.dn-screen:not([hidden]) textarea, ' +
        'fieldset.dn-screen:not([hidden]) button',
    );
  }

  async function alcancaveis(page: Page, onde: string) {
    const els = controlos(page);
    const n = await els.count();
    expect(n, `controlos em ${onde}`).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const el = els.nth(i);
      await el.scrollIntoViewIfNeeded();
      await expect(el, `controlo ${i} em ${onde}`).toBeVisible();
    }
    const transborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(transborda, `scroll horizontal em ${onde}`).toBe(false);
  }

  async function botaoAcimaDoBanner(page: Page, nome: string) {
    const botao = page.getByRole('button', { name: nome, exact: true });
    await expect(botao, nome).toBeVisible();
    const bnn = page.locator('section.ck');
    await expect(bnn).toBeVisible();
    const [cta, caixa] = await Promise.all([botao.boundingBox(), bnn.boundingBox()]);
    expect((cta?.y ?? Infinity) + (cta?.height ?? 0), `${nome} tapado`).toBeLessThanOrEqual(caixa!.y);
  }

  test('zoom 200%: todos os campos e botões são alcançáveis', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await semEscolha(page);
    await page.goto('/doar');
    // Zoom real de 200% sobre 390×844: o CSS `zoom` é suportado no Chromium.
    await page.evaluate(() => {
      (document.documentElement.style as unknown as { zoom: string }).zoom = '2';
    });
    await alcancaveis(page, 'passo 0 em zoom 200%');
    await botaoAcimaDoBanner(page, 'Continuar');
    await carregarPdf(page);
    await alcancaveis(page, 'passo 1 em zoom 200%');
    for (const nome of ['Voltar', 'Continuar']) {
      const botao = page.getByRole('button', { name: nome });
      await botao.scrollIntoViewIfNeeded();
      await expect(botao, `${nome} em zoom 200%`).toBeVisible();
    }
    await irParaEnvio(page);
    await alcancaveis(page, 'passo 2 em zoom 200%');
    await botaoAcimaDoBanner(page, 'Doar');
  });

  test('o banner nunca cobre Continuar nem Doar', async ({ page }) => {
    // Precisa do banner compacto da #546: sem ele o botão fica por baixo.
    await page.setViewportSize({ width: 390, height: 844 });
    await semEscolha(page);
    await page.goto('/doar');
    await botaoAcimaDoBanner(page, 'Continuar');
    await irParaEnvio(page);
    await botaoAcimaDoBanner(page, 'Doar');
  });

  test('o texto de privacidade é visível no mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await semEscolha(page);
    await page.goto('/doar');
    await irParaEnvio(page);
    // Era `display: none` abaixo de 899 px: doar sem se identificar é uma
    // promessa que o telemóvel também tem de ler.
    await expect(page.getByText('Podes doar sem dizer quem és')).toBeVisible();
  });

  test('320×568: o primeiro ecrã é utilizável', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await semEscolha(page);
    await page.goto('/doar');
    await expect(page.getByRole('heading', { name: /Cada prova antiga/ })).toBeVisible();
    await expect(page.getByText('Toca para escolher fotos ou PDF')).toBeVisible();
    const continuar = page.getByRole('button', { name: 'Continuar' });
    await continuar.scrollIntoViewIfNeeded();
    await expect(continuar).toBeVisible();
    const bnn = page.locator('section.ck');
    await expect(bnn).toBeVisible();
    const [cta, caixa] = await Promise.all([continuar.boundingBox(), bnn.boundingBox()]);
    expect((cta?.y ?? Infinity) + (cta?.height ?? 0), 'Continuar tapado a 320×568').toBeLessThanOrEqual(caixa!.y);
    const transborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(transborda, 'scroll horizontal a 320×568').toBe(false);
  });
});
