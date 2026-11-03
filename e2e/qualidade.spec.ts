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
  await page.getByLabel('Nome de utilizador ou e-mail').fill(ADMIN);
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

/** Leva mesmo ao fim da página, mesmo que o conteúdo ainda esteja a crescer: o
 *  scroll de tiro único perdia-se quando o `scrollHeight` ainda não tinha os
 *  1800 ecrãs da apresentação — a cena do fim ficava `aria-hidden` e o
 *  `getByRole` nem a via ("element(s) not found"). */
async function irAoFim(page: Page) {
  await expect
    .poll(
      async () => {
        await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
        return page.evaluate(() => window.innerHeight + window.scrollY >= document.body.scrollHeight - 2);
      },
      { message: 'chegar ao fim da página', timeout: 15000 },
    )
    .toBe(true);
}

const ALUNO = ['/aluno/inicio', '/aluno/provas', '/aluno/ranking', '/aluno/perfil', '/aluno/prova/1/detalhe'];
const GESTOR = ['/manager', '/manager/school-year', '/manager/statements', '/manager/exam-rooms', '/manager/verification', '/manager/moderacao'];
const LANDING = ['/', '/doar', '/privacidade', '/cookies'];

/** Leva mesmo ao fim da página, mesmo que o conteúdo ainda esteja a crescer: o
 *  scroll de tiro único perdia-se quando o `scrollHeight` ainda não tinha os
 *  1800 ecrãs da apresentação — a cena do fim ficava `aria-hidden` e o
 *  `getByRole` nem a via ("element(s) not found"). */
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
      await page.getByLabel('Nome de utilizador ou e-mail').fill('nao-existe');
      await page.locator('#password').fill('errada');
      await page.getByTestId('gestor-entrar-submeter').click();

      // O Next injecta um `role="alert"` próprio (anunciador de rota): identificar o nosso pela frase.
      const alerta = page.getByRole('alert').filter({ hasText: 'Utilizador ou palavra-passe' });
      await expect(alerta).toContainText('Utilizador ou palavra-passe incorretos.');

      // O defeito era o toast sumir aos ~4 s: passado mais tempo do que isso, tem de continuar.
      await page.waitForTimeout(6000);
      await expect(alerta).toBeVisible();
      await expect(page.getByLabel('Nome de utilizador ou e-mail')).toHaveValue('nao-existe');

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
      // O erro anuncia-se como alerta (#529): a falha não é "status" passivo.
      const aviso = page.getByRole('alert', { name: 'Não foi possível carregar o ranking' });
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

  /** Avança o passo 0 com um PDF: não passa pela análise de imagem, entra limpo.
   *  Idempotente: cada upload gera um File novo (sem deduplicação possível). */
  async function carregarPdf(page: Page) {
    if ((await page.locator('.dn-files__item').count()) > 0) return;
    await page.locator('input[type="file"]').setInputFiles({
      name: 'enunciado.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'),
    });
    // O nome leva ellipsis e a 195 px pode ter área zero: o que prova o upload é
    // a linha do ficheiro e a contagem, não o nome.
    await expect(page.locator('.dn-files__item')).toHaveCount(1);
    await expect(page.getByText(/1 folha/)).toBeVisible();
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
    // Só o conteúdo da doação: o banner fixo (contrato da #546) também mexe no
    // scrollWidth do documento, e não é desta issue.
    const transborda = await page.evaluate(() => {
      const main = document.querySelector('.dn-main');
      return main ? main.scrollWidth > main.clientWidth + 1 : false;
    });
    expect(transborda, `scroll horizontal em ${onde}`).toBe(false);
  }

  async function botaoAcimaDoBanner(page: Page, nome: string) {
    const botao = page.getByRole('button', { name: nome, exact: true });
    await expect(botao, nome).toBeVisible();
    const bnn = page.locator('section.ck');
    await expect(bnn, 'banner presente').toHaveCount(1);
    // A reserva vem da altura medida: esperar por ela, senão mede-se antes do
    // efeito e o botão parece tapado sem estar.
    await expect
      .poll(
        () => page.evaluate(() => document.documentElement.style.getPropertyValue('--ck-banner-h')),
        'altura medida do banner',
      )
      .not.toBe('');
    // No fim da página, onde a folga inferior reserva espaço para o banner.
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    const [cta, caixa] = await Promise.all([botao.boundingBox(), bnn.boundingBox()]);
    expect((cta?.y ?? Infinity) + (cta?.height ?? 0), `${nome} tapado`).toBeLessThanOrEqual(caixa!.y);
  }

  test('zoom 200%: todos os campos e botões são alcançáveis', async ({ page }) => {
    // 200% sobre 390×844 em px de CSS: metade da largura e da altura. Sem CSS
    // `zoom`, que parte o posicionamento fixo do banner no Chromium.
    await page.setViewportSize({ width: 195, height: 422 });
    await semEscolha(page);
    await page.goto('/doar');
    await alcancaveis(page, 'passo 0 em zoom 200%');
    await carregarPdf(page);
    await alcancaveis(page, 'passo 1 em zoom 200%');
    for (const nome of ['Voltar', 'Continuar']) {
      const botao = page.getByRole('button', { name: nome });
      await botao.scrollIntoViewIfNeeded();
      await expect(botao, `${nome} em zoom 200%`).toBeVisible();
    }
    await irParaEnvio(page);
    await alcancaveis(page, 'passo 2 em zoom 200%');
    const doar = page.getByRole('button', { name: 'Doar', exact: true });
    await doar.scrollIntoViewIfNeeded();
    await expect(doar, 'Doar em zoom 200%').toBeVisible();
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

  test('360×640 e janela reduzida mantêm o CTA acima dos cookies', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await semEscolha(page);
    await page.goto('/doar');
    await expect(page.locator('section.ck')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--ck-banner-h')))
      .not.toBe('');
    await testInfo.attach('doar-360x640-cookies', { body: await page.screenshot(), contentType: 'image/png' });
    await botaoAcimaDoBanner(page, 'Continuar');

    // Reduzir o viewport simula o espaço visível que sobra quando o teclado
    // virtual está aberto num telemóvel.
    await page.setViewportSize({ width: 360, height: 400 });
    await expect(page.locator('.dn-stage')).toHaveCSS('height', '400px');
    await testInfo.attach('doar-360x400-teclado-cookies', { body: await page.screenshot(), contentType: 'image/png' });
    await botaoAcimaDoBanner(page, 'Continuar');
  });

  test('a foto grande é comprimida antes do POST e a nova tentativa é manual', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('kixi-consent'));
    await page.goto('/doar');

    // Gera uma folha vertical de 12,96 MB: textura leve para evitar uma imagem
    // artificialmente fácil de comprimir, com linhas horizontais de texto.
    const originalBytes = await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1800;
      canvas.height = 2400;
      const context = canvas.getContext('2d')!;
      const image = context.createImageData(canvas.width, canvas.height);
      let seed = 719;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          const offset = (y * canvas.width + x) * 4;
          const isText = y % 72 < 8 && x > 180 && x < 1600 && (x + Math.floor(y / 72) * 19) % 97 < 72;
          const shade = isText ? 22 : 244 + (seed % 9);
          image.data[offset] = shade;
          image.data[offset + 1] = shade;
          image.data[offset + 2] = shade;
          image.data[offset + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), 'image/png'));
      const file = new File([blob], 'prova-grande.png', { type: 'image/png' });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return file.size;
    });
    expect(originalBytes).toBeGreaterThan(2 * 1024 * 1024);
    await expect(page.locator('.dn-files__item')).toHaveCount(1);
    await expect(page.locator('.dn-files__size')).not.toHaveText('a reduzir…', { timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeEnabled();

    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('Instituição').fill('Escola E2E');
    await page.getByLabel('Disciplina').fill('Matemática');
    await page.getByLabel('Tipo de prova').selectOption('Teste');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel(/Tenho direito/).check();

    let attempts = 0;
    const observed: { sentFile: { name: string; bytes: number; width: number; height: number } | null } = { sentFile: null };
    await page.route('**/api/doar', async (route) => {
      attempts++;
      if (attempts === 1) {
        await route.abort('failed');
        return;
      }
      const request = route.request();
      const boundary = /boundary=([^;]+)/.exec(request.headers()['content-type'] ?? '')?.[1];
      const body = request.postDataBuffer();
      if (!boundary || !body) throw new Error('O POST não contém multipart/form-data.');
      const fileHeader = Buffer.from('Content-Disposition: form-data; name="files"; filename="');
      const headerAt = body.indexOf(fileHeader);
      const dataAt = body.indexOf(Buffer.from('\r\n\r\n'), headerAt) + 4;
      const dataEnd = body.indexOf(Buffer.from(`\r\n--${boundary}`), dataAt);
      const bytes = body.subarray(dataAt, dataEnd);
      let width = 0;
      let height = 0;
      for (let i = 2; i + 9 < bytes.length;) {
        if (bytes[i] !== 0xff) { i++; continue; }
        const marker = bytes[i + 1];
        const length = bytes.readUInt16BE(i + 2);
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
          height = bytes.readUInt16BE(i + 5);
          width = bytes.readUInt16BE(i + 7);
          break;
        }
        i += length + 2;
      }
      const filename = /filename="([^"]+)"/.exec(body.subarray(headerAt, dataAt).toString())?.[1] ?? '';
      observed.sentFile = { name: filename, bytes: bytes.length, width, height };
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ reference: 'KD-AB12-CD34' }) });
    });

    await page.getByRole('button', { name: 'Doar', exact: true }).click();
    await expect(page.getByText(/Sem ligação/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
    await page.waitForTimeout(300);
    expect(attempts, 'não repete o POST automaticamente').toBe(1);
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(page.getByText('KD-AB12-CD34')).toBeVisible();
    expect(attempts, 'reenvia apenas após ação explícita').toBe(2);
    expect(observed.sentFile?.name).toBe('prova-grande.jpg');
    expect(observed.sentFile?.bytes).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(Math.max(observed.sentFile?.width ?? Infinity, observed.sentFile?.height ?? Infinity)).toBeLessThanOrEqual(1600);
    expect(Math.min(observed.sentFile?.width ?? 0, observed.sentFile?.height ?? 0)).toBeGreaterThanOrEqual(900);
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

  test('a política abre noutra janela e anuncia isso', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/doar');
    await irParaEnvio(page);
    const policy = page.getByRole('link', { name: /Política de Privacidade.*abre noutra janela/ });
    await expect(policy).toHaveAttribute('target', '_blank');
    await expect(policy).toHaveAttribute('rel', 'noopener');
    const popupReady = page.waitForEvent('popup');
    await policy.click();
    const popup = await popupReady;
    await expect(popup).toHaveURL(/\/privacidade$/);
    await expect(page).toHaveURL(/\/doar$/);
    await expect(page.locator('.dn-files__item')).toHaveCount(1);
  });

  test('320×568: o primeiro ecrã é utilizável', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await semEscolha(page);
    await page.goto('/doar');
    await expect(page.getByRole('heading', { name: /Cada prova antiga/ })).toBeVisible();
    await expect(page.getByText('Toca para escolher fotos ou PDF')).toBeVisible();
    await botaoAcimaDoBanner(page, 'Continuar');
    const transborda = await page.evaluate(() => {
      const main = document.querySelector('.dn-main');
      return main ? main.scrollWidth > main.clientWidth + 1 : false;
    });
    expect(transborda, 'scroll horizontal a 320×568').toBe(false);
  });
});

