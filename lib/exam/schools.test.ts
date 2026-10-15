import assert from 'node:assert/strict';
import test from 'node:test';

import { kindOf } from './draft.ts';
import { EMPTY_DRAFT, normalizeDraft } from './schools.ts';

test('um rascunho antigo, sem tipo nem alíneas nem cabeçalho novo, abre sem rebentar', () => {
  const antigo = { subject: 'Matemática', items: [{ text: 'q1', points: 2 }, { text: 'q2', points: 3, options: [{ text: 'a', correct: true }, { text: 'b' }] }] };
  const d = normalizeDraft(antigo as never);
  assert.equal(d.items.length, 2);
  assert.equal(kindOf(d.items[0]), 'open');
  assert.equal(kindOf(d.items[1]), 'multiple_choice');
  assert.deepEqual(d.items[1].options.map((o) => o.label), ['A', 'B']);
  assert.equal(d.title, '');
  assert.equal(d.duration, '');
  assert.equal(d.variant, '');
});

test('um rascunho vazio ou corrompido volta ao rascunho de base', () => {
  assert.equal(normalizeDraft({}).items.length, EMPTY_DRAFT.items.length);
  assert.equal(normalizeDraft({ items: 'x' } as never).items.length, 1);
});

test('as alíneas guardadas mantêm tipo, texto, cotação e marca de revisão', () => {
  const guardado = { items: [{ text: 'Q3', points: '', kind: 'group', options: [], items: [
    { text: 'a', points: 2, kind: 'true_false', options: [{ label: 'A', text: 'Verdadeiro', correct: true }, { label: 'B', text: 'Falso', correct: false }], review: true },
    { text: 'b', points: 2, kind: 'open', options: [] },
  ] }] };
  const [g] = normalizeDraft(guardado as never).items;
  assert.equal(kindOf(g), 'group');
  assert.equal(g.items?.length, 2);
  assert.equal(g.items?.[0].kind, 'true_false');
  assert.equal(g.items?.[0].review, true);
  assert.equal(g.items?.[1].review, undefined);
});

test('um verdadeiro/falso guardado sem as duas opções recupera-as', () => {
  const [g] = normalizeDraft({ items: [{ text: 'Q', kind: 'group', items: [{ text: 'a', kind: 'true_false', options: [] }] }] } as never).items;
  assert.deepEqual(g.items?.[0].options.map((o) => o.text), ['Verdadeiro', 'Falso']);
});

test('um grupo sem alíneas guardadas deixa de ser grupo, e um tipo desconhecido é ignorado', () => {
  const d = normalizeDraft({ items: [{ text: 'Q', kind: 'group' }, { text: 'R', kind: 'banana', options: [] }] } as never);
  assert.equal(kindOf(d.items[0]), 'open');
  assert.equal(kindOf(d.items[1]), 'open');
});

test('o cabeçalho guardado mantém título, duração, série e ano letivo', () => {
  const d = normalizeDraft({ title: 'Prova de OGI', duration: 90, variant: 'B', schoolYear: '2024/2025' } as never);
  assert.deepEqual([d.title, d.duration, d.variant, d.schoolYear], ['Prova de OGI', 90, 'B', '2024/2025']);
});
