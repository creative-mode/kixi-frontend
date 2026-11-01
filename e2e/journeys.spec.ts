import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { test, expect, type Page, type Locator } from '@playwright/test';

const PASSWORD = process.env.E2E_PASSWORD ?? 'Kixi1234!';
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? 'admin@kixi.ao';
const TEACHER_USERNAME = process.env.E2E_TEACHER_USERNAME ?? 'professor@kixi.ao';

function samplePdf(): Buffer {
  const stream = 'BT /F1 18 Tf 20 90 Td (OCR test) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf);
}

async function mockAsyncOcrJob(page: Page, extraction: Record<string, unknown>) {
  const jobId = randomUUID();
  await page.route('**/manager/api/ocr/extract', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        jobId,
        requestId: randomUUID(),
        statusUrl: `/manager/api/ocr/jobs/${jobId}`,
      }),
    });
  });
  await page.route(`**/manager/api/ocr/jobs/${jobId}`, async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 204 });
      return;
    }
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        jobId,
        status: 'SUCCEEDED',
        pageCount: 1,
        completedPages: 1,
        currentPage: 1,
        eventType: 'result',
        result: extraction,
        error: null,
      }),
    });
  });
}

// Admin e professor não aterram no mesmo sítio: o admin vai ao dashboard, o professor
// vai ao seu âmbito. E o "Dashboard" não se pode procurar por texto — o Next injecta um
//#__next-route-announcer__ que repete o título, e o Playwright recusa o locator ambíguo.
async function managerLogin(page: Page, username: string, landing: RegExp, heading: string) {
  await page.goto('/manager/login');
  await page.getByLabel('Username ou email').fill(username);
  // O campo da palavra-passe nao tem label associado, so `id`: e por isso que
  // vai por `#` e nao por `getByLabel`. Os outros quatro campos usam label.
  await page.locator('#password').fill(PASSWORD);
  await page.getByTestId('gestor-entrar-submeter').click();
  await expect(page).toHaveURL(landing);
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
}

/**
 * Escolhe a primeira opção com valor, em vez de `index: 1`: não depende da ordem nem
 * de quantas opções existem, que é o que muda contra um backend real.
 *
 * Espera explicitamente pela opção. `selectOption({ index })` esperava sozinho
 * pelas opções que ainda não tinham chegado do servidor; um `evaluateAll` não
 * espera, e a corrida dava «o select não tem opções com valor» logo a seguir a
 * escolher a escola. Aprendi à custa: a falha apareceu só em stack nova.
 */
async function escolherOpcao(select: Locator) {
  const primeira = select.locator('option:not([value=""])').first();
  await primeira.waitFor({ state: 'attached' });
  const valor = await primeira.getAttribute('value');
  // Uma `<option>` pode não ter atributo `value`, e nesse caso o valor é o próprio
  // texto — `<option>Escolha múltipla</option>` é perfeitamente válida. O repositório
  // tem desse tipo em `exam-builder.tsx` (`KINDS.map(k => <option>{k}</option>)`), e
  // um backend real pode devolver uma lista assim. Sem este recurso o helper morria
  // com «a primeira opção não tem valor» sobre uma opção que existe e é escolhível.
  if (valor !== null) {
    await select.selectOption(valor);
    return;
  }
  const texto = (await primeira.textContent())?.trim();
  if (!texto) throw new Error('a primeira opção não tem value nem texto');
  await select.selectOption({ label: texto });
}

async function assertPrintablePdf(page: Page) {
  const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.byteLength).toBeGreaterThan(1_000);
}

const ADMIN_LANDING = { landing: /\/manager\/?$/, heading: 'Dashboard' } as const;
const TEACHER_LANDING = { landing: /\/manager\/professor\/?$/, heading: 'Início' } as const;

/**
 * Recolhe o que a página reclamar, para que uma jornada não passe com o ecrã a
 * dizer «algo falhou» por baixo. Um `pageerror` é sempre bug — mesmo quando o
 * percurso principal deu certo — por isso a asserção vive no `afterEach`, e não
 * dentro de cada teste.
 */
const erros: Error[] = [];

test.beforeEach(async ({ page }) => {
  erros.length = 0;
  page.on('pageerror', (erro) => erros.push(erro));
  // O banner de cookies do aluno (kixi-frontend#219) fica fixo ao fundo do ecrã até
  // haver escolha. Desde o #506 ele reserva espaço e sobe a barra inferior, por isso já
  // não cobre ações; o teste próprio do banner está abaixo. Pré-semear a escolha continua
  // a ser o que um visitante que já respondeu antes tem — aqui só interessam as jornadas
  // por baixo dele, sem mais um clique em cada uma.
  await page.addInitScript(() => localStorage.setItem('kixi-consent', 'necessary'));
});

test.afterEach(() => {
  expect(erros, `a página lançou ${erros.length} erro(s): ${erros.map((e) => e.message).join(' | ')}`).toEqual([]);
});

