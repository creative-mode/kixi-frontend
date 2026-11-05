// Mede o que o aluno espera, com a rede simulada. Uso:
//   BASE=http://localhost:4001 BACKEND=http://localhost:8061 SEED=/tmp/perf/seed.json LABEL=antes \
//   RTT=150 KBPS=1500 node perf-bench.mjs
// Precisa de playwright-core e de um Chrome (CHROME=/caminho/chrome). Escreve uma tabela em markdown.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4001';
const BACKEND = process.env.BACKEND ?? 'http://localhost:8061';
const SEED = JSON.parse(fs.readFileSync(process.env.SEED ?? '/tmp/perf/seed.json', 'utf8'));
const RTT = Number(process.env.RTT ?? 150);
const KBPS = Number(process.env.KBPS ?? 1500);
const LABEL = process.env.LABEL ?? 'medida';
const CHROME = process.env.CHROME ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`;

const login = await (await fetch(`${BACKEND}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usernameOrEmail: SEED.viewer.user, password: SEED.viewer.pass }) })).json();
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

async function session(_warm) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  await ctx.addCookies([{ name: 'auth_token', value: login.accessToken, url: BASE }]);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: RTT, downloadThroughput: (KBPS * 1000) / 8, uploadThroughput: (KBPS * 1000) / 8 });
  const stats = { bytes: 0, requests: 0, images: 0, imageBytes: 0, pending: new Set(), lastImage: 0 };
  const kinds = new Map();
  cdp.on('Network.requestWillBeSent', (e) => { if (e.type === 'Image') { stats.pending.add(e.requestId); stats.lastImage = Date.now(); } });
  cdp.on('Network.loadingFailed', (e) => { stats.pending.delete(e.requestId); stats.lastImage = Date.now(); });
  cdp.on('Network.responseReceived', (e) => kinds.set(e.requestId, e.type));
  cdp.on('Network.loadingFinished', (e) => { stats.bytes += e.encodedDataLength; stats.requests += 1; if (kinds.get(e.requestId) === 'Image') { stats.images += 1; stats.imageBytes += e.encodedDataLength; stats.pending.delete(e.requestId); stats.lastImage = Date.now(); } });
  return { ctx, page, cdp, stats, reset: () => { stats.bytes = 0; stats.requests = 0; stats.images = 0; stats.imageBytes = 0; stats.lastImage = 0; } };
}

const imagesDone = async (s) => {
  const limit = Date.now() + 300000;
  for (;;) {
    if (s.stats.pending.size === 0 && Date.now() - s.stats.lastImage > 1500) return s.stats.lastImage;
    if (Date.now() > limit) return Date.now();
    await new Promise((r) => setTimeout(r, 100));
  }
};

async function visit(path, contentSel) {
  const s = await session();
  const out = {};
  for (const pass of ['1.ª visita', '2.ª visita']) {
    s.reset();
    const t0 = Date.now();
    await s.page.goto(BASE + path, { waitUntil: 'commit' });
    await s.page.waitForSelector(contentSel, { timeout: 300000 });
    const tContent = Date.now() - t0;
    await s.page.waitForLoadState('load', { timeout: 300000 });
    s.stats.lastImage = Date.now();
    const last = await imagesDone(s);
    const tImages = Math.max(tContent, last - t0 - 1500 < tContent ? tContent : last - t0);
    await s.page.waitForTimeout(500);
    out[pass] = { tContent, tImages, kb: Math.round(s.stats.bytes / 1024), req: s.stats.requests, imgKb: Math.round(s.stats.imageBytes / 1024), img: s.stats.images };
  }
  await s.ctx.close();
  return out;
}

async function comments(mode) {
  const s = await session();
  await s.page.goto(BASE + '/inicio', { waitUntil: 'commit' });
  await s.page.waitForSelector('article button[aria-expanded]', { timeout: 300000 });
  await imagesDone(s);
  await s.page.waitForLoadState('networkidle', { timeout: 300000 }); // o JS tem de ter chegado e hidratado antes do primeiro toque
  // um post com comentários
  const all = s.page.locator('article button[aria-expanded]').filter({ hasText: /[1-9]/ });
  const btn = mode === 'longe' ? all.nth(6) : all.first();
  await btn.scrollIntoViewIfNeeded();
  if (mode === 'parado' || mode === 'longe') await s.page.waitForTimeout(3500); // dá tempo à leitura em segundo plano
  if (mode === 'rato') { await btn.hover(); await s.page.waitForTimeout(1800); }
  const t0 = Date.now();
  if (mode === 'frio') await btn.click(); else await btn.dispatchEvent('click');
  await s.page.locator('article ol li').first().waitFor({ timeout: 60000 });
  const t = Date.now() - t0;
  await s.ctx.close();
  return t;
}

const rows = [];
for (const [name, path, sel] of [['Início', '/inicio', 'article button[aria-expanded]'], ['Perfil', '/perfil', '[role="tab"]'], ['Provas', '/provas', 'nav[aria-label="Provas"] a[aria-current="page"]']]) {
  const r = await visit(path, sel);
  rows.push(`| ${name} | ${r['1.ª visita'].tContent} | ${r['1.ª visita'].tImages} | ${r['1.ª visita'].kb} | ${r['1.ª visita'].imgKb} (${r['1.ª visita'].img}) | ${r['1.ª visita'].req} | ${r['2.ª visita'].tContent} | ${r['2.ª visita'].tImages} | ${r['2.ª visita'].kb} |`);
}
const c = { frio: await comments('frio'), parado: await comments('parado'), rato: await comments('rato'), longe: await comments('longe') };
console.log(`### ${LABEL} (RTT ${RTT} ms, ${KBPS} kbit/s, ecrã 390 px)\n`);
console.log('| página | 1.ª: conteúdo ms | 1.ª: imagens prontas ms | 1.ª: KB | 1.ª: KB de imagens (n) | 1.ª: pedidos | 2.ª: conteúdo ms | 2.ª: imagens ms | 2.ª: KB |\n|---|---|---|---|---|---|---|---|---|');
console.log(rows.join('\n'));
console.log(`\nAbrir os comentários de um post: clique direto ${c.frio} ms; depois de a página estar parada ${c.parado} ms; depois de aproximar o rato ${c.rato} ms; no 7.º post com comentários (fora do ecrã inicial), parado 3,5 s, ${c.longe} ms.`);
await browser.close();
