import { test, expect, type Page } from '@playwright/test';

/**
 * A escola da doação numa lista (#763). O backend público só existe em
 * creative-mode/kixi#597, por isso as respostas do catálogo e da sessão são
 * simuladas aqui — o que se testa é o ecrã: escolher, procurar pela sigla,
 * «Outra» e o texto livre quando a lista não chega.
 */
const PASSWORD = process.env.E2E_PASSWORD ?? 'Kixi1234!';
const ADMIN = process.env.E2E_ADMIN_USERNAME ?? 'admin@kixi.ao';

const SCHOOLS = [
  { id: 3, name: 'Instituto de Telecomunicações', code: 'ITEL' },
  { id: 5, name: 'Escola 5 de Abril', acronym: 'E5A' },
];

/** A lista que a landing lê e a escola da sessão (sem sessão, por omissão). */
async function catalogar(page: Page, { schools = SCHOOLS, session = null as null | { id: number; name: string; code: string } } = {}) {
  await page.route('**/api/institutions', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ institutions: schools }) }),
  );
  await page.route('**/api/doar/institution', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ institution: session, school: session }) }),
  );
}

/** Segura a lista até `libertar()`: reproduz quem escreve enquanto ela carrega. */
async function listaAtrasada(page: Page, schools = SCHOOLS) {
  let libertar!: () => void;
  const chegou = new Promise<void>((resolve) => {
    libertar = resolve;
  });
  await page.route('**/api/institutions', async (route) => {
    await chegou;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ institutions: schools }),
    });
  });
  await page.route('**/api/doar/institution', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ institution: null }) }),
  );
  return libertar;
}

/** Um PDF entra sem análise de imagem e leva ao passo da origem. */
async function carregarEnunciado(page: Page) {
  await page.goto('/doar');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'enunciado.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'),
  });
  await expect(page.locator('.dn-files__item')).toHaveCount(1);
  await expect(page.getByText(/1 folha/)).toBeVisible();
  await expect(page.locator('.dn-files__size')).not.toHaveText('a reduzir…');
  // O aviso de envio e a preparação do ficheiro assentam antes do passo seguinte.
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByLabel('Instituição')).toBeVisible();
}

function campoOculto(page: Page, name: 'institutionName' | 'institutionId') {
  return page.locator(`input[type="hidden"][name="${name}"]`);
}

/** Preenche o resto do passo e confirma que a validação aceitou a escola. */
async function continuarDaOrigem(page: Page) {
  await page.getByLabel('Disciplina').fill('Matemática');
  await page.getByLabel('Tipo de prova').selectOption('Teste');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByLabel(/Tenho direito/)).toBeVisible();
}

