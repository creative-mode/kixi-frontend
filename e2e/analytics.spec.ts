import { test, expect, type Page } from '@playwright/test';

/**
 * Os eventos de analítica ligados aos ecrãs (#714), vistos do lado do `gtag`.
 *
 * No e2e não há `NEXT_PUBLIC_GA_ID`, por isso o Google tag nunca carrega: um `gtag` falso, posto antes de a
 * página correr, manda cada chamada por `sendBeacon` (sobrevive às navegações) e o teste guarda só os
 * `event`. O `set` do contexto e o `js`/`config` não contam.
 */
const PASSWORD = process.env.E2E_PASSWORD ?? 'Kixi1234!';

type Evento = [name: string, params: Record<string, unknown>];

async function apanharEventos(page: Page, consentimento: 'all' | null) {
  const eventos: Evento[] = [];
  await page.route('**/__analytics-teste', async (route) => {
    const args = route.request().postDataJSON() as unknown[];
    if (args[0] === 'event') eventos.push([String(args[1]), (args[2] ?? {}) as Record<string, unknown>]);
    await route.fulfill({ status: 200, body: 'ok' });
  });
  await page.addInitScript((escolha) => {
    if (escolha) localStorage.setItem('kixi-consent', escolha);
    else localStorage.removeItem('kixi-consent');
    (window as unknown as { gtag?: unknown }).gtag = (...args: unknown[]) => {
      void navigator.sendBeacon('/__analytics-teste', JSON.stringify(args));
    };
  }, consentimento);
  const nomes = () => eventos.map(([nome]) => nome);
  const de = (nome: string) => eventos.filter(([n]) => n === nome).map(([, params]) => params);
  return { eventos, nomes, de };
}

