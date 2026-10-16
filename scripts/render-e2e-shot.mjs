// Renderiza a saída real do Playwright numa imagem, para anexar ao PR.
//
//   node scripts/render-e2e-shot.mjs < saida.txt
//
// Não inventa nada: o texto é o que o reporter imprimiu, com os códigos de cor ANSI
// traduzidos para cores de verdade. Se a suite falhar, a imagem mostra a falha — que
// é para ela servir de prova e não de decoração.

import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = process.argv[2] ?? join(RAIZ, 'e2e-jornadas.txt');
const DESTINO = join(RAIZ, '.github', 'pr-assets', 'e2e-jornadas.png');

// O reporter do Playwright só emite cor num TTY; aqui colorimos o que reconhece.
const PALETA = { 32: '#7ee787', 31: '#ff7b72', 33: '#e3b341', 36: '#79c0ff', 90: '#8b949e' };

function comCor(cor, texto) {
  return `<span style="color:${PALETA[cor]}">${texto}</span>`;
}

function ansi(linha) {
  let saida = '';
  for (const parte of linha.split(/\[(\d+)m/)) {
    if (/^\d+$/.test(parte)) saida += comCor(parte, '');
    else saida += parte.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }
  return saida;
}

const bruto = readFileSync(SAIDA, 'utf8').replace(/\[[0-9;]*[A-Za-z]/g, '');
const linhas = bruto.trimEnd().split('\n').map(ansi);

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 40px 44px;
    background: #0d1117; color: #e6edf3;
    font: 15px/1.75 ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
    -webkit-font-smoothing: antialiased;
  }
  .janela { border: 1px solid #30363d; border-radius: 10px; overflow: hidden; background: #161b22; }
  .barra {
    display: flex; align-items: center; gap: 8px;
    padding: 12px 16px; background: #1c2128; border-bottom: 1px solid #30363d;
  }
  .ponto { width: 12px; height: 12px; border-radius: 50%; }
  .titulo { margin-left: 10px; color: #8b949e; font-size: 13px; }
  pre { margin: 0; padding: 22px 24px; white-space: pre; overflow: hidden; }
</style></head><body>
  <div class="janela">
    <div class="barra">
      <span class="ponto" style="background:#ff5f57"></span>
      <span class="ponto" style="background:#febc2e"></span>
      <span class="ponto" style="background:#28c840"></span>
      <span class="titulo">npm run test:e2e &nbsp;&middot;&nbsp; feature/35-qa-end-to-end-dos-fluxos-criticos</span>
    </div>
    <pre>${linhas.join('\n')}</pre>
  </div>
</body></html>`;

mkdirSync(dirname(DESTINO), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 400 }, deviceScaleFactor: 2 });
await page.setContent(html);

// O reporter escreve linhas largas (`... > nome da jornada (2.6s)`). Medir o `pre` e
// alargar a janela ao conteúdo, senão os tempos ficam cortados e a imagem mente.
// A folga cobre o padding do corpo (40 de cada lado), a borda da janela e o resto.
const tamanho = await page.evaluate(() => {
  const pre = document.querySelector('pre');
  return { largura: pre.scrollWidth + 100 };
});
await page.setViewportSize({ width: Math.ceil(tamanho.largura), height: 400 });
await page.waitForTimeout(150);
await page.screenshot({ path: DESTINO, fullPage: true });
await browser.close();

console.log(DESTINO);