test.describe('doação: a escola numa lista (#763)', () => {
  test('procura pela sigla, escolhe a escola e envia o nome canónico com o id', async ({ page }) => {
    await catalogar(page);
    await carregarEnunciado(page);

    const combo = page.getByRole('combobox', { name: 'Instituição' });
    await expect(combo).toBeVisible();
    await combo.fill('itel');
    const itel = page.getByRole('option', { name: /Instituto de Telecomunicações/ });
    await expect(itel).toBeVisible();
    await itel.click();

    await expect(combo).toHaveValue('Instituto de Telecomunicações (ITEL)');
    await expect(campoOculto(page, 'institutionName')).toHaveValue('Instituto de Telecomunicações');
    await expect(campoOculto(page, 'institutionId')).toHaveValue('3');
    await continuarDaOrigem(page);
  });

  test('«Outra» deixa escrever o nome e não inventa um id', async ({ page }) => {
    await catalogar(page);
    await carregarEnunciado(page);

    await page.getByRole('combobox', { name: 'Instituição' }).click();
    await page.getByRole('option', { name: 'Outra escola…' }).click();

    const livre = page.getByLabel('Instituição');
    await expect(livre).toHaveValue('');
    await livre.fill('Colégio Sem Catálogo');
    await expect(campoOculto(page, 'institutionName')).toHaveValue('Colégio Sem Catálogo');
    await expect(campoOculto(page, 'institutionId')).toHaveCount(0);
    // O botão de voltar existe e o texto livre continua a deixar seguir.
    await expect(page.getByRole('button', { name: 'Escolher da lista' })).toBeVisible();
    await continuarDaOrigem(page);
  });

  test('o que se escreve enquanto a lista carrega não desaparece', async ({ page }) => {
    const libertar = await listaAtrasada(page);

    await carregarEnunciado(page);
    const livre = page.getByLabel('Instituição');
    await expect(livre).toHaveAttribute('placeholder', 'A carregar as escolas…');
    await livre.fill('Escola Escrita Antes Da Lista');
    libertar();

    // Não é uma escola da lista: o texto conserva-se tal como foi escrito, em
    // vez de virar uma pesquisa que a doação enviaria sem nome.
    await expect(page.getByText('Escreve o nome da escola que não está na lista.')).toBeVisible();
    const depois = page.getByLabel('Instituição');
    await expect(depois).toHaveValue('Escola Escrita Antes Da Lista');
    await expect(depois).toBeFocused();
    await expect(page.getByRole('button', { name: 'Escolher da lista' })).toBeVisible();
    await expect(campoOculto(page, 'institutionName')).toHaveValue('Escola Escrita Antes Da Lista');
    await expect(campoOculto(page, 'institutionId')).toHaveCount(0);
    await continuarDaOrigem(page);
  });

  test('se o texto escrito durante o carregamento for uma escola, passa a escolha com id', async ({ page }) => {
    const libertar = await listaAtrasada(page);

    await carregarEnunciado(page);
    const livre = page.getByLabel('Instituição');
    await expect(livre).toHaveAttribute('placeholder', 'A carregar as escolas…');
    await livre.fill('itel');
    libertar();

    const combo = page.getByRole('combobox', { name: 'Instituição' });
    await expect(combo).toHaveValue('Instituto de Telecomunicações (ITEL)');
    await expect(combo).toBeFocused();
    await expect(campoOculto(page, 'institutionName')).toHaveValue('Instituto de Telecomunicações');
    await expect(campoOculto(page, 'institutionId')).toHaveValue('3');
    await continuarDaOrigem(page);
  });

  test('sem lista, o texto livre de sempre continua a deixar doar', async ({ page }) => {
    await page.route('**/api/institutions', (route) => route.abort('failed'));
    await carregarEnunciado(page);

    const livre = page.getByLabel('Instituição');
    await expect(page.getByText('A lista de escolas não está disponível')).toBeVisible();
    await expect(livre).toHaveAttribute('placeholder', 'Escreve o nome da escola');
    await livre.fill('Escola Fora Do Catálogo');
    await expect(campoOculto(page, 'institutionName')).toHaveValue('Escola Fora Do Catálogo');
    await expect(campoOculto(page, 'institutionId')).toHaveCount(0);
    await continuarDaOrigem(page);
  });

  test('com sessão, a escola do aluno vem pré-seleccionada', async ({ page }) => {
    await catalogar(page, { session: { id: 3, name: 'Instituto de Telecomunicações', code: 'ITEL' } });
    await carregarEnunciado(page);

    const combo = page.getByRole('combobox', { name: 'Instituição' });
    await expect(combo).toHaveValue('Instituto de Telecomunicações (ITEL)');
    await expect(campoOculto(page, 'institutionId')).toHaveValue('3');
  });

  test('admin: o filtro por instituição mostra só as doações ligadas', async ({ page }) => {
    await page.goto('/manager/login');
    await page.getByLabel('Nome de utilizador ou e-mail').fill(ADMIN);
    await page.locator('#password').fill(PASSWORD);
    await page.getByTestId('gestor-entrar-submeter').click();
    await expect(page).toHaveURL(/\/manager\/?$/);

    await page.goto('/manager/donations');
    const filtro = page.getByLabel('Instituição');
    await expect(filtro).toBeVisible();
    const linhas = page.locator('table tbody tr');
    await expect(linhas).toHaveCount(2);
    await expect(page.getByRole('button', { name: /^Todas/ })).toHaveText('Todas (3)');

    await filtro.selectOption({ label: 'Instituto de Telecomunicações' });
    await expect(linhas).toHaveCount(1);
    await expect(linhas.first()).toContainText('ITEL');
    // Com o filtro activo os contadores globais deixariam de ser os do ecrã.
    await expect(page.getByRole('button', { name: /^Todas/ })).toHaveText('Todas');
  });
});