test.describe('analítica ligada aos ecrãs (#714)', () => {
  test('landing: page_view canónico ao chegar e scroll_depth uma vez por limiar', async ({ page }) => {
    const { de } = await apanharEventos(page, 'all');
    await page.goto('/?utm_source=whatsapp&utm_medium=social&email=ana%40kixi.ao');

    await expect.poll(() => de('page_view').length, 'page_view da chegada').toBe(1);
    const origem = new URL(page.url()).origin;
    expect(de('page_view')[0]).toEqual({
      app: 'landing', page: 'home', utm_source: 'whatsapp', utm_medium: 'social', page_location: `${origem}/`, page_referrer: '',
    });

    // A apresentação é alta e monta-se depois de chegar: o scroll vai por fração da página, instantâneo
    // (o html tem `scroll-behavior: smooth`), e repete-se até o limiar chegar, como o `irAoFim` da qualidade.
    const irPara = (fracao: number) => page.evaluate((f) => {
      window.scrollTo({ top: Math.round((document.documentElement.scrollHeight - window.innerHeight) * f), behavior: 'instant' });
    }, fracao);
    await expect.poll(async () => { await irPara(0.3); return de('scroll_depth').length; }, { message: 'primeiro limiar', timeout: 15000 }).toBeGreaterThan(0);
    expect(de('scroll_depth')[0]).toMatchObject({ app: 'landing', page: 'home', depth: 25 });
    await expect.poll(async () => { await irPara(1); return de('scroll_depth').map((p) => p.depth); }, { message: 'até ao fim', timeout: 15000 }).toEqual([25, 50, 75, 100]);
    await irPara(0);
    await irPara(1);
    await page.waitForTimeout(500);
    expect(de('scroll_depth').map((p) => p.depth), 'nenhum limiar repetido na mesma montagem').toEqual([25, 50, 75, 100]);
  });

  test('sem escolha não sai nada; ao aceitar sai o page_view desta página e o consent_choice', async ({ page }) => {
    const { eventos, de } = await apanharEventos(page, null);
    await page.goto('/doar');
    await page.waitForLoadState('networkidle');
    expect(eventos, 'sem consentimento').toEqual([]);

    await page.getByRole('button', { name: 'Aceitar' }).click();
    await expect.poll(() => de('consent_choice').length).toBe(1);
    expect(de('consent_choice')[0]).toMatchObject({ choice: 'all', app: 'landing' });
    expect(de('page_view')).toHaveLength(1);
    expect(de('page_view')[0]).toMatchObject({ app: 'landing', page: 'donation' });
  });

  test('«só necessários» não mede nada', async ({ page }) => {
    const { eventos } = await apanharEventos(page, null);
    await page.goto('/');
    await page.getByRole('button', { name: 'Só necessários' }).click();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(500);
    expect(eventos).toEqual([]);
  });

  test('landing: 404 manda error_view', async ({ page }) => {
    const { de } = await apanharEventos(page, 'all');
    await page.goto('/nao-existe-714');
    await expect.poll(() => de('error_view').length).toBe(1);
    expect(de('error_view')[0]).toMatchObject({ app: 'landing', kind: 'not_found' });
  });

  test('doação: começo e erro de validação com o campo, sem o valor', async ({ page }) => {
    const { de } = await apanharEventos(page, 'all');
    await page.goto('/doar');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect.poll(() => de('donation_error').length).toBe(1);
    expect(de('donation_error')[0]).toMatchObject({ step: 'statement', category: 'file_validation', field: 'files' });
    expect(de('donation_started'), 'carregar em Continuar não é começar a preencher').toHaveLength(0);

    await page.locator('input[type="file"]').first().setInputFiles({ name: 'prova.png', mimeType: 'image/png', buffer: Buffer.from('x') });
    await expect.poll(() => de('donation_started').length).toBe(1);
  });

  test('aluno: cadastro começado e erro de validação pelo nome do campo', async ({ page }) => {
    const { de } = await apanharEventos(page, 'all');
    await page.goto('/aluno/cadastro');
    await page.locator('#firstName').fill('Ana');
    await expect.poll(() => de('signup_started').length).toBe(1);
    await page.locator('#lastName').fill('Silva');
    await page.getByTestId('aluno-cadastro-submeter').click();
    await expect.poll(() => de('signup_error').length).toBe(1);
    expect(de('signup_error')[0]).toMatchObject({ field: 'username', category: 'validation' });
    expect(de('signup_started'), 'uma vez por formulário').toHaveLength(1);
    for (const params of [...de('signup_started'), ...de('signup_error')]) expect(JSON.stringify(params)).not.toContain('Ana');
  });

  test('cadastro: escrever antes de aceitar os cookies não perde o signup_started', async ({ page }) => {
    const { eventos, de } = await apanharEventos(page, null);
    await page.goto('/aluno/cadastro');
    await page.locator('#firstName').fill('Ana');
    await page.waitForTimeout(300);
    expect(eventos, 'sem consentimento nada sai').toEqual([]);
    await page.getByRole('button', { name: 'Aceitar' }).click();
    await page.locator('#lastName').fill('Silva');
    await expect.poll(() => de('signup_started').length).toBe(1);
    await page.locator('#username').fill('ana.silva');
    await page.waitForTimeout(300);
    expect(de('signup_started'), 'uma vez por formulário').toHaveLength(1);
  });

  test('doação: começar antes de aceitar não perde o donation_started', async ({ page }) => {
    const { eventos, de } = await apanharEventos(page, null);
    await page.goto('/doar');
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'prova.png', mimeType: 'image/png', buffer: Buffer.from('x') });
    await page.waitForTimeout(300);
    expect(eventos, 'sem consentimento nada sai').toEqual([]);
    await page.getByRole('button', { name: 'Aceitar' }).click();
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'outra.png', mimeType: 'image/png', buffer: Buffer.from('y') });
    await expect.poll(() => de('donation_started').length).toBe(1);
  });

  test('aluno: entrar manda login_success uma vez e tira o marcador do endereço', async ({ page }) => {
    const { de } = await apanharEventos(page, 'all');
    await page.goto('/aluno/entrar');
    await page.getByLabel('Utilizador ou email').fill('12345');
    await page.locator('#password').fill(PASSWORD);
    await page.getByTestId('aluno-entrar-submeter').click();
    await expect(page).toHaveURL(/\/aluno\/inicio/);
    await expect.poll(() => de('login_success').length).toBe(1);
    expect(de('login_success')[0]).toMatchObject({ app: 'student' });
    await expect(page).not.toHaveURL(/entrou=/);
    expect(de('page_view').map((p) => p.page)).toContain('student_home');

    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(de('login_success'), 'recarregar não repete').toHaveLength(1);
  });
});
