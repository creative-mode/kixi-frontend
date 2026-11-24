import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * O ecrã de espera pela correção (#792): em qualquer momento o aluno vê o que já está feito e uma previsão.
 * O SchoolOps não existe no mock, por isso o estado que o motor daria combina-se por `/aluno/api/mock-correcao`
 * (`motor`), e só a simulação 1 (do aluno 12345, com uma resposta aberta) passa pela espera.
 */
const PASSWORD = process.env.E2E_PASSWORD ?? 'Kixi1234!';

test.setTimeout(120_000);

type Motor = { estado: string; progresso?: { corrigidas: number; total: number } | null; previsaoSegundos?: number | null };

async function alunoLogin(page: Page) {
  await page.goto('/aluno/entrar');
  await page.getByLabel('Utilizador ou email').fill('12345');
  await page.locator('#password').fill(PASSWORD);
  await page.getByTestId('aluno-entrar-submeter').click();
  await expect(page).toHaveURL(/\/aluno\/inicio/);
}

// `page.request` partilha os cookies do browser; o fixture `request` não partilha.
const combinar = (page: Page, motor: Motor | null) => page.request.post('/aluno/api/mock-correcao', { data: { simulationId: 1, motor } });

async function abrirEspera(page: Page, motor: Motor) {
  expect((await combinar(page, motor)).ok()).toBe(true);
  await page.goto('/aluno/resultado?prova=1');
}

test.describe('espera pela correção com progresso e previsão (#792)', () => {
  test.beforeEach(async ({ page }) => {
    await alunoLogin(page);
  });
  test.afterEach(async ({ page }) => {
    await combinar(page, null);
  });

  test('mostra já a nota das objetivas como parcial, o progresso das abertas e a previsão do motor', async ({ page }) => {
    await abrirEspera(page, { estado: 'ABERTA', progresso: { corrigidas: 2, total: 5 }, previsaoSegundos: 60 });

    const espera = page.getByTestId('correcao-em-curso');
    await expect(espera).toBeVisible();
    const parcial = page.getByTestId('nota-parcial');
    await expect(parcial.getByText('Objetivas')).toBeVisible();
    await expect(parcial.getByText('· nota parcial')).toBeVisible();
    // O valor vem do backend (as fechadas já foram pontuadas na entrega), nunca da correção do motor.
    await expect(parcial).toContainText(/\d+(,\d+)? de \d+(,\d+)? valores/);

    const abertas = page.getByTestId('progresso-abertas');
    await expect(abertas).toHaveAttribute('data-origem', 'motor');
    await expect(abertas.getByText('2 de 5', { exact: true })).toBeVisible();
    await expect(abertas.getByRole('progressbar', { name: '2 de 5 respostas abertas corrigidas' })).toBeVisible();
    await expect(page.getByTestId('previsao')).toHaveText('Fica pronta em cerca de 1 minuto.');

    // A frase de que pode sair e vai ser avisado (#793) mantém-se.
    await expect(espera.getByText('Podes sair deste ecrã.')).toBeVisible();
    await expect(espera.getByText(/Avisamos-te quando a nota estiver pronta/)).toBeVisible();
  });

  test('sem previsão do motor estima pelo número de abertas da prova, sem inventar um progresso', async ({ page }) => {
    await abrirEspera(page, { estado: 'ABERTA', progresso: null, previsaoSegundos: null });

    const abertas = page.getByTestId('progresso-abertas');
    await expect(abertas).toHaveAttribute('data-origem', 'estimada');
    // A simulação 1 tem uma resposta aberta: 0 de 1 e uma estimativa «cerca de», nunca um número exato.
    await expect(abertas.getByText('0 de 1', { exact: true })).toBeVisible();
    await expect(page.getByTestId('previsao')).toHaveText(/^Fica pronta (dentro de instantes|em cerca de \d+ segundos)\.$/);
    await expect(page.getByTestId('nota-parcial')).toBeVisible();
  });

  test('quase pronta diz «dentro de instantes» e a barra está quase cheia', async ({ page }) => {
    await abrirEspera(page, { estado: 'ABERTA', progresso: { corrigidas: 4, total: 5 }, previsaoSegundos: 3 });

    await expect(page.getByTestId('previsao')).toHaveText('Fica pronta dentro de instantes.');
    await expect(page.getByRole('progressbar', { name: '4 de 5 respostas abertas corrigidas' })).toHaveAttribute('aria-valuenow', '80');
  });

  test('uma correção falhada continua a dar saída, sem previsão', async ({ page }) => {
    await abrirEspera(page, { estado: 'FALHADA', progresso: { corrigidas: 2, total: 5 } });

    await expect(page.getByTestId('correcao-falhou')).toBeVisible();
    await expect(page.getByTestId('previsao')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  });

  test('no telemóvel cabe sem deslocação horizontal e sem violações graves de acessibilidade', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await abrirEspera(page, { estado: 'ABERTA', progresso: { corrigidas: 2, total: 5 }, previsaoSegundos: 60 });

    await expect(page.getByTestId('progresso-abertas')).toBeVisible();
    const largura = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, janela: window.innerWidth }));
    expect(largura.doc).toBeLessThanOrEqual(largura.janela);

    const { violations } = await new AxeBuilder({ page }).disableRules(['region']).analyze();
    const graves = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`);
    expect(graves, graves.join('\n')).toEqual([]);
  });
});
