import assert from 'node:assert/strict';
import test from 'node:test';

import { mergePageRetry } from './retry.ts';
import type { DraftQuestion } from './draft.ts';

const open = (text: string, points: number | '' = 2, extra: Partial<DraftQuestion> = {}): DraftQuestion => ({ text, points, options: [], ...extra });
const grupo = (text: string, alineas: number, extra: Partial<DraftQuestion> = {}): DraftQuestion => ({
  text, points: '' as const, options: [], kind: 'group',
  items: Array.from({ length: alineas }, (_, i) => ({ text: `${text}${String.fromCharCode(97 + i)}`, points: 1, options: [] })),
  ...extra,
});

test('a troca é por página: substitui o que veio dela e preserva o resto', () => {
  const current = [
    open('Q1', 2, { sourcePageIndex: 0, sourceNumber: '1' }),
    open('Q2', 2, { sourcePageIndex: 1, sourceNumber: '2' }),
    grupo('Q3', 2, { sourcePageIndex: 1, sourceNumber: '3' }),
    open('Q4', 2, { sourcePageIndex: 2, sourceNumber: '4' }),
  ];
  const retried = [open('Q2 relida', 3), grupo('Q3 relida', 2)];
  const merged = mergePageRetry(current, retried, 1);
  assert.equal(merged.ambiguous, false);
  assert.equal(merged.replaced, 2);
  assert.equal(merged.added, 2);
  // posições 1 e 2 saem; 0 e 3 ficam
  assert.deepEqual(merged.items.map((q) => q.text), ['Q1', 'Q2 relida', 'Q3 relida', 'Q4']);
  // as questões novas herdam a página repetida, mesmo que a leitura parcial não a saiba
  assert.ok(merged.items[1].sourcePageIndex === 1);
});

test('sem páginas no rascunho, o número impresso identifica a troca', () => {
  const current = [open('Q1', 2), open('Q2', 2, { sourceNumber: '7' }), open('Q3', 2)];
  const retried = [open('Q2 relida', 2, { sourceNumber: '7' })];
  const merged = mergePageRetry(current, retried, null);
  assert.equal(merged.ambiguous, false);
  assert.deepEqual(merged.items.map((q) => q.text), ['Q1', 'Q2 relida', 'Q3']);
});

test('posições não-contíguas: reordenar o rascunho antes de repetir não apaga o resto', () => {
  // O professor subiu/desceu questões: as da página 0 já não estão juntas.
  const current = [
    open('Q1', 2, { sourcePageIndex: 0, sourceNumber: '1' }),
    open('Q3', 2, { sourcePageIndex: 1, sourceNumber: '3' }),
    open('Q2', 2, { sourcePageIndex: 0, sourceNumber: '2' }),
    open('Q4', 2, { sourcePageIndex: 1, sourceNumber: '4' }),
  ];
  const retried = [open('Q1 relida', 2, { sourceNumber: '1' }), open('Q2 relida', 3, { sourceNumber: '2' })];
  const merged = mergePageRetry(current, retried, 0);
  assert.equal(merged.ambiguous, false);
  assert.equal(merged.replaced, 2);
  assert.equal(merged.added, 2);
  // As da página 1 (Q3, Q4) sobrevivem intactas — só as posições 0 e 2 saem.
  assert.deepEqual(merged.items.map((q) => q.text), ['Q1 relida', 'Q2 relida', 'Q3', 'Q4']);
  // As relidas herdam a página repetida; as restantes conservam a sua.
  assert.ok(merged.items.slice(0, 2).every((q) => q.sourcePageIndex === 0));
  assert.ok(merged.items.slice(2).every((q) => q.sourcePageIndex === 1));
});

test('quando ninguém é identificável, pergunta-se em vez de escrever às cegas', () => {
  const current = [open('Q1', 2), open('Q2', 2)];
  const retried = [open('Q2 relida', 2)];
  const merged = mergePageRetry(current, retried, null);
  assert.equal(merged.ambiguous, true);
  assert.deepEqual(merged.items.map((q) => q.text), ['Q1', 'Q2']); // intacto
  assert.equal(merged.replaced, 0);
});

test('rascunho vazio devolve as questões relidas só ao pedir, sem ambiguidade', () => {
  const merged = mergePageRetry([], [open('Q1', 2)], 0);
  assert.deepEqual(merged.items, []);
  assert.equal(merged.ambiguous, false);
});