/** Foco, setas e movimento reduzido na apresentação (#513): o CTA do fim era
 *  focável invisível, as setas estavam sequestradas e o modo parado chegava
 *  depois da hidratação, com a página a saltar de 1800 ecrãs para uma lista. */
test.describe('foco e movimento da apresentação (#513)', () => {
  /** Visitante da primeira vez: sem escolha guardada o banner aparece. */
  async function primeiraVisita(page: Page) {
    await page.addInitScript(() => localStorage.removeItem('kixi-consent'));
  }

  test('o CTA do fim só é focável quando está visível', async ({ page }) => {
    await primeiraVisita(page);
    await page.goto('/');
    // Por DOM e não por papel: apagada (`aria-hidden` + `inert`), a cena sai da
    // árvore de acessibilidade — que é exatamente o que se quer provar.
    const outro = page.locator('#solucao').locator('a', { hasText: 'Começar a estudar' });
    // No topo a cena do fim está apagada: focar é pedir e não receber.
    const noTopo = await outro.evaluate((el) => {
      (el as HTMLElement).focus();
      return document.activeElement === el;
    });
    expect(noTopo, 'CTA invisível não recebe foco').toBe(false);
    // No fim da história a cena acende e o botão entra no Tab.
    await irAoFim(page);
    const cenaOutro = page.locator('#solucao .pres__scene', { has: page.locator('a', { hasText: 'Começar a estudar' }) });
    await expect(cenaOutro, 'a cena do fim acende').toHaveAttribute('aria-hidden', 'false', { timeout: 15000 });
    await expect(outro).toBeVisible({ timeout: 15000 });
    const noFim = await outro.evaluate((el) => {
      (el as HTMLElement).focus();
      return document.activeElement === el;
    });
    expect(noFim, 'CTA visível recebe foco').toBe(true);
  });

  test('as setas mantêm o passo nativo', async ({ page }) => {
    await primeiraVisita(page);
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, 0));
    const antes = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(400);
    const delta = (await page.evaluate(() => window.scrollY)) - antes;
    expect(delta, 'a seta desce').toBeGreaterThan(0);
    // O passo nativo anda cerca de uma linha; o sequestro andava meio ecrã.
    expect(delta, 'passo nativo, não meio ecrã').toBeLessThan(200);
  });

  test.describe('movimento reduzido', () => {
    // `reducedMotion` não existe em `test.use` neste Playwright: vai por `contextOptions`.
    test.use({ contextOptions: { reducedMotion: 'reduce' } });

    test('sem salto de layout e sem os 1800 ecrãs', async ({ page }) => {
      await page.addInitScript(() => {
        (window as unknown as { __cls?: number }).__cls = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const e = entry as unknown as { hadRecentInput?: boolean; value?: number };
            if (!e.hadRecentInput) (window as unknown as { __cls?: number }).__cls! += e.value ?? 0;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await primeiraVisita(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);
      // O `reduced` só existe depois da hidratação: sem ele as cenas continuam
      // `aria-hidden` e a árvore de acessibilidade vem vazia.
      const secao = page.locator('#solucao');
      await expect
        .poll(() => secao.locator('[aria-hidden="false"]').count(), { message: 'hidratação do modo reduzido', timeout: 30000 })
        .toBeGreaterThan(0);
      await page.waitForTimeout(2000);
      // A apresentação nasce compacta: herói, cenas empilhadas e cartucho parado.
      const altura = await secao.evaluate((el) => el.getBoundingClientRect().height);
      const ecra = await page.evaluate(() => window.innerHeight);
      expect(altura, 'sem os 1800 ecrãs').toBeLessThan(8 * ecra);
      await expect(secao.getByRole('heading', { name: /Fotografa a prova/ })).toBeVisible();
      // O colapso de 1800 ecrãs para lista pontuava muito acima de 1; a troca
      // de webfont (`font-display: swap`, decisão de produto) mexe ~0.1 e não
      // é o salto que este teste vigia.
      const cls = await page.evaluate(() => (window as unknown as { __cls?: number }).__cls ?? 0);
      expect(cls, 'sem salto de layout').toBeLessThan(0.15);
      // Duas instâncias do cartucho no DOM (a animada escondida e a parada
      // visível), zero ids repetidos: com ids fixos o `url(#…)` resolvia para a
      // escondida e a visível perdia hachuras e filtro.
      const ids = await page.evaluate(() => {
        const todos = [...document.querySelectorAll('[id^="kx-"]')].map((el) => el.id);
        return { total: todos.length, unicos: new Set(todos).size };
      });
      expect(ids.total, 'há cartuchos com ids').toBeGreaterThan(0);
      expect(ids.unicos, 'ids repetidos no SVG').toBe(ids.total);
    });
  });
});

