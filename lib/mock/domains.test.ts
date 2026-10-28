import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const aqui = new URL('.', import.meta.url);
const despacho = readFileSync(new URL('backend.ts', aqui), 'utf8');
const dominios = readdirSync(new URL('domains/', aqui)).filter((f) => f.endsWith('.ts'));

test('cada domínio do mock do gestor está no despacho', () => {
  assert.ok(dominios.length > 0);
  for (const ficheiro of dominios) {
    const nome = ficheiro.replace(/\.ts$/, '');
    assert.match(despacho, new RegExp(`from './domains/${nome}'`), `${nome} não é importado por backend.ts`);
  }
});

test('o despacho do gestor só importa domínios que existem', () => {
  const importados = [...despacho.matchAll(/from '\.\/domains\/([\w-]+)'/g)].map((m) => m[1]);
  for (const nome of importados) assert.ok(dominios.includes(`${nome}.ts`), `backend.ts importa domains/${nome}, que não existe`);
});
