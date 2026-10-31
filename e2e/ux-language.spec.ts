import { test, expect } from '@playwright/test';

const PASSWORD = process.env.E2E_PASSWORD ?? 'Kixi1234!';
async function entrarComoAluno(page: import('@playwright/test').Page) {
  await page.goto('/aluno/entrar');
  await page.getByLabel('Utilizador ou email').fill('12345');
  await page.locator('#password').fill(PASSWORD);
  await page.getByTestId('aluno-entrar-submeter').click();
  await expect(page).toHaveURL(/\/aluno\/inicio/);
}

test('os três pontos de entrada apresentam o idioma pt-AO', async ({ page }) => {
  for (const route of ['/manager/login', '/aluno/entrar', '/']) {
    await page.goto(route);
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-AO');
  }

  const manifest = await page.request.get('/manager/manifest.json');
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).lang).toBe('pt-AO');

  await page.goto('/');
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'pt_AO');
});

test('a barra inferior do aluno mostra rótulos e identifica a página atual', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await entrarComoAluno(page);
  await page.goto('/aluno/ranking');

  const nav = page.getByRole('navigation', { name: 'Principal' }).last();
  for (const label of ['Início', 'Provas', 'Ranking', 'Pautas', 'Tutor']) {
    await expect(nav.getByRole('link', { name: label })).toBeVisible();
    await expect(nav.getByRole('link', { name: label })).toContainText(label);
  }
  const active = nav.locator('a[aria-current="page"]');
  await expect(active).toHaveCount(1);
  await expect(active).toContainText('Ranking');
  await expect(active).toHaveClass(/font-semibold/);
});

test('a landing e as páginas de erro mantêm cópia em português', async ({ page }) => {
  await page.goto('/');
  const skip = page.getByRole('link', { name: 'Saltar para o conteúdo' });
  await expect(skip).toHaveAttribute('href', '#conteudo');
  await skip.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#conteudo')).toBeFocused();
  await page.goto('/nao-existe-ux-511');
  await expect(page.getByRole('heading', { name: 'Esta página não existe' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/This page could not be found/i);
});

test('o skip link do aluno encaminha o foco para o conteúdo', async ({ page }) => {
  await entrarComoAluno(page);
  const skip = page.getByRole('link', { name: 'Saltar para o conteúdo' });
  await skip.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#conteudo')).toBeFocused();
});

test('a página de login do gestor usa palavra-passe e não exibe os termos antigos', async ({ page }) => {
  await page.goto('/manager/login');
  await expect(page.getByRole('textbox', { name: 'Nome de utilizador ou e-mail' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Palavra-passe' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/username|senha|salvar|Você precisa estar logado/i);
});