/** O CTA de registo da landing (#512): antes o 1.º ecrã só tinha "Entrar" e o
 *  "Começar a estudar" morava ~18 ecrãs abaixo, com a barra de scroll escondida. */
test.describe('CTA de registo da landing (#512)', () => {
  const FRASE = 'Estuda o que vai mesmo sair';

  async function semEscolha(page: Page) {
    await page.addInitScript(() => localStorage.removeItem('kixi-consent'));
  }

  /** O clique no CTA sai da landing para /aluno: um array em memória morria com
   *  a página, por isso o stub manda cada chamada `gtag` por sendBeacon para
   *  uma rota que o teste intercepta. */
  async function apanharCta(page: Page) {
    const eventos: unknown[][] = [];
    await page.route('**/__cta-teste', async (route) => {
      eventos.push(route.request().postDataJSON() as unknown[]);
      await route.fulfill({ status: 200, body: 'ok' });
    });
    await page.addInitScript(() => {
      (window as unknown as { gtag?: unknown }).gtag = (...args: unknown[]) => {
        void navigator.sendBeacon('/__cta-teste', JSON.stringify(args));
      };
    });
    return eventos;
  }

  test('telemóvel 360x640: Criar conta e Entrar visíveis sem scroll', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await semEscolha(page);
    await page.goto('/');
    const cabecalho = page.locator('header.site-header');
    const criar = cabecalho.getByRole('link', { name: 'Criar conta' });
    await expect(criar).toBeInViewport();
    await expect(criar).toHaveAttribute('href', '/aluno/cadastro');
    await expect(cabecalho.getByRole('link', { name: 'Entrar' })).toBeInViewport();
  });

  test('portátil 1366x768: registo, âncoras e herói com valor e saída', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await semEscolha(page);
    await page.goto('/');
    const cabecalho = page.locator('header.site-header');
    await expect(cabecalho.getByRole('link', { name: 'Criar conta' })).toBeInViewport();
    const solucao = cabecalho.getByRole('link', { name: 'Solução' });
    await expect(solucao).toBeVisible();
    await expect(solucao).toHaveAttribute('href', '#solucao');
    await expect(page.getByRole('heading', { name: /E se estudar fosse/ })).toBeVisible();
    await expect(page.getByText(FRASE)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Saltar a apresentação' })).toBeVisible();
  });

  test('saltar a apresentação a rato', async ({ page }) => {
    await semEscolha(page);
    await page.goto('/');
    await page.getByRole('link', { name: 'Saltar a apresentação' }).click();
    await expect(page).toHaveURL(/#modulos/);
    await expect(page.locator('#modulos h2')).toBeInViewport();
    // O foco segue para o destino: quem vai pelo teclado sente a chegada.
    await expect(page.locator('#modulos h2')).toBeFocused();
  });

  test('saltar a apresentação a teclado', async ({ page }) => {
    await semEscolha(page);
    await page.goto('/');
    const salto = page.getByRole('link', { name: 'Saltar a apresentação' });
    await salto.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#modulos/);
    await expect(page.locator('#modulos h2')).toBeInViewport();
    // O foco segue para o destino: quem vai pelo teclado sente a chegada.
    await expect(page.locator('#modulos h2')).toBeFocused();
  });

  test.describe('no telemóvel', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test('saltar a apresentação ao toque', async ({ page }) => {
      await semEscolha(page);
      await page.goto('/');
      await page.getByRole('link', { name: 'Saltar a apresentação' }).tap();
      await expect(page).toHaveURL(/#modulos/);
      await expect(page.locator('#modulos h2')).toBeInViewport();
      await expect(page.locator('#modulos h2')).toBeFocused();
    });
  });

  test.describe('movimento reduzido', () => {
    // `reducedMotion` não existe em `test.use` neste Playwright: vai por `contextOptions`.
    test.use({ contextOptions: { reducedMotion: 'reduce' } });

    test('herói com valor e salto, sem animação', async ({ page }) => {
      await semEscolha(page);
      await page.goto('/');
      await expect(page.getByRole('heading', { name: /E se estudar fosse/ })).toBeVisible();
      await expect(page.getByText(FRASE)).toBeVisible();
      await page.getByRole('link', { name: 'Saltar a apresentação' }).click();
      await expect(page).toHaveURL(/#modulos/);
    });
  });

  test('o clique regista a origem: header, outro e faq', async ({ page }) => {
    await semEscolha(page);
    const eventos = await apanharCta(page);
    await page.goto('/');

    await page.locator('header.site-header').getByRole('link', { name: 'Criar conta' }).click();
    await expect.poll(() => eventos.length, 'clique no header').toBe(1);
    expect(eventos[0]).toEqual(['event', 'cta_clique', { origem: 'header' }]);
    await page.goBack();

    // A hidratação pode chegar depois do `goBack`: sem o `#solucao` no DOM, o
    // scroll de baixo perdia-se (ainda sem ouvintes) e o CTA do fim nunca nascia.
    // Em runner carregado a hidratação demora: os 15 s são os dos testes irmãos.
    await expect(page.locator('#solucao')).toBeAttached({ timeout: 15000 });
    // O outro só fica clicável no fim da apresentação de 1800 ecrãs.
    await irAoFim(page);
    const outro = page.locator('#solucao').getByRole('link', { name: 'Começar a estudar' });
    await expect(outro).toBeVisible({ timeout: 15000 });
    await outro.click();
    await expect.poll(() => eventos.length, 'clique no outro').toBe(2);
    expect(eventos[1]).toEqual(['event', 'cta_clique', { origem: 'outro' }]);
    await page.goBack();

    const faq = page.locator('#perguntas').getByRole('link', { name: 'Começar a estudar' });
    await faq.scrollIntoViewIfNeeded();
    await faq.click();
    await expect.poll(() => eventos.length, 'clique no faq').toBe(3);
    expect(eventos[2]).toEqual(['event', 'cta_clique', { origem: 'faq' }]);
  });
});

/** Apresentação sem derreter o telemóvel (#514): o scroll alimentava um `setState`
 *  por frame e a demo do herói nunca parava. */
test.describe('apresentação sem derreter (#514)', () => {
  test('o h1 vem no HTML inicial, sem JS', async ({ request }) => {
    const res = await request.get('/');
    expect(res.ok()).toBeTruthy();
    const html = await res.text();
    expect(html).toContain('id="hero-title"');
    expect(html).toContain('E se estudar fosse');
  });

  test('a demo do herói congela após 5 segundos', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState('networkidle');
    // Passados os 5 s o intervalo pára: dois fotogramas com 1,2 s de distância
    // (17 ticks a 70 ms) têm de ser pixel a pixel iguais.
    await page.waitForTimeout(6000);
    const lcd = page.locator('.gb__lcd');
    await expect(lcd).toBeVisible();
    const a = await lcd.screenshot();
    await page.waitForTimeout(1200);
    const b = await lcd.screenshot();
    expect(a.equals(b), 'a demo continua a mexer').toBe(true);
  });

  test('scroll de uma ponta à outra sem tarefas longas em CPU fraca', async ({ page, context }) => {
    // Moto G4 aproximado: CPU 4× mais lenta. Aproximação ao INP p75 < 200 ms —
    // o p75 real é dado de campo; aqui trava-se o mecanismo (fio principal livre).
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    // Só a partir daqui: o que o carregamento (compiles, fontes) pesou antes
    // não é scroll e não entra na conta.
    const medida = await page.evaluate(() => new Promise<{ gaps: number[]; longas: number[] }>((done) => {
      const gaps: number[] = [];
      const longas: number[] = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) longas.push((e as PerformanceEntry & { duration: number }).duration);
      }).observe({ type: 'longtask' });
      const ts: number[] = [];
      const t0 = performance.now();
      const tick = (t: number) => {
        if (ts.length) gaps.push(t - ts[ts.length - 1]);
        ts.push(t);
        if (t - t0 < 8000) requestAnimationFrame(tick);
        else done({ gaps, longas });
      };
      requestAnimationFrame(tick);
      let i = 0;
      const passo = () => {
        if (i++ < 40) {
          window.scrollBy(0, window.innerHeight / 4);
          setTimeout(passo, 100);
        }
      };
      passo();
    }));
    const ordenados = [...medida.gaps].sort((a, b) => a - b);
    const p75 = ordenados[Math.floor(ordenados.length * 0.75)] ?? 0;
    expect(ordenados.length, 'houve frames com scroll').toBeGreaterThan(40);
    expect(Math.round(p75), 'p75 do intervalo entre frames').toBeLessThan(200);
    const maxima = medida.longas.length ? Math.max(...medida.longas) : 0;
    expect(Math.round(maxima), 'tarefa mais longa no scroll').toBeLessThan(200);
  });
});