test.describe('jornadas críticas do Kixi', () => {
  test('o banner de cookies não tapa a barra inferior e devolve o foco ao fechar (#506)', async ({ page }) => {
    // Sem escolha semeada: é a primeira visita, e é o banner que aparece.
    await page.addInitScript(() => localStorage.removeItem('kixi-consent'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/aluno/entrar');

    const banner = page.getByRole('dialog', { name: 'Cookies' });
    await expect(banner).toBeVisible();
    // Recebe o foco ao aparecer, senão um leitor de ecrã lê a página e esquece o pedido.
    await expect(banner).toBeFocused();

    // Recusar e aceitar pesam o mesmo: mesmo fundo, contorno, peso de letra e tamanho.
    const aparencia = (botao: Locator) =>
      botao.evaluate((el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return [s.backgroundColor, s.borderTopColor, s.fontWeight, Math.round(r.width), Math.round(r.height)].join('|');
      });
    expect(await aparencia(banner.getByRole('button', { name: 'Só necessários' }))).toBe(
      await aparencia(banner.getByRole('button', { name: 'Aceitar' })),
    );

    await page.getByLabel('Utilizador ou email').fill('12345');
    await page.locator('#password').fill(PASSWORD);
    await page.getByTestId('aluno-entrar-submeter').click();
    await expect(page).toHaveURL(/\/aluno\/inicio/);

    const caixa = async (alvo: Locator) => {
      const b = await alvo.boundingBox();
      expect(b).not.toBeNull();
      return b!;
    };
    // A barra inferior assenta por cima do banner, nunca tapada por ele.
    const barra = page.locator('nav[aria-label="Principal"]:visible');
    const [caixaBarra, caixaBanner] = [await caixa(barra), await caixa(banner)];
    expect(Math.round(caixaBarra.y + caixaBarra.height)).toBeLessThanOrEqual(Math.round(caixaBanner.y));

    // E o fim do conteúdo reserva a mesma altura: ao fundo, nenhuma ação fica por baixo.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect(
      await page.evaluate(() => {
        const topo = document.querySelector('[role="dialog"]')!.getBoundingClientRect().top;
        return [...document.querySelectorAll('#conteudo a, #conteudo button, #conteudo input')].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.height > 0 && r.top < innerHeight && r.bottom > topo;
        }).length;
      }),
    ).toBe(0);

    // Reabrir (o rodapé faz o mesmo) e fechar devolve o foco a quem o tinha, e a barra ao fundo.
    await banner.getByRole('button', { name: 'Aceitar' }).click();
    await expect(banner).toHaveCount(0);
    const campo = page.locator('#conteudo a[href]').first();
    await campo.focus();
    await page.evaluate(() => {
      localStorage.removeItem('kixi-consent');
      window.dispatchEvent(new Event('kixi-consent-change'));
    });
    await expect(banner).toBeFocused();
    await banner.getByRole('button', { name: 'Só necessários' }).click();
    await expect(banner).toHaveCount(0);
    await expect(campo).toBeFocused();
    await expect(barra).toHaveCSS('bottom', '0px');
  });

  test('o feed mostra o nome verdadeiro de quem publicou e a etiqueta de colega de turma', async ({ page }) => {
    await page.goto('/aluno/entrar');
    await page.getByLabel('Utilizador ou email').fill('12345');
    await page.locator('#password').fill(PASSWORD);
    await page.getByTestId('aluno-entrar-submeter').click();
    await expect(page).toHaveURL(/\/aluno\/inicio/);
    const post = page.getByRole('article').filter({ hasText: 'Resumo rápido: o /28' });
    await expect(post).toBeVisible();
    await expect(post.getByRole('img', { name: 'Colega de turma' })).toBeVisible();
    await expect(post.getByRole('link').first()).not.toHaveText(/^Colega/);
    await expect(page.getByText('Um colega da turma')).toHaveCount(0);

    // O nome leva ao perfil da pessoa, que tem o mesmo modelo do teu: foto, nome, nível e separadores.
    await post.getByRole('link').first().click();
    await expect(page).toHaveURL(/\/aluno\/u\/\d+/);
    await expect(page.getByRole('heading', { name: 'Nuno Dias', level: 2 })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Publicações' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Medalhas' })).toBeVisible();
    await expect(page.getByText('Resumo rápido: o /28')).toBeVisible();
  });

  test('construtor de publicações: cartão de estudo com imagem e desafio respondido no feed', async ({ page }) => {
    await page.goto('/aluno/entrar');
    await page.getByLabel('Utilizador ou email').fill('12345');
    await page.locator('#password').fill(PASSWORD);
    await page.getByTestId('aluno-entrar-submeter').click();
    await expect(page).toHaveURL(/\/aluno\/inicio/);

    // O desafio que já está no feed: responde, vê se acertou e lê a explicação.
    const desafio = page.getByRole('article').filter({ hasText: 'Desafio de sub-redes' });
    await expect(desafio.getByRole('img', { name: 'Desafio' })).toBeVisible();
    await desafio.getByRole('button', { name: /^14/ }).click();
    await expect(desafio.getByText('Certo!')).toBeVisible();
    await expect(desafio.getByText(/primeiro é o da rede/)).toBeVisible();

    // O construtor: modelo, blocos, imagem, pré-visualização e publicação.
    await page.getByRole('link', { name: 'Criar publicação com imagens e blocos' }).click();
    await expect(page).toHaveURL(/\/aluno\/publicar/);
    await page.locator('label').filter({ hasText: 'Cartão de estudo' }).click();
    await page.getByLabel('Título 1', { exact: true }).fill('Endereços de uma rede');
    await page.getByLabel('Texto 2', { exact: true }).fill('Numa rede /28 há 16 endereços, mas só 14 servem para máquinas.');
    await page.getByLabel('Lista 3: linha 1').fill('Endereço da rede');
    await page.getByRole('button', { name: 'Imagem', exact: true }).click();
    // Um PNG de 1 pixel, em bytes: um texto em base64 teria letras repetidas que o gate de texto estragado recusa.
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 218, 99, 252, 207, 192, 80, 15, 0, 4, 133, 1, 128, 132, 169, 140, 33, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
    await page.getByLabel('Imagem 5: escolher imagem').setInputFiles({ name: 'esquema.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByText('Imagem pronta')).toBeVisible();
    await page.getByLabel('Imagem 5: descrição da imagem').fill('Esquema de uma rede');
    const previa = page.getByRole('region', { name: 'Pré-visualização' });
    await expect(previa.getByRole('heading', { name: 'Endereços de uma rede', level: 4 })).toBeVisible();
    await expect(previa.getByRole('img', { name: 'Esquema de uma rede' })).toBeVisible();
    await page.getByRole('button', { name: 'Publicar' }).click();
    await expect(page).toHaveURL(/\/aluno\/inicio/);
    const novo = page.getByRole('article').filter({ hasText: 'Endereços de uma rede' }).first();
    await expect(novo.getByRole('img', { name: 'Cartão de estudo' })).toBeVisible();
    const figura = novo.getByRole('img', { name: 'Esquema de uma rede' });
    await expect(figura).toBeVisible();
    // Visível não chega: a imagem tem mesmo de ter carregado (antes o pedido ia dar à landing, 404).
    await expect.poll(() => figura.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  });

  test('pesquisar no cabeçalho abre a pesquisa de escolas, professores e alunos', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/aluno/entrar');
    await page.getByLabel('Utilizador ou email').fill('12345');
    await page.locator('#password').fill(PASSWORD);
    await page.getByTestId('aluno-entrar-submeter').click();
    await expect(page).toHaveURL(/\/aluno\/inicio/);
    await page.getByRole('link', { name: 'Pesquisar escolas, professores e alunos' }).click();
    await expect(page).toHaveURL(/\/aluno\/pesquisa/);
    await page.getByLabel(/Nome de uma escola/).fill('itel');
    await page.getByRole('button', { name: 'Pesquisar' }).click();
    for (const secao of ['Escolas', 'Professores', 'Alunos']) await expect(page.getByRole('region', { name: secao })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Escolas' }).getByRole('link').first()).toBeVisible();
  });

  test('pesquisar na barra lateral no desktop abre a mesma pesquisa', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/aluno/entrar');
    await page.getByLabel('Utilizador ou email').fill('12345');
    await page.locator('#password').fill(PASSWORD);
    await page.getByTestId('aluno-entrar-submeter').click();
    await expect(page).toHaveURL(/\/aluno\/inicio/);

    // No desktop só a barra lateral mostra este link: o cabeçalho e a barra inferior
    // do telemóvel estão `md:hidden`, por isso a consulta por role encontra um só.
    const pesquisa = page.getByRole('link', { name: 'Pesquisar escolas, professores e alunos' });
    await expect(pesquisa).toBeVisible();
    // O critério de aceitação pede teclado: foco no link e ativação com Enter.
    await pesquisa.focus();
    await expect(pesquisa).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/aluno\/pesquisa/);
    await expect(page.getByLabel(/Nome de uma escola/)).toBeVisible();
  });

  test('a escola segue o padrão do perfil: faixa, nome, etiquetas e separadores', async ({ page }) => {
    await page.goto('/aluno/entrar');
    await page.getByLabel('Utilizador ou email').fill('12345');
    await page.locator('#password').fill(PASSWORD);
    await page.getByTestId('aluno-entrar-submeter').click();
    await expect(page).toHaveURL(/\/aluno\/inicio/);
    await page.goto('/aluno/escola/1');
    await expect(page.getByRole('heading', { name: /Telecomunica/, level: 2 })).toBeVisible();
    await expect(page.getByText(/\d+\s*professor/)).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Professores' })).toBeVisible();
    await page.getByRole('tab', { name: 'Enunciados' }).click();
    // #494: o enunciado da escola abre o detalhe, como no catálogo, e não a sala.
    await page.getByRole('tabpanel').getByRole('link').first().click();
    await expect(page).toHaveURL(/\/aluno\/prova\/\d+\/detalhe/);
    await expect(page.getByRole('heading', { name: 'Como é esta prova' })).toBeVisible();
    // E o «Voltar» do detalhe leva às provas, de onde se abre o catálogo.
    await page.getByRole('link', { name: 'Voltar às provas' }).click();
    await expect(page).toHaveURL(/\/aluno\/provas/);
  });

  test('smoke: autenticação abre as áreas protegidas de aluno e gestor', async ({ browser, page }) => {
    await page.goto('/aluno/entrar');
    await page.getByLabel('Utilizador ou email').fill('12345');
    // Sem label associado, so `id` (ver a razao em `managerLogin`).
    await page.locator('#password').fill(PASSWORD);
    await page.getByTestId('aluno-entrar-submeter').click();
    await expect(page).toHaveURL(/\/aluno\/inicio/);
    await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible();

    // Cookies têm o mesmo nome no gateway; isolar contextos evita contaminar a
    // autenticação de uma aplicação com a sessão da outra.
    const managerContext = await browser.newContext();
    const managerPage = await managerContext.newPage();
    await managerLogin(managerPage, ADMIN_USERNAME, ADMIN_LANDING.landing, ADMIN_LANDING.heading);
    await managerContext.close();
  });

  test('cadastro: informa encarregado de educação e abre política de privacidade', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/aluno/cadastro');

    await expect(page.getByText(/menos de 18 anos.*encarregado de educação/i)).toBeVisible();
    const privacyLink = page.getByRole('link', { name: 'Política de Privacidade' });
    await expect(privacyLink).toHaveAttribute('href', /\/privacidade$/);
    await expect(privacyLink).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await privacyLink.click();
    await expect(page).toHaveURL(/\/privacidade$/);
    await expect(page.getByRole('heading', { name: 'Privacidade' })).toBeVisible();
  });

  test('aluno: menu da conta, tutor, comentários e navegação de provas são acessíveis (#500)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/aluno/entrar');
    await page.getByLabel('Utilizador ou email').fill('12345');
    await page.locator('#password').fill(PASSWORD);
    await page.getByTestId('aluno-entrar-submeter').click();
    await expect(page).toHaveURL(/\/aluno\/inicio/);

    await page.getByRole('button', { name: /Conta de/ }).click();
    await expect(page.getByRole('menuitem', { name: 'Privacidade' })).toHaveAttribute('href', /\/privacidade$/);
    await expect(page.getByRole('menuitem', { name: 'Cookies' })).toHaveAttribute('href', /\/cookies$/);

    await page.goto('/aluno/perfil');
    await page.getByRole('tab', { name: 'Definições' }).click();
    await expect(page.getByRole('tabpanel').getByRole('link', { name: 'Privacidade' })).toHaveAttribute('href', /\/privacidade$/);
    await expect(page.getByRole('tabpanel').getByRole('link', { name: 'Cookies' })).toHaveAttribute('href', /\/cookies$/);

    const trigger = page.locator('button[aria-haspopup="menu"]:visible').first();
    await trigger.focus();
    await page.keyboard.press('Enter');
    const perfil = page.getByRole('menuitem', { name: 'O meu perfil' });
    const terminar = page.getByRole('menuitem', { name: 'Terminar sessão' });
    await expect(perfil).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Privacidade' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Cookies' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(terminar).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('menuitem', { name: 'Cookies' })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('menuitem', { name: 'Privacidade' })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(perfil).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();

    await page.goto('/aluno/provas');
    const nav = page.getByRole('navigation', { name: 'Provas' });
    await expect(nav.getByRole('link', { name: 'Enunciados' })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('tab')).toHaveCount(0);
    await nav.getByRole('link', { name: /Salas de prova/ }).click();
    await expect(nav.getByRole('link', { name: /Salas de prova/ })).toHaveAttribute('aria-current', 'page');

    // Sem prova, o tutor oferece as provas do próprio aluno (#491): é uma lista de
    // onde se sai a estudar, não um cartão a mandar para o catálogo.
    await page.goto('/aluno/tutor');
    await expect(page.getByRole('link', { name: /Redes de Computadores/ })).toHaveAttribute('href', /statementId=1/);
    // A prova a decorrer não entra: o tutor está fechado enquanto ela corre.
    await expect(page.getByRole('link', { name: /Sistemas Operativos/ })).toHaveCount(0);

    await page.goto('/aluno/tutor?statementId=1');
    const conversa = page.getByRole('log');
    await expect(conversa).toHaveAttribute('aria-live', 'off');
    const respostaAnunciada = page.locator('[role="status"][aria-live="polite"][aria-atomic="true"]');
    const pergunta = page.getByLabel('Mensagem para o tutor');
    await pergunta.fill('Como resolvo a primeira questão?');
    // No telemóvel o Enter muda de linha: quem envia é o botão.
    await pergunta.press('Enter');
    await expect(pergunta).toHaveValue('Como resolvo a primeira questão?\n');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(respostaAnunciada).toContainText('Resposta do tutor:', { timeout: 15_000 });

    await page.goto('/aluno/inicio');
    await page.getByRole('button', { name: /Comentar/ }).first().click();
    await expect(page.getByLabel('Escrever um comentário')).toHaveCSS('height', '44px');
    await expect(page.getByRole('button', { name: 'Enviar comentário' })).toHaveCSS('height', '44px');
  });

  test('autenticação: erros recebem foco e email e palavra-passe validam ao sair do campo', async ({ page }) => {
    await page.goto('/aluno/entrar');
    const usernameOrEmail = page.getByLabel('Utilizador ou email');
    await expect(usernameOrEmail).not.toBeFocused();
    await page.getByTestId('aluno-entrar-submeter').click();
    await expect(usernameOrEmail).toBeFocused();
    await expect(usernameOrEmail).toHaveAttribute('aria-invalid', 'true');
    await expect(usernameOrEmail).toHaveAttribute('aria-describedby', 'usernameOrEmail-err');
    await expect(page.locator('#usernameOrEmail-err')).toContainText('Indica o teu utilizador ou email.');

    await page.goto('/aluno/cadastro');
    const email = page.getByLabel('Email');
    await expect(email).toHaveAttribute('inputmode', 'email');
    await email.fill('email-invalido');
    await email.blur();
    await expect(page.locator('#email-err')).toContainText('Este email não parece válido.');

    const password = page.locator('#password');
    await password.fill('curta');
    await password.blur();
    await expect(page.locator('#password-err')).toContainText('Usa pelo menos 8 caracteres.');
  });

  test('aluno: registo, onboarding, prova, resultado e tutor', async ({ page }) => {
    const id = randomUUID().replaceAll('-', '').slice(0, 12);
    await page.goto('/aluno/cadastro');
    await page.getByLabel('Nome', { exact: true }).fill('Ana');
    await page.getByLabel('Apelido').fill(`E2E${id}`);
    await page.getByLabel('Utilizador').fill(`aluno${id}`);
    await page.getByLabel('Email').fill(`aluno${id}@kixi.ao`);
    await page.locator('#password').fill(PASSWORD);
    await page.locator('#confirm').fill(PASSWORD);
    await page.getByTestId('aluno-cadastro-submeter').click();
    await expect(page).toHaveURL(/\/aluno\/onboarding/);
    const code = page.getByLabel('Código de matrícula');
    await expect(page.getByRole('button', { name: 'Terminar sessão' })).toBeVisible();
    await page.getByRole('button', { name: 'Entrar na turma' }).click();
    await expect(page.locator('#codigo-err')).toContainText('Indica o código de matrícula que a tua escola te deu.');
    await expect(code).toBeFocused();

    // Desde kixi#255 a auto-matrícula é só o código: a turma e o ano letivo vêm dele,
    // por isso o onboarding deixou de pedir escola/curso/turma. TESTE1234 é o código
    // da turma 12B que o mock semeia.
    await code.fill('TESTE1234');
    await page.getByRole('button', { name: 'Entrar na turma' }).click();
    await expect(page).toHaveURL(/\/aluno\/inicio/);
    // Conta nova: o início abre sem o bloco «Começa por aqui» (saiu do início).
    await expect(page.getByRole('region', { name: 'Primeiros passos' })).toHaveCount(0);
    const applause = page.getByRole('button', { name: 'Aplaudir' }).first();
    await expect(applause).toBeVisible();
    await applause.click();
    const applauded = page.getByRole('button', { name: 'Aplaudido, tocar para retirar' }).first();
    await expect(applauded).toHaveAttribute('aria-pressed', 'true');
    await applauded.click();
    await expect(page.getByRole('button', { name: 'Aplaudir' }).first()).toHaveAttribute('aria-pressed', 'false');

    // Follow the catalogue for the class selected during onboarding so the test does
    // not assume a fixed class-to-statement mapping.
    await page.goto('/aluno/provas');
    await page.getByRole('link', { name: 'Ver a prova' }).first().click();
    await expect(page.locator('[aria-label="A prova"] .katex')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('[aria-label="A prova"] .katex')).toBeVisible();
    await assertPrintablePdf(page);
    await page.emulateMedia({ media: 'screen' });
    await page.getByRole('link', { name: 'Começar', exact: true }).click();
    await expect(page).toHaveURL(/\/aluno\/prova\/\d+/);
    await page.getByRole('button', { name: 'Começar', exact: true }).click();
    // O cabeçalho passou a ser "Questão 2 (1 de 12)": o número de exibição e o
// índice de posição deixaram de ser a mesma coisa.
await expect(page.getByText(/\(1 de \d+\)/)).toBeVisible();
    // #486: a marca «para rever» sobrevive a recarregar a sala, e sem respostas
    // por guardar o browser não mostra o aviso nativo.
    let avisosNativos = 0;
    page.on('dialog', (dialogo) => {
      avisosNativos += 1;
      void dialogo.accept();
    });
    await page.getByRole('button', { name: 'Marcar para rever' }).click();
    await expect(page.getByRole('button', { name: 'Marcada para rever', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(/\(1 de \d+\)/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Marcada para rever', exact: true })).toBeVisible();
    expect(avisosNativos).toBe(0);
    // Resposta deliberadamente errada para o resultado oferecer a ligação ao tutor.
    // Clica-se na linha da opção, não no input: o radio é `sr-only` e o círculo
    // visível é um `<span>` sobreposto, por isso `.check()` no input nunca chega lá.
    await page.locator('label:has(input[type="radio"])').last().click();
    await expect(page.getByText('Resposta guardada. Podes mudá-la até entregares a prova.')).toBeVisible();
    await page.getByRole('button', { name: 'Entregar', exact: true }).first().click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page.getByRole('alertdialog')).toContainText('Marcadas (1) para rever.');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Entregar', exact: true }).click();
    await expect(page).toHaveURL(/\/aluno\/resultado\?prova=/);
    // #492: a leitura da nota e as recompensas do servidor vêm logo a seguir à nota.
    await expect(page.getByTestId('resultado-leitura')).toBeVisible();
    await expect(page.getByLabel('O que ganhaste')).toContainText(/XP/);
    await expect(page.getByLabel('O que ganhaste')).toContainText('sequência');
    // Entregar fecha a tentativa: as marcas locais dessa simulação desaparecem.
    await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('kixi:marcadas:')).length)).toBe(0);
    // O `CardTitle` da revisão é um `div`, não um heading, por isso não aparece em
    // `getByRole('heading')`. O alvo estável é o `aria-label` que o card já traz.
    await expect(page.getByLabel('Revisão questão a questão')).toBeVisible();
    await page.getByRole('link', { name: 'Estudar os erros com o tutor' }).click();
    await expect(page).toHaveURL(/\/aluno\/tutor\?statementId=.*de=resultado/);
    await expect(page.getByRole('heading', { name: 'Tutor' })).toBeVisible();
    // «Voltar» regressa ao resultado de onde o aluno veio (#491), não ao detalhe.
    await page.getByRole('link', { name: 'Voltar ao resultado' }).click();
    await expect(page).toHaveURL(/\/aluno\/resultado\?prova=/);
  });

  test('aluno: uma denúncia falhada conserva o motivo e pode ser repetida (#499)', async ({ page }) => {
    await page.goto('/aluno/entrar');
    await page.getByLabel('Utilizador ou email').fill('12345');
    await page.locator('#password').fill(PASSWORD);
    await page.getByTestId('aluno-entrar-submeter').click();
    await expect(page).toHaveURL(/\/aluno\/inicio/);

    const falha = (mode: string) => page.evaluate(async (value) => {
      const response = await fetch('api/mock-fault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: value }),
      });
      if (!response.ok) throw new Error(`Não foi possível configurar a falha: ${response.status}`);
    }, mode);
    const post = page.getByRole('article').filter({ hasText: 'subnetting' }).first();
    await falha('500');
    await post.getByRole('button', { name: 'Denunciar publicação' }).click();

    const spam = post.getByRole('radio', { name: 'Spam ou publicidade' });
    const ofensivo = post.getByRole('radio', { name: 'Conteúdo ofensivo' });
    const outro = post.getByRole('radio', { name: 'Outro motivo' });
    await spam.focus();
    await page.keyboard.press('ArrowDown');
    await expect(ofensivo).toBeChecked();
    await page.keyboard.press('ArrowDown');
    await expect(outro).toBeChecked();
    await page.keyboard.press('ArrowUp');
    await expect(ofensivo).toBeChecked();
    await post.getByRole('button', { name: 'Denunciar', exact: true }).click();

    await expect(post.getByRole('alert')).toContainText('O servidor teve um problema. Tenta de novo daqui a pouco.');
    await expect(ofensivo).toBeChecked();
    await falha('');
    await post.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(post.getByText('Denúncia enviada. A equipa da escola vai rever.')).toBeVisible();
  });

  test('aluno: a resposta que não chegou ao servidor sobrevive a recarregar e é recuperada (#587)', async ({ page }) => {
    // Recarregar com respostas por confirmar pede confirmação ao browser: aceita-se, é o que o aluno faria.
    page.on('dialog', (dialogo) => void dialogo.accept());
    const id = randomUUID().replaceAll('-', '').slice(0, 12);
    await page.goto('/aluno/cadastro');
    await page.getByLabel('Nome', { exact: true }).fill('Rita');
    await page.getByLabel('Apelido').fill(`E2E${id}`);
    await page.getByLabel('Utilizador').fill(`aluno${id}`);
    await page.getByLabel('Email').fill(`aluno${id}@kixi.ao`);
    await page.locator('#password').fill(PASSWORD);
    await page.locator('#confirm').fill(PASSWORD);
    await page.getByTestId('aluno-cadastro-submeter').click();
    await expect(page).toHaveURL(/\/aluno\/onboarding/);
    await page.getByLabel('Código de matrícula').fill('TESTE1234');
    await page.getByRole('button', { name: 'Entrar na turma' }).click();
    await expect(page).toHaveURL(/\/aluno\/inicio/);

    await page.goto('/aluno/provas');
    await page.getByRole('link', { name: 'Ver a prova' }).first().click();
    await page.getByRole('link', { name: 'Começar', exact: true }).click();
    await expect(page).toHaveURL(/\/aluno\/prova\/\d+/);
    await page.getByRole('button', { name: 'Começar', exact: true }).click();
    await expect(page.getByText(/\(1 de \d+\)/)).toBeVisible();

    const temRascunho = () => page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('kixi:rascunho:')));

    // Sem rede para gravar: só as server actions (têm o cabeçalho next-action) ficam sem resposta, a página continua a abrir.
    const semRede = (route: import('@playwright/test').Route) =>
      route.request().headers()['next-action'] ? route.abort('failed') : route.continue();
    await page.route('**/aluno/prova/**', semRede);
    await page.locator('label:has(input[type="radio"])').last().click();
    await expect.poll(temRascunho, { timeout: 15_000 }).toBe(true);
    await expect(page.getByText('Resposta guardada. Podes mudá-la até entregares a prova.')).toHaveCount(0);

    // A rede volta e o aluno reabre a prova: a resposta regressa e é enviada.
    await page.unroute('**/aluno/prova/**', semRede);
    await page.reload();
    await expect(page.getByText(/Recuperámos 1 resposta/)).toBeVisible();
    await expect(page.getByText('Resposta guardada. Podes mudá-la até entregares a prova.')).toBeVisible();
    // Confirmada pelo servidor, o rascunho local deixa de existir.
    await expect.poll(temRascunho, { timeout: 15_000 }).toBe(false);
  });

  test('aluno: sem ligação avisa, guarda a resposta e a entrega falha sem partir a sala (#485)', async ({ page }) => {
    test.setTimeout(60_000);
    page.on('dialog', (dialogo) => void dialogo.accept());
    const id = randomUUID().replaceAll('-', '').slice(0, 12);
    await page.goto('/aluno/cadastro');
    await page.getByLabel('Nome', { exact: true }).fill('Rita');
    await page.getByLabel('Apelido').fill(`OFF${id}`);
    await page.getByLabel('Utilizador').fill(`off${id}`);
    await page.getByLabel('Email').fill(`off${id}@kixi.ao`);
    await page.locator('#password').fill(PASSWORD);
    await page.locator('#confirm').fill(PASSWORD);
    await page.getByTestId('aluno-cadastro-submeter').click();
    await expect(page).toHaveURL(/\/aluno\/onboarding/);
    await page.getByLabel('Código de matrícula').fill('TESTE1234');
    await page.getByRole('button', { name: 'Entrar na turma' }).click();
    await expect(page).toHaveURL(/\/aluno\/inicio/);

    await page.goto('/aluno/provas');
    await page.getByRole('link', { name: 'Ver a prova' }).first().click();
    await page.getByRole('link', { name: 'Começar', exact: true }).click();
    await expect(page).toHaveURL(/\/aluno\/prova\/\d+/);
    await page.getByRole('button', { name: 'Começar', exact: true }).click();
    await expect(page.getByText(/\(1 de \d+\)/)).toBeVisible();

    const faixa = page.getByTestId('sala-offline');
    await page.context().setOffline(true);
    await expect(faixa).toBeVisible({ timeout: 2000 });

    // Offline a sério: a fila esgota as tentativas e mostra o erro. Ao voltar a
    // rede, o evento `online` reenvia a resposta sem o aluno recarregar nada.
    await page.locator('label:has(input[type="radio"])').last().click();
    await expect(page.getByText('Não foi possível contactar o servidor.')).toBeVisible({ timeout: 15_000 });
    await page.context().setOffline(false);
    await expect(faixa).toHaveCount(0);
    await expect(page.getByText('Resposta guardada. Podes mudá-la até entregares a prova.')).toBeVisible({ timeout: 15_000 });

    // A entrega também pode falhar por rede. Tem de ficar no diálogo, com a sala
    // ainda por trás, e não no error boundary global.
    await page.getByRole('button', { name: 'Entregar', exact: true }).first().click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    const semEntrega = (route: import('@playwright/test').Route) =>
      route.request().headers()['next-action'] ? route.abort('failed') : route.continue();
    await page.route('**/aluno/prova/**', semEntrega);
    await page.getByRole('alertdialog').getByRole('button', { name: 'Entregar', exact: true }).click();
    await expect(page.getByRole('alertdialog').getByRole('alert')).toContainText('Sem ligação');
    await expect(page).toHaveURL(/\/aluno\/prova\/\d+/);
    await expect(page.getByText(/\(1 de \d+\)/)).toBeVisible();
    await expect(page.getByText('Algo falhou, mas não perdeste nada')).toHaveCount(0);
    await page.unroute('**/aluno/prova/**', semEntrega);
  });

  test('professor: OCR, revisão, gabarito, publicação e sala', async ({ page }) => {
    await managerLogin(page, TEACHER_USERNAME, TEACHER_LANDING.landing, TEACHER_LANDING.heading);
    // `/statements/import` passou a redireccionar para o construtor com o importador
    // já aberto, e a prova é extraída para um rascunho em memória: não há navegação.
    await page.goto('/manager/exam-builder?importar=1');
    // O `CardTitle` do importador é um `div`, não um heading.
    await expect(page.getByText('Importar de imagem ou PDF')).toBeVisible();
    await page.getByLabel('Escolher ficheiros da prova').setInputFiles({
      name: 'ocr-sample.pdf',
      mimeType: 'application/pdf',
      buffer: samplePdf(),
    });
    await page.getByTestId('gestor-statements-import-submeter').click();
    await expect(page.getByText('A ler página 1 de 1…')).toBeVisible();

    // O extrato entra no rascunho. Publicar exige disciplina e turma — o proprio
    // botao diz isso no `title` — e so depois de a prova existir.
    await expect(page.getByText('ocr-sample.pdf')).toBeVisible();
    await expect(page.locator('#exam-sheet .katex')).toBeVisible();
    await page.getByRole('button', { name: 'Ajustar enunciado' }).first().click();
    const mathQuestion = page.getByRole('textbox', { name: 'Questão 1' });
    await expect(mathQuestion).toBeEditable();
    await mathQuestion.fill('Questão sintética editada: determine $v = v_0 + at$.');
    await expect(page.locator('#exam-sheet')).toContainText('Questão sintética editada: determine');
    await expect(page.locator('#exam-sheet .katex')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#exam-sheet .katex')).toBeVisible();
    await assertPrintablePdf(page);
    await page.emulateMedia({ media: 'screen' });
    // Por label, nao por posicao: o `Field` do construtor passou a envolver o
    // controlo no `<label>`, que e o que da ao campo um nome acessivel. Antes o
    // teste ia por `select` a dedo (Escola, Disciplina, Turma), e isso partia se o
    // backend trouxesse outro numero de opcoes ou outra ordem.
    await escolherOpcao(page.getByLabel('Disciplina'));
    // O rótulo é `Turma` ou `Turma (opcional)` conforme o papel. O `getByLabel` casa
    // por substring, portanto ambos servem — mas a regex deixa a intenção explícita e
    // não rebenta em strict mode se algum dia os dois rótulos coexistirem.
    await escolherOpcao(page.getByLabel(/^Turma/));

    // Publicar é bloqueado enquanto a prova tiver problemas, e o construtor diz
    // quais: o OCR não traz cotação nem adivinha o gabarito. Resolve-se o que a
    // própria página complains, em vez de fixar números que o mock pode mudar.
    await page.getByRole('button', { name: 'Distribuir 20 valores' }).click();
    for (const grupo of await page.getByRole('radiogroup').all()) {
      const nome = (await grupo.getAttribute('aria-label')) ?? '';
      if (!nome.includes('Resposta da questão')) continue;
      if ((await grupo.getByRole('radio', { name: 'Verdadeiro' }).getAttribute('aria-checked')) === 'true') continue;
      await grupo.getByRole('radio', { name: 'Verdadeiro' }).click();
    }
    await page.getByRole('button', { name: 'Publicar' }).click();
    await expect(page.getByText('Prova publicada. Os alunos já a podem simular.')).toBeVisible();

    const detailHref = await page.getByRole('link', { name: 'Ver o enunciado' }).getAttribute('href');
    expect(detailHref).toBeTruthy();
    const detail = await page.context().newPage();
    await detail.goto(detailHref!);
    await expect(detail.getByRole('img', { name: 'Diagrama OCR' })).toBeVisible();
    await expect(detail.locator('.katex')).toBeVisible();
    await detail.emulateMedia({ media: 'print' });
    await expect(detail.locator('.katex')).toBeVisible();
    await assertPrintablePdf(detail);
    await detail.close();

    await page.getByRole('link', { name: 'Criar sala com esta prova' }).click();
    await expect(page).toHaveURL(/\/manager\/exam-rooms\/new\?statementId=/);
    await page.getByRole('button', { name: 'Criar sala' }).click();
    await expect(page).toHaveURL(/\/manager\/exam-rooms\/\d+/);
  });

  test('OCR matemático: vectores da questão VII.a aparecem na folha e na impressão', async ({ page }) => {
    await managerLogin(page, TEACHER_USERNAME, TEACHER_LANDING.landing, TEACHER_LANDING.heading);
    const latex = String.raw`\vec{v}\;e\;\vec{a}`;
    const extraction = {
      status: 'success',
      exam_type: 'Prova',
      duration_minutes: 90,
      title: 'Regressão visual sintética — Física',
      class_grade: '12',
      subject_name: 'Física',
      questions: [{
        number: '4',
        type: 'dissertativa',
        confidence: 0.95,
        text: 'Para t = 3 s:',
        subitems_content: [{
          label: 'VII.a',
          type: 'dissertativa',
          text: `O ângulo formado entre os vectores $${latex}$`,
          rawText: 'O ângulo formado entre os vectores e',
          confidence: 0.55,
          formulas: [{ raw: latex, latex, confidence: 0.55, layoutConfidence: 0.55, kind: 'formula' }],
        }],
      }],
      warnings: [{ code: 'LOW_CONFIDENCE_FORMULA', field: 'question_4_formula_1', confidence: 0.55 }],
    };
    await mockAsyncOcrJob(page, extraction);

    await page.goto('/manager/exam-builder?importar=1');
    await expect(page.getByText('Importar de imagem ou PDF')).toBeVisible();
    await page.getByLabel('Escolher ficheiros da prova').setInputFiles({
      name: 'ocr-physics-vectors.pdf',
      mimeType: 'application/pdf',
      buffer: samplePdf(),
    });
    await page.getByTestId('gestor-statements-import-submeter').click();

    const sheet = page.locator('#exam-sheet');
    await expect(sheet).toContainText('O ângulo formado entre os vectores');
    await expect(sheet.locator('.katex')).toBeVisible();
    await expect(sheet.locator('.kixi-math-review')).toContainText('Fórmula a rever');
    await page.getByText(/Prova lida/).waitFor({ state: 'hidden' });
    await sheet.screenshot({ path: resolve(process.cwd(), 'docs/visual-evidence/ocr-physics/vector-pair-builder.png') });

    await page.emulateMedia({ media: 'print' });
    await expect(sheet.locator('.katex')).toBeVisible();
    const pdf = await page.pdf({
      path: resolve(process.cwd(), 'docs/visual-evidence/ocr-physics/vector-pair-print.pdf'),
      printBackground: true,
      preferCSSPageSize: true,
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    await page.emulateMedia({ media: 'screen' });
  });

  test('OCR: grupo impresso com chaveta mantém as três alíneas no construtor e na impressão', async ({ page }, testInfo) => {
    await managerLogin(page, TEACHER_USERNAME, TEACHER_LANDING.landing, TEACHER_LANDING.heading);
    const extraction = {
      status: 'success',
      exam_type: 'Prova',
      duration_minutes: 90,
      title: 'Regressão visual sintética — Física',
      class_grade: '12',
      subject_name: 'Física',
      questions: [{
        number: '5',
        type: 'composta',
        groupLayout: 'brace',
        confidence: 0.95,
        text: 'Para o intervalo [2; 4] s, calcule: $\\vec{v}$',
        formulas: [{ raw: '\\vec{v}', latex: '\\vec{v}', confidence: 0.95, kind: 'formula' }],
        subitems_content: [
          { label: 'a', type: 'dissertativa', text: 'o deslocamento' },
          { label: 'b', type: 'dissertativa', text: 'a velocidade média' },
          { label: 'c', type: 'dissertativa', text: 'a aceleração média' },
        ],
      }],
      warnings: [],
    };
    await mockAsyncOcrJob(page, extraction);

    await page.goto('/manager/exam-builder?importar=1');
    await expect(page.getByText('Importar de imagem ou PDF')).toBeVisible();
    await page.getByLabel('Escolher ficheiros da prova').setInputFiles({
      name: 'ocr-physics-brace.pdf',
      mimeType: 'application/pdf',
      buffer: samplePdf(),
    });
    await page.getByTestId('gestor-statements-import-submeter').click();

    const sheet = page.locator('#exam-sheet');
    await expect(sheet).toContainText('Para o intervalo [2; 4] s, calcule:');
    for (const text of ['o deslocamento', 'a velocidade média', 'a aceleração média']) {
      await expect(sheet.getByText(text, { exact: true })).toBeVisible();
    }
    const brace = sheet.getByTestId('group-brace');
    await expect(brace).toBeVisible();
    await expect(sheet).not.toContainText('a) o deslocamento');
    await page.getByText(/Prova lida/).waitFor({ state: 'hidden' });

    const originalViewport = page.viewportSize() ?? { width: 1280, height: 900 };
    for (const width of [375, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      // Abaixo de `lg` a folha só se vê na vista «Pré-visualizar» (#537).
      if (width < 1024) await page.getByRole('group', { name: 'Vista do construtor' }).getByRole('button', { name: 'Pré-visualizar' }).click();
      const geometry = await brace.evaluate((element) => {
        const braceRect = element.getBoundingClientRect();
        const list = element.parentElement?.querySelector('ol');
        if (!list) throw new Error('Lista de alíneas não encontrada junto à chaveta.');
        const listRect = list.getBoundingClientRect();
        return {
          braceTop: braceRect.top,
          braceBottom: braceRect.bottom,
          listTop: listRect.top,
          listBottom: listRect.bottom,
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
        };
      });
      expect(Math.abs(geometry.braceTop - geometry.listTop), `topo da chaveta a ${width}px`).toBeLessThanOrEqual(1.5);
      expect(Math.abs(geometry.braceBottom - geometry.listBottom), `base da chaveta a ${width}px`).toBeLessThanOrEqual(1.5);
      expect(geometry.documentWidth, `overflow horizontal a ${width}px`).toBeLessThanOrEqual(geometry.viewportWidth);
      if (width === 375) {
        const mobileEvidencePath = resolve(process.cwd(), 'docs/visual-evidence/ocr-physics/group-brace-mobile-375.png');
        await sheet.screenshot({ path: mobileEvidencePath });
        await testInfo.attach('group-brace-mobile-375.png', {
          path: mobileEvidencePath,
          contentType: 'image/png',
        });
      }
    }
    await page.setViewportSize(originalViewport);
    const builderEvidencePath = resolve(process.cwd(), 'docs/visual-evidence/ocr-physics/group-brace-builder.png');
    await sheet.screenshot({ path: builderEvidencePath });
    await testInfo.attach('group-brace-builder.png', {
      path: builderEvidencePath,
      contentType: 'image/png',
    });

    await page.emulateMedia({ media: 'print' });
    await expect(brace).toBeVisible();
    const pdf = await page.pdf({
      path: resolve(process.cwd(), 'docs/visual-evidence/ocr-physics/group-brace-print.pdf'),
      printBackground: true,
      preferCSSPageSize: true,
    });
    await testInfo.attach('group-brace-print.pdf', { body: pdf, contentType: 'application/pdf' });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    await page.emulateMedia({ media: 'screen' });

    // Por CSS: com o modal aberto o fundo sai da árvore de acessibilidade e o getByRole deixa de o ver.
    const renderedQuestion = page.locator('[role="group"][aria-label="Enunciado comum da questão 1"]');
    // Desenhado, o enunciado deixa de ser um «textbox» morto: cada fórmula é um botão (#531).
    await expect(renderedQuestion).toHaveAttribute('role', 'group');
    await expect(renderedQuestion.getByRole('button', { name: /^Editar fórmula/ })).toHaveCount(1);
    await expect(renderedQuestion.locator('.katex')).toBeVisible();
    const formulaToggle = page.getByRole('button', { name: 'Inserir fórmula' }).first();
    await formulaToggle.click();
    const formulaDialog = page.getByRole('dialog', { name: 'Inserir fórmula' });
    const vectorButton = formulaDialog.getByRole('button', { name: 'Inserir modelo Vetor' });
    const systemButton = formulaDialog.getByRole('button', { name: 'Inserir modelo Sistema' });
    await expect(vectorButton.locator('.katex')).toBeVisible();
    await expect(systemButton.locator('.katex')).toBeVisible();
    await expect(renderedQuestion).toHaveAttribute('role', 'group');

    const formulaEvidencePath = resolve(process.cwd(), 'docs/visual-evidence/ocr-physics/formula-picker-rendered-symbols.png');
    await page.locator('body').screenshot({ path: formulaEvidencePath });
    await testInfo.attach('formula-picker-rendered-symbols.png', {
      path: formulaEvidencePath,
      contentType: 'image/png',
    });
    await vectorButton.click();
    await expect.poll(async () => formulaDialog.locator('math-field').evaluate((element) => (element as HTMLElement & { value: string }).value)).toContain('\\vec{v}');
    await formulaDialog.getByRole('button', { name: 'Inserir fórmula' }).first().click();
    await expect(renderedQuestion).toHaveAttribute('role', 'group');
    await expect(renderedQuestion.locator('.katex')).toHaveCount(2);

    await page.getByRole('button', { name: 'Inserir fórmula' }).first().click();
    const systemDialog = page.getByRole('dialog', { name: 'Inserir fórmula' });
    await systemDialog.getByRole('button', { name: 'Inserir modelo Sistema' }).click();
    await expect.poll(async () => systemDialog.locator('math-field').evaluate((element) => (element as HTMLElement & { value: string }).value)).toContain('\\begin{cases}');
    await systemDialog.getByRole('button', { name: 'Inserir fórmula' }).first().click();
    await expect(renderedQuestion.locator('.katex')).toHaveCount(3);
  });

  test('construtor: a fórmula desenhada edita-se pelo teclado e Esc não a descarta sem aviso (#531)', async ({ page }) => {
    await managerLogin(page, TEACHER_USERNAME, TEACHER_LANDING.landing, TEACHER_LANDING.heading);
    await page.goto('/manager/exam-builder');
    await page.getByRole('textbox', { name: 'Questão 1' }).fill('Sendo $x^{2}$ e $y$, calcule.');
    await page.getByRole('button', { name: 'Ver fórmula renderizada' }).first().click();

    // Cada fórmula é alcançável por Tab e tem um nome próprio.
    const group = page.getByRole('group', { name: 'Questão 1' });
    const second = group.getByRole('button', { name: 'Editar fórmula 2' });
    await expect(group.getByRole('button', { name: /^Editar fórmula/ })).toHaveCount(2);
    await group.getByRole('button', { name: 'Editar fórmula 1' }).focus();
    await page.keyboard.press('Tab');
    await expect(second).toBeFocused();

    // Enter abre o editor com o LaTeX dessa fórmula, e não vazio.
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Editar fórmula' });
    const mathfield = dialog.locator('math-field');
    const latex = () => mathfield.evaluate((element) => (element as HTMLElement & { value: string }).value);
    await expect.poll(latex).toBe('y');

    // Sem alterar nada, Esc fecha logo.
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // Com a fórmula alterada, Esc pede confirmação e não perde o trabalho.
    await second.click();
    await expect.poll(latex).toBe('y');
    await mathfield.evaluate((element) => {
      const field = element as HTMLElement & { setValue: (value: string) => void };
      field.setValue('z^{3}');
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.keyboard.press('Escape');
    await expect(dialog.getByRole('alert')).toContainText('Descartar a fórmula');
    await expect(dialog.getByRole('button', { name: 'Continuar a editar' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Continuar a editar' }).click();
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    await expect.poll(latex).toBe('z^{3}');

    // Substituir troca só essa fórmula, no mesmo sítio do texto.
    await dialog.getByRole('button', { name: 'Substituir fórmula' }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole('button', { name: 'Ajustar enunciado' }).first().click();
    await expect(page.getByRole('textbox', { name: 'Questão 1' })).toHaveValue('Sendo $x^{2}$ e $z^{3}$, calcule.');
  });

  test('construtor: falha do MathLive mantém edição de fórmula em LaTeX', async ({ page }, testInfo) => {
    await managerLogin(page, TEACHER_USERNAME, TEACHER_LANDING.landing, TEACHER_LANDING.heading);
    await page.goto('/manager/exam-builder');
    const blockedMathLiveChunks: string[] = [];
    await page.route('**/_next/static/chunks/**', async (route) => {
      const response = await route.fetch();
      const content = await response.body();
      if (content.toString('utf8').includes('mathVirtualKeyboard')) {
        blockedMathLiveChunks.push(route.request().url());
        await route.abort();
        return;
      }
      await route.fulfill({ response, body: content });
    });
    await page.getByRole('button', { name: 'Inserir fórmula' }).first().click();

    const dialog = page.getByRole('dialog', { name: 'Inserir fórmula' });
    await expect.poll(() => blockedMathLiveChunks.length).toBe(1);
    await expect(dialog.getByRole('status')).toContainText('editor visual não carregou');
    const latexInput = dialog.getByRole('textbox', { name: 'Fórmula em LaTeX' });
    await expect(latexInput).toBeVisible();
    await latexInput.fill('\\frac{1}{2}');
    const fallbackEvidencePath = resolve(process.cwd(), 'docs/visual-evidence/ocr-physics/mathlive-latex-fallback.png');
    await dialog.screenshot({ path: fallbackEvidencePath });
    await testInfo.attach('mathlive-latex-fallback.png', {
      path: fallbackEvidencePath,
      contentType: 'image/png',
    });
    await dialog.getByRole('button', { name: 'Inserir fórmula', exact: true }).last().click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#exam-sheet .katex')).toBeVisible();

    await page.getByRole('button', { name: 'Inserir fórmula' }).first().click();
    const reopenedDialog = page.getByRole('dialog', { name: 'Inserir fórmula' });
    await expect(reopenedDialog.getByRole('status')).toContainText('editor visual não carregou');
    await page.keyboard.press('Escape');
    await expect(reopenedDialog).toHaveCount(0);
  });

  test('admin: gera, lista e revoga um código de matrícula', async ({ page }) => {
    await managerLogin(page, ADMIN_USERNAME, ADMIN_LANDING.landing, ADMIN_LANDING.heading);
    await page.goto('/manager/classes');

    // A lista de turmas é o sítio onde a escola emite o código (#255). 12B é a turma
    // semeada; o botão leva o código da turma no nome acessível.
    await page.getByRole('button', { name: /Códigos de matrícula de 12B/ }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /Códigos de matrícula/ })).toBeVisible();

    await dialog.getByLabel('Usos').fill('2');
    await dialog.getByRole('button', { name: 'Gerar' }).click();

    const item = dialog.locator('ul li').first();
    await expect(item).toBeVisible();
    await expect(item).toContainText('0/2 usos');
    await expect(item.getByText('Ativo')).toBeVisible();
    // O backend gera 8 caracteres do alfabeto sem O/0/I/1/L.
    const code = (await item.locator('button').first().textContent())?.trim() ?? '';
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);

    page.on('dialog', (confirm) => confirm.accept());
    await item.getByRole('button', { name: 'Revogar' }).click();
    await expect(item.getByText('Revogado')).toBeVisible();
    await expect(item.getByRole('button', { name: 'Revogar' })).toHaveCount(0);
  });

  test('admin: cria escola e turma e regressa ao dashboard', async ({ page }) => {
    const id = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
    await managerLogin(page, ADMIN_USERNAME, ADMIN_LANDING.landing, ADMIN_LANDING.heading);

    await page.goto('/manager/institutions/new');
    await page.getByLabel('Código').fill(`E2E${id}`);
    await page.getByLabel('Nome').fill(`Escola E2E ${id}`);
    await page.getByLabel('Sigla').fill(`E${id}`);
    // Criar uma instituição leva agora à estrutura dela, não à lista.
    await page.getByRole('button', { name: `Criar instituição` }).click();
    await expect(page).toHaveURL(/\/manager\/institutions\/\d+\/structure\?nova=1/);
    await expect(page.getByText(`Escola E2E ${id}`)).toBeVisible();

    await page.goto('/manager/classes/new');
    await page.getByLabel('Código').fill(`T${id}`);
    await page.getByLabel('Classe').fill('12');
    await escolherOpcao(page.getByLabel('Curso'));
    await escolherOpcao(page.getByLabel('Ano letivo'));
    await page.getByRole('button', { name: 'Criar turma' }).click();
    await expect(page).toHaveURL(/\/manager\/classes$/);

    await page.goto('/manager');
    await expect(page.getByText('Desempenho dos estudantes e estado das provas')).toBeVisible();
  });

  test('sala: o encerrar diz quantos ainda respondem e a tabela filtra por estado (#536)', async ({ page }) => {
    await managerLogin(page, TEACHER_USERNAME, TEACHER_LANDING.landing, TEACHER_LANDING.heading);
    await page.goto('/manager/exam-rooms/1');
    const filtros = page.getByRole('group', { name: 'Filtrar alunos' });
    await expect(filtros).toBeVisible();

    // Cada filtro traz a sua contagem, e a tabela mostra tantas linhas quantas essa contagem diz.
    const total = Number((await filtros.getByRole('button', { name: /^Todos \(/ }).innerText()).match(/\((\d+)\)/)![1]);
    expect(total).toBeGreaterThan(0);
    const porEntrar = filtros.getByRole('button', { name: /^Ainda não entraram \(/ });
    const esperado = Number((await porEntrar.innerText()).match(/\((\d+)\)/)![1]);
    await porEntrar.click();
    await expect(porEntrar).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('table').first().locator('tbody tr')).toHaveCount(esperado);
    await filtros.getByRole('button', { name: /^Todos \(/ }).click();
    await expect(page.locator('table').first().locator('tbody tr')).toHaveCount(total);

    // O diálogo de encerrar diz quantos ainda estão a responder, em vez de um aviso genérico.
    const respondem = Number((await filtros.getByRole('button', { name: /^A responder \(/ }).innerText()).match(/\((\d+)\)/)![1]);
    await page.getByRole('button', { name: 'Encerrar', exact: true }).click();
    const dialogo = page.getByRole('alertdialog');
    if (respondem > 0) {
      await expect(dialogo).toContainText(`${respondem} ainda a responder`);
      await expect(dialogo).toContainText(respondem === 1 ? '1 aluno ainda está a responder' : `${respondem} alunos ainda estão a responder`);
    } else {
      await expect(dialogo).toContainText('Ninguém está a responder neste momento');
    }
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toHaveCount(0);
  });

  test('gestor: o formulário valida ao sair do campo e permite guardar e criar outro (#533)', async ({ page }) => {
    const id = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
    await managerLogin(page, ADMIN_USERNAME, ADMIN_LANDING.landing, ADMIN_LANDING.heading);
    await page.goto('/manager/subjects/new');
    const code = page.locator('#code');
    const name = page.locator('#name');

    // Ao sair de um campo obrigatório vazio o erro aparece ligado a ele.
    await code.focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#code-erro')).toHaveText('Campo obrigatório');
    await expect(code).toHaveAttribute('aria-invalid', 'true');
    await expect(code).toHaveAccessibleDescription('Campo obrigatório');
    await expect(page.locator('#name-erro')).toHaveCount(0);

    // Um envio inválido resume o que falta e põe o foco no primeiro campo com erro.
    // O clique tem de chegar ao botão mesmo com o foco num campo vazio.
    await name.focus();
    await page.getByRole('button', { name: /^Criar/ }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'por corrigir' })).toHaveText('Há 2 campos por corrigir: Código, Nome.');
    await expect(code).toBeFocused();

    // Guardar e criar outro: cria, limpa o formulário e deixa o foco no primeiro campo.
    await code.fill(`S${id}`);
    await name.fill(`Disciplina ${id}`);
    await page.getByRole('button', { name: 'Guardar e criar outro' }).click();
    await expect(page.getByText(/criada/).first()).toBeVisible();
    await expect(page).toHaveURL(/\/manager\/subjects\/new$/);
    await expect(code).toHaveValue('');
    await expect(name).toHaveValue('');
    await expect(code).toBeFocused();
    await expect(page.getByRole('alert').filter({ hasText: 'por corrigir' })).toHaveCount(0);
    await expect(page.locator('[id$="-erro"]')).toHaveCount(0);

    // A disciplina criada está na lista.
    await page.goto('/manager/subjects');
    await expect(page.getByText(`S${id}`)).toBeVisible();

    // Na edição não há «criar outro», e a escola nova (que tem o seu assistente) também não o oferece.
    await page.getByRole('link', { name: /Editar/ }).first().click();
    await expect(page.getByRole('button', { name: 'Guardar alterações' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar e criar outro' })).toHaveCount(0);
    await page.goto('/manager/institutions/new');
    await expect(page.getByRole('button', { name: 'Criar instituição' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar e criar outro' })).toHaveCount(0);
  });

  test('construtor: o motivo dos botões desativados é texto e há Editar/Pré-visualizar no tablet (#537)', async ({ page }) => {
    await managerLogin(page, TEACHER_USERNAME, TEACHER_LANDING.landing, TEACHER_LANDING.heading);
    await page.goto('/manager/exam-builder');
    const guardar = page.getByRole('button', { name: 'Guardar', exact: true });
    const resumo = page.locator('#construtor-pendencias');

    // O motivo é texto visível e fica ligado ao botão, em vez de viver só num `title`.
    await expect(resumo).toContainText('Para guardar faltam:');
    await expect(guardar).toBeDisabled();
    await expect(guardar).toHaveAccessibleDescription(/Para guardar faltam/);
    await expect(guardar).not.toHaveAttribute('title', /.+/);

    // Em ecrã largo a folha está ao lado e o alternador não existe.
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByRole('group', { name: 'Vista do construtor' })).toBeHidden();
    await expect(page.locator('#exam-sheet')).toBeVisible();

    // Abaixo de `lg` mostra-se uma vista de cada vez, e a impressão continua a ter a folha.
    await page.setViewportSize({ width: 768, height: 1024 });
    const vista = page.getByRole('group', { name: 'Vista do construtor' });
    await expect(vista).toBeVisible();
    await expect(page.getByLabel('Título')).toBeVisible();
    await expect(page.locator('#exam-sheet')).toBeHidden();
    await vista.getByRole('button', { name: 'Pré-visualizar' }).click();
    await expect(vista.getByRole('button', { name: 'Pré-visualizar' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#exam-sheet')).toBeVisible();
    await expect(page.getByLabel('Título')).toBeHidden();
    await vista.getByRole('button', { name: 'Editar' }).click();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#exam-sheet')).toBeVisible();
    await page.emulateMedia({ media: 'screen' });

    // Com a prova pronta o resumo desaparece e o botão deixa de ter descrição.
    await escolherOpcao(page.getByLabel('Disciplina'));
    await escolherOpcao(page.getByLabel(/^Turma/));
    await page.getByRole('textbox', { name: 'Questão 1' }).fill('Quanto é 2 + 2?');
    await page.getByRole('spinbutton', { name: 'Cotação da questão 1' }).fill('20');
    await expect(resumo).toHaveCount(0);
    await expect(guardar).toBeEnabled();
  });

  test('construtor: o aviso de prova guardada vê-se na vista Pré-visualizar e cada botão lê só o seu motivo (#537)', async ({ page }) => {
    await managerLogin(page, TEACHER_USERNAME, TEACHER_LANDING.landing, TEACHER_LANDING.heading);
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/manager/exam-builder');
    const guardar = page.getByRole('button', { name: 'Guardar', exact: true });
    const publicar = page.getByRole('button', { name: 'Publicar', exact: true });
    await escolherOpcao(page.getByLabel('Disciplina'));
    await escolherOpcao(page.getByLabel(/^Turma/));
    await page.getByRole('textbox', { name: 'Questão 1' }).fill('Quanto é 2 + 2?');

    // Falta a cotação: dá para guardar, e «Guardar» não lê o problema que só trava «Publicar».
    await expect(guardar).toBeEnabled();
    await expect(guardar).toHaveAccessibleDescription('');
    await expect(publicar).toBeDisabled();
    await expect(publicar).toHaveAccessibleDescription(/Para publicar, corrija 1 ponto/);

    // Guarda-se na vista Pré-visualizar: o aviso tem de se ver e ouvir mesmo com o painel Editar escondido.
    const vista = page.getByRole('group', { name: 'Vista do construtor' });
    await vista.getByRole('button', { name: 'Pré-visualizar' }).click();
    await expect(page.getByLabel('Título')).toBeHidden();
    await guardar.click();
    await expect(page.getByRole('status').filter({ hasText: 'Prova guardada' })).toBeVisible();

    // Já guardada, sem alterações: os botões dizem porque estão desativados.
    await expect(guardar).toBeDisabled();
    await expect(page.locator('#construtor-estado')).toContainText('já está guardada');
    await expect(guardar).toHaveAccessibleDescription(/já está guardada/);
  });

  test('perfil: cada separador mostra o seu conteudo uma unica vez', async ({ page }) => {
    // Reproduz a #240: dois `TabsContent` com o mesmo `value` montam-se os dois, e
    // o aluno lê a mesma prova como se a tivesse feito duas vezes. Compila, passa o
    // lint e o type checking — nada o apanha, porque não há sintaxe inválida.
    //
    // O teste conta. E conta nos quatro separadores, porque o padrão de duplicação
    // pode ter escapado noutro ecrã.
    await page.goto('/aluno/entrar');
    await page.getByLabel('Utilizador ou email').fill('12345');
    await page.locator('#password').fill(PASSWORD);
    await page.getByTestId('aluno-entrar-submeter').click();
    await expect(page).toHaveURL(/\/aluno\/inicio/);

    await page.goto('/aluno/perfil');

    // O invariante nao depende dos dados: um `TabsContent` por separador. Com dois
    // blocos de mesmo `value`, o Radix monta os dois e o `tabpanel` aparece duas
    // vezes — que e a raiz do bug da #240, e vale para todos os separadores.
    const separadores = ['Publicações', 'Experiência', 'Conquistas', 'Definições'];
    await expect(page.getByRole('tab'), `esperava ${separadores.length} separadores`).toHaveCount(separadores.length);

    for (const separador of separadores) {
      await page.getByRole('tab', { name: separador }).click();
      const painel = page.getByRole('tabpanel');
      await expect(painel, `separador ${separador}: esperava um unico painel`).toHaveCount(1);
      // E que o painel nao esteja vazio: um separador que abre em branco tambem e um bug.
      await expect(painel.locator('*').first(), `separador ${separador}: painel vazio`).toBeVisible();
    }

    // E o sintoma que o aluno via: o cartao de dominio aparece uma vez so.
    await page.getByRole('tab', { name: 'Conquistas' }).click();
    await expect(page.getByRole('tabpanel').getByText('Domínio por prova')).toHaveCount(1);
  });
 
  test('moderação: um perfil ocultado devolve 404 a terceiros (#323)', async ({ page }) => {
    // Critério de aceitação da #323. A conta 7 está semeada como ocultada no mock:
    // os dois mocks são processos separados, portanto uma decisão tomada no Manager
    // não chega ao app do aluno enquanto o backend real não existir. O que o teste
    // prova é o critério — ocultado é 404 — e não o transporte da decisão, que esse
    // fica para quando houver backend.
    await page.goto('/aluno/entrar');
    await page.getByLabel('Utilizador ou email').fill('12345');
    await page.locator('#password').fill(PASSWORD);
    await page.getByTestId('aluno-entrar-submeter').click();
    await expect(page).toHaveURL(/\/aluno\/inicio/);

    // Uma conta visível abre. O nome aparece duas vezes — no `h1` da página e no `h2`
    // do cartão — por isso o alvo é o `h1`, que é o que a página é.
    await page.goto('/aluno/u/4');
    await expect(page.getByRole('heading', { level: 1, name: 'Nuno Dias' })).toBeVisible();

    // A ocultada devolve 404, e não uma página a dizer que foi ocultada: dizer isso
    // seria confirmar que o perfil existe.
    const resposta = await page.goto('/aluno/u/7');
    expect(resposta?.status(), '/aluno/u/7 é um perfil ocultado e tem de dar 404').toBe(404);
    // O 404 é o mesmo do resto da app: não diz que o perfil foi ocultado, porque
    // dizer isso seria confirmar que o perfil existe.
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible();
    await expect(page.getByText('Perfil Oculto')).toHaveCount(0);
  });

  test('avatares: a foto do aluno aparece em todo o inicio depois de a por (#345)', async ({ page }) => {
    // #345: o UserAvatar so mostra a foto se lhe passarem `src`; os avatares do proprio
    // aluno sem src caiam nas iniciais sem dar erro nenhum. Aqui exige-se a foto no ecra,
    // nas mesmas suturas que a issue apontou, e nao apenas no codigo.
    const PHOTO = '/uploads/images/avatar/e2e-345.png';
    // O mock guarda o endereco mas nao serve o ficheiro: serve-se uma imagem real para o
    // AvatarImage carregar em vez de cair no fallback.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAEklEQVR4nGP8z8Dwn4EIwDiqkL4KAcb1B0cAAAAASUVORK5CYII=', 'base64');
    await page.route('**/uploads/images/avatar/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: png }));

    await page.goto('/aluno/entrar');
    await page.getByLabel('Utilizador ou email').fill('12345');
    await page.locator('#password').fill(PASSWORD);
    await page.getByTestId('aluno-entrar-submeter').click();
    await expect(page).toHaveURL(/\/aluno\/inicio/);

    // Pelo editor: o upload do ficheiro vai a /images, que o mock nao serve, por isso
    // escreve-se o endereco no campo escondido e submete-se o formulario.
    await page.goto('/aluno/perfil?editar=1');
    await page.locator('input[name="photo"]').first().evaluate((el, value) => {
      (el as HTMLInputElement).value = value;
      el.closest('form')!.requestSubmit();
    }, PHOTO);
    await expect(page.getByRole('button', { name: 'Editar perfil' })).toBeVisible();

    await page.goto('/aluno/inicio');
    await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible();
    // Abrir os comentarios para o compositor aparecer.
    await page.getByRole('button', { name: /Comentar/ }).first().click();

    const foto = '[data-slot="avatar"] img[src*="e2e-345.png"]';
    // Cabecalho (a barra lateral, visivel a partir de md). O href leva o basePath /aluno.
    await expect(page.locator(`header:visible button[aria-haspopup="menu"] ${foto}`)).toBeVisible();
    // "O teu progresso", na coluna da direita.
    await expect(page.locator('section:visible').filter({ hasText: 'O teu progresso' }).locator(foto).first()).toBeVisible();
    // "Na tua turma": a propria linha ("Tu") tambem e o proprio aluno.
    await expect(page.locator('section:visible').filter({ hasText: 'Na tua turma' }).locator(foto).first()).toBeVisible();
    // Autor da publicacao, que e o proprio aluno.
    await expect(page.locator('article').filter({ hasText: 'subnetting' }).locator(foto).first()).toBeVisible();
    // Compositor de comentarios, na publicacao aberta.
    await expect(page.getByLabel('Escrever um comentário').locator('xpath=ancestor::form[1]').locator(foto)).toBeVisible();
  });

  test('construtor: abre limpo e so retoma o rascunho anterior depois de avisar (#362)', async ({ page }) => {
    await managerLogin(page, TEACHER_USERNAME, TEACHER_LANDING.landing, TEACHER_LANDING.heading);

    // Um rascunho anterior com trabalho por guardar era o que entrava sozinho no
    // construtor, mesmo sendo de outra escola ou de há semanas (#362).
    const rascunho = {
      schoolId: '',
      title: 'Prova de OGI da semana passada',
      items: [{ text: 'Qual é a capital de Angola?', points: 2, options: [] }],
    };
    // Semeia-se a cada navegação, antes de o app arrancar: semear na página anterior
    // deixava o efeito de guardar do construtor (que corre quando as escolas chegam)
    // apagar a chave antes de a nova página a ler.
    await page.addInitScript((d) => {
      localStorage.setItem('kixi-exam-draft', JSON.stringify(d));
    }, rascunho);

    let avisos = 0;
    let aceitar = false;
    page.on('dialog', async (d) => {
      avisos += 1;
      if (aceitar) await d.accept();
      else await d.dismiss();
    });

    // Recusar (começar do zero): o formulário abre limpo e a chave desaparece.
    await page.goto('/manager/exam-builder');
    await expect(page.getByRole('heading', { name: 'Montar prova' })).toBeVisible();
    await expect.poll(() => avisos, { message: 'esperava o aviso do rascunho anterior' }).toBe(1);
    await expect(page.getByLabel('Título')).toHaveValue('');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('kixi-exam-draft'))).toBeNull();

    // Aceitar: o rascunho anterior volta.
    aceitar = true;
    await page.goto('/manager/exam-builder');
    await expect(page.getByLabel('Título')).toHaveValue('Prova de OGI da semana passada');
    await expect.poll(() => avisos).toBe(2);
  });
 });
