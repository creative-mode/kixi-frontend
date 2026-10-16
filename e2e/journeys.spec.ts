import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';

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
});

test.afterEach(() => {
  expect(erros, `a página lançou ${erros.length} erro(s): ${erros.map((e) => e.message).join(' | ')}`).toEqual([]);
});

test.describe('jornadas críticas do Kixi', () => {
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

    await page.locator('#escola').selectOption({ label: 'Instituto de Telecomunicações' });
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.locator('#curso')).toBeVisible();
    await page.locator('#curso').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.locator('#classId')).toBeVisible();
    await page.locator('#classId').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Entrar na turma' }).click();
    await expect(page).toHaveURL(/\/aluno\/inicio/);

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
    // O `Field` do construtor renderiza o `<Label>` sem `htmlFor`, portanto
    // `getByLabel` nao chega aqui. Os selects vao por posicao, como no flow.mjs:
    // Escola, Disciplina, Turma.
    const selects = page.locator('select');
    await selects.nth(1).selectOption({ index: 1 });
    await selects.nth(2).selectOption({ index: 1 });

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
    await page.getByLabel('Curso').selectOption({ index: 1 });
    await page.getByLabel('Ano letivo').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Criar turma' }).click();
    await expect(page).toHaveURL(/\/manager\/classes$/);

    await page.goto('/manager');
    await expect(page.getByText('Desempenho dos estudantes e estado das provas')).toBeVisible();
  });
});