/** Cache da landing (#522): HTML público com s-maxage, Markdown e raiz sem cache
 *  partilhada. Tudo por `request`, sem browser: são cabeçalhos, não pixels. */
test.describe('cache da landing (#522)', () => {
  test('HTML público sai com s-maxage e stale-while-revalidate', async ({ request }) => {
    for (const rota of ['/doar', '/privacidade', '/cookies', '/about', '/contact']) {
      const r = await request.get(rota, { headers: { Accept: 'text/html' } });
      expect(r.ok(), rota).toBeTruthy();
      const cc = r.headers()['cache-control'] ?? '';
      expect(cc, `${rota} s-maxage`).toContain('s-maxage');
      expect(cc, `${rota} swr`).toContain('stale-while-revalidate');
      expect(cc, `${rota} sem no-store`).not.toContain('no-store');
    }
  });

  test('Accept markdown recebe Markdown, nunca HTML em cache', async ({ request }) => {
    const r = await request.get('/doar', { headers: { Accept: 'text/markdown' } });
    expect(r.ok()).toBeTruthy();
    expect(r.headers()['content-type'] ?? '').toContain('text/markdown');
    // Servido no URL da página: uma cache por URL não o distingue do HTML,
    // por isso não se guarda em lado nenhum.
    expect(r.headers()['cache-control'] ?? '').toContain('no-store');
    expect(await r.text()).not.toContain('<html');
  });

  test('a rota Markdown direta também não se guarda', async ({ request }) => {
    const r = await request.get('/api/markdown/doar', { headers: { Accept: 'text/markdown' } });
    expect(r.ok()).toBeTruthy();
    expect(r.headers()['content-type'] ?? '').toContain('text/markdown');
    expect(r.headers()['cache-control'] ?? '').toContain('no-store');
  });

  test('a raiz sem sessão não vai para cache partilhada', async ({ request }) => {
    // Varia com o cookie (redirecionamento por sessão) e o `Vary` que o diria não
    // sobrevive à renderização do Next: na dúvida, não se partilha. O 307 com
    // sessão continua com no-store no código, mas precisa de APP_ORIGIN, que o
    // CI não define — por isso aqui trava-se o resguardo, não o desvio.
    const r = await request.get('/', { headers: { Accept: 'text/html' } });
    expect(r.ok()).toBeTruthy();
    expect(r.headers()['cache-control'] ?? '').toContain('no-store');
  });
});

