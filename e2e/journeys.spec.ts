import { randomUUID } from 'node:crypto';
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
  // haver escolha, e nalguns ecrãs mais curtos cobria ações reais (ex.: "Estudar os
  // erros com o tutor" no resultado). Pré-semear a escolha é o que um visitante que já
  // respondeu antes tem — não há banner nenhum para testar aqui, só as jornadas por
  // baixo dele.
  await page.addInitScript(() => localStorage.setItem('kixi-consent', 'necessary'));
});

test.afterEach(() => {
  expect(erros, `a página lançou ${erros.length} erro(s): ${erros.map((e) => e.message).join(' | ')}`).toEqual([]);
});

test.describe('jornadas críticas do Kixi', () => {
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
    await expect(page.getByRole('tabpanel').getByRole('link').first()).toBeVisible();
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

    // Desde kixi#255 a auto-matrícula é só o código: a turma e o ano letivo vêm dele,
    // por isso o onboarding deixou de pedir escola/curso/turma. TESTE1234 é o código
    // da turma 12B que o mock semeia.
    await page.getByLabel('Código de matrícula').fill('TESTE1234');
    await page.getByRole('button', { name: 'Entrar na turma' }).click();
    await expect(page).toHaveURL(/\/aluno\/inicio/);
    // Conta nova: o início abre sem o bloco «Começa por aqui» (saiu do início).
    await expect(page.getByRole('region', { name: 'Primeiros passos' })).toHaveCount(0);

    // Follow the catalogue for the class selected during onboarding so the test does
    // not assume a fixed class-to-statement mapping.
    await page.goto('/aluno/provas');
    await page.getByRole('link', { name: 'Ver a prova' }).first().click();
    await page.getByRole('link', { name: 'Começar', exact: true }).click();
    await expect(page).toHaveURL(/\/aluno\/prova\/\d+/);
    await page.getByRole('button', { name: 'Começar', exact: true }).click();
    // O cabeçalho passou a ser "Questão 2 (1 de 12)": o número de exibição e o
// índice de posição deixaram de ser a mesma coisa.
await expect(page.getByText(/\(1 de \d+\)/)).toBeVisible();
    // Resposta deliberadamente errada para o resultado oferecer a ligação ao tutor.
    // Clica-se na linha da opção, não no input: o radio é `sr-only` e o círculo
    // visível é um `<span>` sobreposto, por isso `.check()` no input nunca chega lá.
    await page.locator('label:has(input[type="radio"])').last().click();
    await expect(page.getByText('Resposta guardada. Podes mudá-la até entregares a prova.')).toBeVisible();
    await page.getByRole('button', { name: 'Entregar', exact: true }).first().click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Entregar', exact: true }).click();
    await expect(page).toHaveURL(/\/aluno\/resultado\?prova=/);
    // O `CardTitle` da revisão é um `div`, não um heading, por isso não aparece em
    // `getByRole('heading')`. O alvo estável é o `aria-label` que o card já traz.
    await expect(page.getByLabel('Revisão questão a questão')).toBeVisible();
    await page.getByRole('link', { name: 'Estudar os erros com o tutor' }).click();
    await expect(page).toHaveURL(/\/aluno\/tutor\?statementId=/);
    await expect(page.getByRole('heading', { name: 'Tutor' })).toBeVisible();
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

    // O extrato entra no rascunho. Publicar exige disciplina e turma — o proprio
    // botao diz isso no `title` — e so depois de a prova existir.
    await expect(page.getByText('ocr-sample.pdf')).toBeVisible();
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

    await page.getByRole('link', { name: 'Criar sala com esta prova' }).click();
    await expect(page).toHaveURL(/\/manager\/exam-rooms\/new\?statementId=/);
    await page.getByRole('button', { name: 'Criar sala' }).click();
    await expect(page).toHaveURL(/\/manager\/exam-rooms\/\d+/);
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
