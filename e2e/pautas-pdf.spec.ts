import { test, expect, type Page } from '@playwright/test';

/**
 * Exportar a pauta e os resultados em PDF (kixi-frontend#808). O PDF chega pelo servidor do gestor; o browser nunca fala com
 * o motor nem com o backend, e o aluno não tem o botão.
 */
const PASSWORD = process.env.E2E_PASSWORD ?? 'Kixi1234!';
const TEACHER = process.env.E2E_TEACHER_USERNAME ?? 'professor@kixi.ao';

test.setTimeout(120_000);

async function professorLogin(page: Page) {
  await page.goto('/manager/login');
  await page.getByLabel('Nome de utilizador ou e-mail').fill(TEACHER);
  await page.locator('#password').fill(PASSWORD);
  await page.getByTestId('gestor-entrar-submeter').click();
  await expect(page).toHaveURL(/\/manager\/professor\/?$/);
}

/** O cartão da pauta de Redes da 12B no trimestre pedido. */
const sheetCard = (page: Page, term: number) =>
  page.getByRole('list', { name: 'Pautas' }).getByRole('listitem').filter({ hasText: 'Redes de Computadores' }).filter({ hasText: '12B' }).filter({ hasText: `${term}.º trimestre` });

/** Todos os pedidos que a página faz: nenhum pode sair da origem do gestor (nem para o motor, nem para o backend). */
function watchOrigins(page: Page, baseURL: string) {
  const foreign: string[] = [];
  const origin = new URL(baseURL).origin;
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.protocol.startsWith('http') && url.origin !== origin) foreign.push(r.url());
  });
  return foreign;
}

test('professor: descarrega o PDF da pauta pelo cartão e pelo detalhe', async ({ page, baseURL }) => {
  const foreign = watchOrigins(page, baseURL ?? 'http://localhost:3000');
  await professorLogin(page);
  await page.goto('/manager/pautas');

  const card = sheetCard(page, 1);
  const fromCard = page.waitForEvent('download');
  await card.getByRole('button', { name: /Exportar PDF da pauta de Redes/ }).click();
  const download = await fromCard;
  expect(download.suggestedFilename()).toMatch(/^pauta-redes-de-computadores-12b-1t-\d{4}-\d{4}\.pdf$/);
  const bytes = await (await download.createReadStream()).toArray();
  expect(Buffer.concat(bytes).subarray(0, 5).toString()).toBe('%PDF-');
  await expect(card.getByText('PDF descarregado.')).toBeVisible();

  await card.getByRole('button', { name: /^Redes de Computadores/ }).click();
  const detail = page.getByRole('region', { name: 'Detalhe da pauta' });
  const fromDetail = page.waitForEvent('download');
  await detail.getByRole('button', { name: 'Exportar pauta em PDF' }).click();
  expect((await fromDetail).suggestedFilename()).toMatch(/^pauta-redes/);

  expect(foreign, 'pedidos para fora do gestor').toEqual([]);
});

test('professor: descarrega o resultado de cada prova com enunciado, e só dessas', async ({ page }) => {
  await professorLogin(page);
  await page.goto('/manager/pautas');
  await sheetCard(page, 1).getByRole('button', { name: /^Redes de Computadores/ }).click();

  const results = page.getByRole('region', { name: 'Resultados das provas em PDF' });
  for (const prova of ['MAC 1', 'P1', 'P2']) await expect(results.getByRole('button', { name: `Exportar PDF do resultado da ${prova}` })).toBeVisible();
  // A MAC 2 não tem enunciado: não há resultado para pedir.
  await expect(results.getByRole('button', { name: /MAC 2/ })).toHaveCount(0);

  const next = page.waitForEvent('download');
  await results.getByRole('button', { name: 'Exportar PDF do resultado da P1' }).click();
  expect((await next).suggestedFilename()).toMatch(/^resultado-p1-redes-de-computadores-12b-1t-/);
});

test('professor: a pauta ainda não homologada diz porque não há PDF', async ({ page }) => {
  await professorLogin(page);
  await page.goto('/manager/pautas');
  const card = sheetCard(page, 3);
  await expect(card.getByText('Provisória: ainda não homologada.')).toBeVisible();
  await card.getByRole('button', { name: /Exportar PDF da pauta/ }).click();
  await expect(card.getByRole('status')).toContainText('O PDF desta pauta ainda não existe');
  // O botão volta a estar disponível para tentar de novo.
  await expect(card.getByRole('button', { name: /Exportar PDF da pauta/ })).toBeEnabled();
});

test('sem sessão, a rota do PDF recusa e não devolve nada do motor', async ({ request }) => {
  const res = await request.get('/manager/api/pautas/PT-MOCK0001/pdf', { maxRedirects: 0 });
  expect(res.status()).toBe(401);
  expect(res.headers()['content-type']).toContain('application/json');
  expect(JSON.stringify(await res.json())).not.toMatch(/https?:\/\//);
});

test('aluno: as suas pautas não têm botão de PDF', async ({ page }) => {
  await page.goto('/aluno/entrar');
  await page.getByLabel('Utilizador ou email').fill('12345');
  await page.locator('#password').fill(PASSWORD);
  await page.getByTestId('aluno-entrar-submeter').click();
  // O primeiro login pode esperar pela compilação da app: mais folga do que o prazo por omissão.
  await expect(page).toHaveURL(/\/aluno\/inicio/, { timeout: 60_000 });
  await page.goto('/aluno/pautas');
  await expect(page.getByRole('heading', { name: 'As minhas pautas' })).toBeVisible();
  await expect(page.getByRole('button', { name: /PDF/ })).toHaveCount(0);

  // Com a sessão do aluno, a rota do gestor também recusa.
  const res = await page.request.get('/manager/api/pautas/PT-MOCK0001/pdf', { maxRedirects: 0 });
  expect([401, 403]).toContain(res.status());
});