/** Moderação com diálogo e nota a sério (#525): antes o painel nascia depois de
 *  toda a lista, fora do ecrã e sem foco, a nota "pedida" era opcional e o alvo
 *  não tinha ligação. Agora é diálogo modal com foco na nota, nota obrigatória
 *  para ocultar/suspender e alvo com saída. Nada aqui decide de verdade: abrir,
 *  validar e fechar não mutam nada, por isso os testes não se estragam entre si. */
test.describe('moderação com diálogo, nota e auditoria (#525)', () => {
  test('clicar numa decisão abre diálogo modal com foco na nota', async ({ page }) => {
    await gestorLogin(page);
    await page.goto('/manager/moderacao');
    await page.getByRole('button', { name: /^Ocultar/ }).first().click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await expect(page.getByLabel('Nota da decisão')).toBeFocused();
    expect(await graves(page), 'diálogo da decisão').toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialogo).toHaveCount(0);
  });

  test('ocultar não confirma sem nota de pelo menos 10 caracteres', async ({ page }) => {
    await gestorLogin(page);
    await page.goto('/manager/moderacao');
    await page.getByRole('button', { name: /^Ocultar/ }).first().click();
    const confirmar = page.getByRole('button', { name: /^Confirmar/ });
    await expect(confirmar).toBeDisabled();
    await expect(page.getByText(/pelo menos 10 caracteres/)).toBeVisible();
    await page.getByLabel('Nota da decisão').fill('curta');
    await expect(confirmar).toBeDisabled();
    await page.getByLabel('Nota da decisão').fill('fotografia com insultos repetidos');
    await expect(confirmar).toBeEnabled();
    await page.keyboard.press('Escape');
  });

  test('Esc fecha e devolve o foco ao botão que abriu', async ({ page }) => {
    await gestorLogin(page);
    await page.goto('/manager/moderacao');
    const botao = page.getByRole('button', { name: /^Ocultar/ }).first();
    await botao.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(botao).toBeFocused();
  });

  test('o cartão do alvo liga por id (escola ou conta)', async ({ page }) => {
    await gestorLogin(page);
    await page.goto('/manager/moderacao');
    // Escola: estrutura direta por id.
    const escola = page.getByRole('link', { name: 'Ver escola' }).first();
    await expect(escola).toHaveAttribute('href', /\/institutions\/\d+\/structure$/);
    // Pessoa: registo da conta por id — o nome da denúncia vive no registo da
    // pessoa, e na lista só há o username (homónimos incluídos), por isso o
    // `?q=nome` não chegava lá.
    const conta = page.getByRole('link', { name: 'Ver conta' }).first();
    await expect(conta).toHaveAttribute('href', /\/accounts\/\d+\/edit$/);
    await conta.click();
    await expect(page).toHaveURL(/\/accounts\/\d+\/edit$/);
    await expect(page.getByLabel(/Utilizador/)).toBeVisible();
  });

  test('a auditoria é alcançável em 1 clique, no topo e no menu', async ({ page }) => {
    await gestorLogin(page);
    await page.goto('/manager/moderacao');
    await expect(page.getByRole('link', { name: 'Auditoria', exact: true })).toBeVisible();
    await page.getByRole('main').getByRole('link', { name: 'Ver auditoria' }).click();
    await expect(page).toHaveURL(/\/moderacao\/auditoria$/);
    await expect(page.getByRole('heading', { name: 'Auditoria' })).toBeVisible();
  });

  test('decisão falhada mostra o erro dentro do diálogo', async ({ page }) => {
    await gestorLogin(page);
    await page.goto('/manager/moderacao');
    await page.getByRole('button', { name: /^Ocultar/ }).first().click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await page.getByLabel('Nota da decisão').fill('fotografia com insultos repetidos');
    // Só os POST (a decisão) falham; o GET da navegação passa.
    await page.route('**/manager/moderacao', (rota) =>
      rota.request().method() === 'POST' ? rota.abort() : rota.continue(),
    );
    await dialogo.getByRole('button', { name: /^Confirmar/ }).click();
    // O erro aparece dentro do diálogo e ele continua aberto — antes ficava
    // escondido atrás do overlay, com a página em `aria-hidden`.
    await expect(dialogo.getByRole('alert')).toContainText(/failed to fetch|contactar o servidor/i);
    await expect(dialogo).toBeVisible();
    await page.keyboard.press('Escape');
  });
});

