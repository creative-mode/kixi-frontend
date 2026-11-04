import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// As três apps são Next separadas, sem pacote partilhado: o contrato de eventos vive em três cópias.
// Este teste é a regra de sincronização (#517): uma cópia alterada sozinha falha aqui.
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('o contrato de analítica é o mesmo no gestor, no aluno e na landing', () => {
  const manager = read('lib/analytics.ts');
  assert.equal(read('student/lib/analytics.ts'), manager, 'student/lib/analytics.ts divergiu de lib/analytics.ts');
  assert.equal(read('landing/lib/analytics.ts'), manager, 'landing/lib/analytics.ts divergiu de lib/analytics.ts');
});

test('os componentes que disparam eventos da navegação são os mesmos na landing e no aluno', () => {
  assert.equal(read('landing/components/analytics/trackers.tsx'), read('student/components/analytics/trackers.tsx'),
    'landing/components/analytics/trackers.tsx divergiu de student/components/analytics/trackers.tsx');
});
