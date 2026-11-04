import { test, expect, type Browser } from '@playwright/test';

/**
 * Orçamento de desempenho das rotas de entrada (#543): LCP p75 abaixo de 2,5 s em Slow 4G com o CPU 4× mais lento,
 * no perfil de um telemóvel. Mede a build servida localmente: apanha o peso e o JavaScript que o nosso código
 * acrescenta, não a latência do servidor em produção.
 *
 * Com a escolha de cookies já feita: o banner só aparece depois da hidratação e, numa página com pouco texto, é o
 * maior elemento. Em `/aluno/entrar` o LCP passaria de 0,7 s (o conteúdo) para 2,1 s (o banner) e mediria o banner.
 */
const ORCAMENTO_LCP_MS = 2500;
const AMOSTRAS = 4;
const ROTAS = ['/', '/aluno/entrar', '/aluno/cadastro', '/doar'];

/** Os valores do perfil «Slow 4G» do Lighthouse: 150 ms de latência, 1,6 Mbit/s a descer, 750 kbit/s a subir. */
const SLOW_4G = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };

async function medirLcp(browser: Browser, baseURL: string, rota: string) {
  // Um contexto por amostra: sem cache, como quem chega pela primeira vez.
  const context = await browser.newContext({ baseURL, viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.75 });
  await context.addInitScript(() => localStorage.setItem('kixi-consent', 'necessary'));
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', SLOW_4G);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(rota, { waitUntil: 'load' });
  const lcp = await page.evaluate(() => new Promise<number>((resolve) => {
    let ultimo = 0;
    new PerformanceObserver((lista) => {
      for (const entrada of lista.getEntries()) ultimo = entrada.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    setTimeout(() => resolve(ultimo), 1500);
  }));
  await context.close();
  return Math.round(lcp);
}

for (const rota of ROTAS) {
  test(`LCP p75 abaixo de ${ORCAMENTO_LCP_MS} ms em Slow 4G + CPU 4×: ${rota}`, async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const amostras: number[] = [];
    for (let i = 0; i < AMOSTRAS; i++) amostras.push(await medirLcp(browser, baseURL!, rota));
    amostras.sort((a, b) => a - b);
    const p75 = amostras[Math.ceil(AMOSTRAS * 0.75) - 1];
    test.info().annotations.push({ type: 'LCP', description: `${rota}: p75 ${p75} ms (${amostras.join(', ')})` });
    console.log(`[LCP] ${rota}: p75 ${p75} ms (${amostras.join(', ')})`);
    expect(amostras[0], 'o LCP foi medido').toBeGreaterThan(0);
    expect(p75, `amostras: ${amostras.join(', ')}`).toBeLessThan(ORCAMENTO_LCP_MS);
  });
}
