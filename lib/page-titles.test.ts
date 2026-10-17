import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

/** Percorre app/ e devolve, por rota, o título estático (ou 'dinâmico' com generateMetadata).
 *  Uma rota sem título herda o do layout pai: foi o que fez todas as páginas chamarem-se "Kixi Manager". */
function titles(root: string, dir = root, inherited = ''): Map<string, string> {
  const out = new Map<string, string>();
  const layout = join(dir, 'layout.tsx');
  let own = inherited;
  try {
    const m = readFileSync(layout, 'utf8').match(/title:\s*'([^']+)'/);
    if (m) own = m[1];
  } catch {}
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      for (const [k, v] of titles(root, full, own)) out.set(k, v);
    } else if (name === 'page.tsx') {
      const src = readFileSync(full, 'utf8');
      const m = src.match(/metadata\s*=\s*\{\s*title:\s*'([^']+)'/);
      out.set(full.slice(root.length), m ? m[1] : src.includes('generateMetadata') ? 'dinâmico' : own);
    }
  }
  return out;
}

test('cada rota do gestor tem o seu título', () => {
  const t = titles('app');
  const seen = new Map<string, string>();
  for (const [route, title] of t) {
    if (title === 'dinâmico' || route === '/page.tsx') continue;
    assert.ok(title.length > 0, `${route} sem título`);
    assert.ok(!seen.has(title), `${route} repete o título de ${seen.get(title)}: ${title}`);
    seen.set(title, route);
  }
});
