import assert from 'node:assert/strict';
import test from 'node:test';

import { kindOf } from './draft.ts';
import { draftHasContent, EMPTY_DRAFT, normalizeDraft, type ExamDraft } from './schools.ts';

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

test('só um rascunho com trabalho real conta como trabalho por guardar', () => {
  // Título e texto das questões continuam a contar, e as alíneas de um grupo
  // também: um grupo com a cabeça vazia mas uma alínea escrita é trabalho a sério.
  assert.equal(draftHasContent(EMPTY_DRAFT), false);
  assert.equal(draftHasContent({ ...EMPTY_DRAFT, title: '   ' }), false);
  assert.equal(draftHasContent({ ...EMPTY_DRAFT, items: [{ text: '  ', points: '', options: [] }] }), false);
  assert.equal(draftHasContent({ ...EMPTY_DRAFT, title: 'Prova de OGI' }), true);
  assert.equal(draftHasContent({ ...EMPTY_DRAFT, items: [{ text: '1 + 1?', points: '', options: [] }] }), true);
  assert.equal(draftHasContent({ ...EMPTY_DRAFT, items: [{ text: '', points: '', options: [], kind: 'group', items: [{ text: 'a alínea', points: '', options: [] }] }] }), true);
});

test('mexer só no cabeçalho também é trabalho por guardar (#362)', () => {
  // O rascunho guarda estes campos e o professor edita-os. Antes só o título e o
  // texto das questões contavam, por isso mexer num destes deixava o rascunho a
  // parecer vazio e `clearDraft` apagava-o em silêncio. Cada um destes casos é uma
  // alteração isolada, sem título nem questão, e todos têm de valer.
  const casos: Partial<ExamDraft>[] = [
    { schoolId: '3' },
    { subject: 'Matemática' },
    { kind: 'Exame' },
    { grade: '11ª Classe' },
    { phase: '2ª Fase' },
    { duration: 90 },
    { variant: 'B' },
    { schoolYear: '2024/2025' },
    { rules: ['O trabalho deve ser realizado em grupo.'] }, // apagou uma regra
    { rules: ['O trabalho deve ser realizado em grupo.', 'Cotação: de 0 a 20 valores.', 'Sem calculadora.'] }, // acrescentou
    { note: 'Revisão de véspera.' },
    { place: 'Benguela' },
    { date: '2026-10-20' },
    { teacher: 'Prof. Nuno' },
  ];
  for (const caso of casos) {
    assert.equal(draftHasContent({ ...EMPTY_DRAFT, ...caso }), true, JSON.stringify(caso));
  }
  // Espaços em branco e os valores por omissão não são trabalho.
  assert.equal(draftHasContent({ ...EMPTY_DRAFT, subject: '   ', note: '  ', teacher: ' ', variant: ' ' }), false);
});

test('cotação e opções das questões contam como trabalho (#362)', () => {
  // Só a cotação escrita, sem texto nenhum: era dado como vazio e apagado.
  assert.equal(draftHasContent({ ...EMPTY_DRAFT, items: [{ text: '', points: 2, options: [] }] }), true);
  // Opções de resposta sem texto na pergunta.
  assert.equal(draftHasContent({ ...EMPTY_DRAFT, items: [{ text: '', points: '', options: [{ label: 'A', text: '', correct: false }] }] }), true);
  // Escolha múltipla traz opções: escolher o tipo já é trabalho.
  assert.equal(draftHasContent({ ...EMPTY_DRAFT, items: [{ text: '', points: '', options: [{ label: 'A', text: '', correct: false }, { label: 'B', text: '', correct: false }], kind: 'multiple_choice' }] }), true);
  // Alínea de um grupo só com cotação.
  assert.equal(draftHasContent({ ...EMPTY_DRAFT, items: [{ text: '', points: '', options: [], kind: 'group', items: [{ text: '', points: 2, options: [] }] }] }), true);
  // O `kind` sozinho não é trabalho: uma questão vazia convertida e voltada atrás
  // não guarda nada, e os itens normalizados trazem sempre um tipo derivado.
  assert.equal(draftHasContent({ ...EMPTY_DRAFT, items: [{ text: '', points: '', options: [], kind: 'open' }] }), false);
});