/** Erros que pareciam "estado vazio" (#529): a falha do servidor pintava "Nenhum
 *  ano letivo", lista vazia ou esqueleto infinito, sem "Tentar de novo". Agora a
 *  falha mostra erro com retry; vazio é só quando a leitura correu bem. */
test.describe('estados de erro, esqueletos e fronteiras (#529)', () => {
  // Só os POST — que é por onde vão as server actions — falham; o GET da
  // navegação passa, para a página abrir e a falha ser da leitura, não da rota.
  async function avariarPOST(page: Page, padrao: string) {
    await page.route(padrao, (rota) =>
      rota.request().method() === 'POST' ? rota.abort() : rota.continue(),
    );
  }

  /** N respostas POST com sucesso ao padrão: prova que a leitura terminou mesmo,
   *  não só que o erro se apagou ao clicar (o `load` limpa o erro antes de a
   *  resposta chegar). Conta pedidos distintos (pelo objeto do pedido), por isso
   *  a mesma instância serve para totais sucessivos; o ouvinte vive até ao fim
   *  do teste. */
  function esperarPosts(page: Page, padrao: string) {
    const concluidos = new Set<object>();
    let acorda: (() => void) | null = null;
    page.on('response', (resposta) => {
      const pedido = resposta.request();
      if (pedido.method() === 'POST' && pedido.url().includes(padrao) && resposta.ok()) {
        concluidos.add(pedido);
        acorda?.();
      }
    });
    return {
      async total(n: number, limite = 30000) {
        const inicio = Date.now();
        while (concluidos.size < n) {
          if (Date.now() - inicio > limite) {
            throw new Error(`só ${concluidos.size} de ${n} respostas POST com sucesso em ${padrao}`);
          }
          await new Promise<void>((resolve) => {
            acorda = resolve;
            setTimeout(resolve, 200);
          });
        }
      },
    };
  }

  test('gestor: ano letivo falhado mostra erro com retry, não "criar primeiro"', async ({ page }) => {
    await gestorLogin(page);
    await avariarPOST(page, '**/manager/school-year');
    await page.goto('/manager/school-year');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await expect(tentar).toBeVisible();
    // O defeito era este CTA: a falha pintava "lista vazia" com "criar primeiro".
    await expect(page.getByRole('link', { name: 'Criar primeiro ano letivo' })).toHaveCount(0);
    expect(await graves(page), 'school-year em erro').toEqual([]);
    // Com a rede de volta, o retry traz a lista (ou o vazio verdadeiro, sem erro):
    // espera-se a resposta, não só o sumiço do botão, e valida-se o recuperado.
    const conta = esperarPosts(page, '/manager/school-year');
    await page.unroute('**/manager/school-year');
    await tentar.click();
    await conta.total(1);
    await expect(
      page
        .getByText('Nenhum ano letivo registado ainda.')
        .or(page.locator('tbody a[href*="/school-year/"]'))
        .first(),
      'lista ou vazio legítimo',
    ).toBeVisible();
    // Segunda falha a seguir ao retry: o erro volta, para não testar só o caminho feliz.
    await avariarPOST(page, '**/manager/school-year');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
    const conta2 = esperarPosts(page, '/manager/school-year');
    await page.unroute('**/manager/school-year');
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await conta2.total(1);
    await expect(
      page
        .getByText('Nenhum ano letivo registado ainda.')
        .or(page.locator('tbody a[href*="/school-year/"]'))
        .first(),
      'lista ou vazio legítimo após a segunda falha',
    ).toBeVisible();
  });

  test('gestor: counts falhados mostram erro e retry, não esqueleto infinito', async ({ page }) => {
    await gestorLogin(page);
    await avariarPOST(page, '**/manager');
    await page.goto('/manager');
    const cadastros = page.locator('section[aria-label="Cadastros"]');
    await expect(cadastros.getByRole('alert')).toBeVisible();
    const tentar = cadastros.getByRole('button', { name: 'Tentar novamente' });
    await expect(tentar).toBeVisible();
    expect(await graves(page), 'dashboard em erro').toEqual([]);
    const conta = esperarPosts(page, '/manager');
    await page.unroute('**/manager');
    await tentar.click();
    await conta.total(1);
    await expect(cadastros.getByRole('alert')).toHaveCount(0);
    // Recuperado a sério: os tiles voltam, não só o erro que se apaga.
    await expect(cadastros.locator('a').first(), 'tiles dos cadastros').toBeVisible();
  });

  test('professor: listas e scope falhados mostram erro com retry', async ({ page }) => {
    await gestorLogin(page);
    await avariarPOST(page, '**/manager/professor');
    await page.goto('/manager/professor');
    const tabelas = page.getByRole('table');
    await expect(tabelas.nth(0).getByRole('alert')).toContainText('Não foi possível carregar as simulações');
    await expect(tabelas.nth(1).getByRole('alert')).toContainText('Não foi possível carregar os enunciados por rever');
    // O scope falha pela mesma rede: sem o `catch` no hook, este painel nunca
    // aparecia e as listas ficavam no esqueleto para sempre.
    const scope = page.getByRole('alert').filter({ hasText: 'Não foi possível determinar as suas turmas' });
    await expect(scope).toBeVisible();
    expect(await graves(page), 'professor em erro').toEqual([]);
    await page.unroute('**/manager/professor');
    // O retry do scope volta a pedir (a falha de rede não fica em cache)...
    const contaScope = esperarPosts(page, '/manager/professor');
    await scope.getByRole('button', { name: 'Tentar novamente' }).click();
    await contaScope.total(1);
    await expect(scope).toHaveCount(0);
    // ...e o das listas também (duas leituras, uma por tabela).
    const contaListas = esperarPosts(page, '/manager/professor');
    await tabelas.nth(0).getByRole('button', { name: 'Tentar novamente' }).click();
    await contaListas.total(2);
    await expect(tabelas.nth(0).getByRole('alert')).toHaveCount(0);
    await expect(tabelas.nth(1).getByRole('alert')).toHaveCount(0);
    // Recuperado a sério: cada tabela pinta linhas ou o vazio legítimo.
    await expect(tabelas.nth(0).locator('tbody tr').first(), 'tabela de simulações').toBeVisible();
    await expect(tabelas.nth(1).locator('tbody tr').first(), 'tabela por rever').toBeVisible();
  });

  test('gestor: enunciados falhados (lista e scope) mostram erro com retry', async ({ page }) => {
    await gestorLogin(page);
    await avariarPOST(page, '**/manager/statements');
    await page.goto('/manager/statements');
    // A falha da lista tem prioridade no painel e esconde a do scope: só há um
    // retry de cada vez. Primeiro sai o da lista (com resposta à espera)...
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await expect(tentar.first()).toBeVisible();
    expect(await graves(page), 'enunciados em erro').toEqual([]);
    const contaLista = esperarPosts(page, '/manager/statements');
    await page.unroute('**/manager/statements');
    await tentar.first().click();
    await contaLista.total(1);
    // ...depois aparece o do scope, que também sai com retry (e resposta).
    const scope = page.getByRole('alert').filter({ hasText: 'Não foi possível determinar as suas turmas' });
    await expect(scope).toBeVisible();
    const contaScope = esperarPosts(page, '/manager/statements');
    await scope.getByRole('button', { name: 'Tentar novamente' }).click();
    await contaScope.total(1);
    await expect(tentar).toHaveCount(0);
  });

  test('gestor: lista genérica falhada (simulações) mostra erro com retry', async ({ page }) => {
    await gestorLogin(page);
    await avariarPOST(page, '**/manager/simulations');
    await page.goto('/manager/simulations');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await expect(tentar.first()).toBeVisible();
    const conta = esperarPosts(page, '/manager/simulations');
    await page.unroute('**/manager/simulations');
    // Primeiro a lista; o scope falhado aparece a seguir e sai com retry.
    await tentar.first().click();
    await conta.total(1);
    const scope = page.getByRole('alert').filter({ hasText: 'Não foi possível determinar as suas turmas' });
    await expect(scope).toBeVisible();
    await scope.getByRole('button', { name: 'Tentar novamente' }).click();
    await conta.total(2);
    await expect(tentar).toHaveCount(0);
    await expect(page.locator('tbody tr').first(), 'tabela recomposta').toBeVisible();
  });

  test('gestor: sala inexistente mostra erro com retry (sem fingir vazio)', async ({ page }) => {
    await gestorLogin(page);
    await page.goto('/manager/exam-rooms/999999');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await expect(tentar).toBeVisible();
    expect(await graves(page), 'sala em erro').toEqual([]);
    // O id continua a não existir: o retry volta a tentar e o erro mantém-se,
    // que é o honesto — nunca um ecrã vazio.
    await tentar.click();
    await expect(tentar).toBeVisible();
  });

  test('gestor: enunciado inexistente mostra erro com retry (sem fingir vazio)', async ({ page }) => {
    await gestorLogin(page);
    await page.goto('/manager/statements/999999');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await expect(tentar).toBeVisible();
    expect(await graves(page), 'enunciado em erro').toEqual([]);
    await tentar.click();
    await expect(tentar).toBeVisible();
  });

  test('landing: /nao-existe devolve 404 em PT, com marca e saída', async ({ page }) => {
    const resposta = await page.goto('/nao-existe');
    expect(resposta?.status(), 'estado do /nao-existe').toBe(404);
    await expect(page.getByRole('heading', { name: 'Esta página não existe' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ir para o início' })).toBeVisible();
    // "Entrar" existe no cabeçalho, no corpo e no rodapé: o que conta é o do corpo.
    await expect(page.locator('#conteudo').getByRole('link', { name: 'Entrar' })).toBeVisible();
    expect(await graves(page), 'landing 404').toEqual([]);
  });

  test('aluno: 404 autenticado é vazio sem live region, com saída', async ({ page }) => {
    await alunoLogin(page);
    await page.goto('/aluno/rota-que-nao-existe');
    await expect(page.getByText('Esta página não existe')).toBeVisible();
    // Vazio não é acontecimento: o texto não vive dentro de status nem de alert.
    await expect(page.locator('[role="status"], [role="alert"]', { hasText: 'Esta página não existe' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Voltar ao início' })).toBeVisible();
    expect(await graves(page), 'aluno 404').toEqual([]);
  });
});

/** Listagens CRUD com estado no endereço (#526): antes a pesquisa casava com
 *  JSON de campos invisíveis, tudo se renderizava e editar voltava sem a vista.
 *  Agora `?q=&sort=&dir=&page=` guarda a vista; só o visível casa e só a página
 *  se renderiza. */
test.describe('listagens com pesquisa, ordenação e paginação (#526)', () => {
  test('recarregar mantém pesquisa, ordenação e página', async ({ page }) => {
    await gestorLogin(page);
    await page.goto('/manager/simulations?q=sem-igual-xy9&sort=Aluno&dir=desc&page=3');
    await expect(page.getByLabel('Pesquisar')).toHaveValue('sem-igual-xy9');
    await expect(page.locator('th').first()).toHaveAttribute('aria-sort', 'descending');
    expect(page.url(), 'página no endereço').toContain('page=3');
    await expect(page.getByText('Nada corresponde à pesquisa.')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Pesquisar')).toHaveValue('sem-igual-xy9');
    await expect(page.locator('th').first()).toHaveAttribute('aria-sort', 'descending');
    expect(page.url(), 'página após recarregar').toContain('page=3');
  });

  test('voltar do criar restaura a pesquisa', async ({ page }) => {
    await gestorLogin(page);
    await page.goto('/manager/subjects/new?q=volta-aqui');
    // O voltar é o 2.º nível do breadcrumb, com o nome da lista.
    const voltar = page
      .getByRole('navigation', { name: 'Navegação estrutural' })
      .getByRole('link', { name: 'Disciplinas' });
    await expect(voltar).toHaveAttribute('href', /q=volta-aqui/);
    await voltar.click();
    await expect(page.getByLabel('Pesquisar')).toHaveValue('volta-aqui');
    expect(page.url(), 'pesquisa no endereço').toContain('q=volta-aqui');
  });

  test('só se renderiza a página e só a coluna ordenada anuncia', async ({ page }) => {
    await gestorLogin(page);
    await page.goto('/manager/simulations?sort=Nota');
    await expect(page.locator('th[aria-sort="ascending"]')).toHaveCount(1);
    expect(await graves(page), 'simulações ordenadas').toEqual([]);
    // Janela de renderização: nunca mais linhas no DOM que as da página.
    expect(await page.locator('tbody tr').count(), 'linhas renderizadas').toBeLessThanOrEqual(25);
  });
});
