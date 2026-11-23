import { test, expect, type Browser } from '@playwright/test';

/**
 * Orçamento de desempenho das rotas de entrada (#543, #764): LCP p75 abaixo de 2,5 s e
 * TBT p75 abaixo de 2 s em Slow 4G com o CPU 4× mais lento, no perfil de um telemóvel.
 * Mede a build servida localmente: apanha o peso e o JavaScript que o nosso código
 * acrescenta, não a latência do servidor em produção.
 *
 * O INP é uma métrica de campo: depende da interacção real (toques, cliques, teclado) e
 * não se reproduz de forma fiável num laboratório sem um guião de interacção. Fica no
 * relatório de campo (RUM) e não neste orçamento.
 *
 * Este é o orçamento que corre na CI: o Playwright mede as mesmas métricas em condições
 * reproduzíveis (Slow 4G + CPU 4×) e já faz parte da suite, por isso não se acrescenta
 * Lighthouse CI — que traz a mesma medição com mais ruído e uma dependência a mais.
 *
 * Com a escolha de cookies já feita: o banner só aparece depois da hidratação e, numa página com pouco texto, é o
 * maior elemento. Em `/aluno/entrar` o LCP passaria de 0,7 s (o conteúdo) para 2,1 s (o banner) e mediria o banner.
 */
const ORCAMENTO_LCP_MS = 2500;
const ORCAMENTO_TBT_MS = 2000;
const AMOSTRAS = 4;
const ROTAS = ['/', '/aluno/entrar', '/aluno/cadastro', '/doar'];

/** Os valores do perfil «Slow 4G» do Lighthouse: 150 ms de latência, 1,6 Mbit/s a descer, 750 kbit/s a subir. */
const SLOW_4G = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };

/** Janela depois do `load` que apanha a hidratação: é aí que vivem as long tasks que o TBT mede. */
const JANELA_TBT_MS = 6000;

async function medirMetricas(browser: Browser, baseURL: string, rota: string) {
  // Um contexto por amostra: sem cache, como quem chega pela primeira vez.
  const context = await browser.newContext({ baseURL, viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.75 });
  await context.addInitScript(() => localStorage.setItem('kixi-consent', 'necessary'));
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', SLOW_4G);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(rota, { waitUntil: 'load' });
  const metricas = await page.evaluate((janela) => new Promise<{ lcp: number; tbt: number }>((resolve) => {
    let lcp = 0;
    const longas: PerformanceEntry[] = [];
    new PerformanceObserver((lista) => {
      for (const entrada of lista.getEntries()) lcp = entrada.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    // TBT = soma do tempo de bloqueio (> 50 ms) das long tasks depois do FCP (#764). O
    // `buffered` apanha as que correram entre a navegação e o `load`; a janela, a hidratação.
    new PerformanceObserver((lista) => {
      for (const entrada of lista.getEntries()) longas.push(entrada);
    }).observe({ type: 'longtask', buffered: true });
    setTimeout(() => {
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
      const tbt = longas.filter((e) => e.startTime >= fcp).reduce((soma, e) => soma + Math.max(0, e.duration - 50), 0);
      resolve({ lcp, tbt });
    }, janela);
  }), JANELA_TBT_MS);
  await context.close();
  return { lcp: Math.round(metricas.lcp), tbt: Math.round(metricas.tbt) };
}

const p75 = (amostras: number[]) => {
  const ordenadas = [...amostras].sort((a, b) => a - b);
  return ordenadas[Math.ceil(ordenadas.length * 0.75) - 1];
};

for (const rota of ROTAS) {
  test(`LCP p75 abaixo de ${ORCAMENTO_LCP_MS} ms e TBT p75 abaixo de ${ORCAMENTO_TBT_MS} ms em Slow 4G + CPU 4×: ${rota}`, async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const lcps: number[] = [];
    const tbts: number[] = [];
    for (let i = 0; i < AMOSTRAS; i++) {
      const { lcp, tbt } = await medirMetricas(browser, baseURL!, rota);
      lcps.push(lcp);
      tbts.push(tbt);
    }
    const lcpP75 = p75(lcps);
    const tbtP75 = p75(tbts);
    test.info().annotations.push({ type: 'LCP', description: `${rota}: p75 ${lcpP75} ms (${lcps.join(', ')})` });
    test.info().annotations.push({ type: 'TBT', description: `${rota}: p75 ${tbtP75} ms (${tbts.join(', ')})` });
    console.log(`[LCP] ${rota}: p75 ${lcpP75} ms (${lcps.join(', ')})`);
    console.log(`[TBT] ${rota}: p75 ${tbtP75} ms (${tbts.join(', ')})`);
    expect(lcps[0], 'o LCP foi medido').toBeGreaterThan(0);
    expect(tbts[0], 'o TBT foi medido').toBeGreaterThan(0);
    expect(lcpP75, `LCP amostras: ${lcps.join(', ')}`).toBeLessThan(ORCAMENTO_LCP_MS);
    expect(tbtP75, `TBT amostras: ${tbts.join(', ')}`).toBeLessThan(ORCAMENTO_TBT_MS);
  });
}
