import assert from 'node:assert/strict';
import test from 'node:test';

import { correctionNoticeOf, correctionText, type CorrectionNoticeInput } from './correction-notice.ts';

const prova: CorrectionNoticeInput = {
  id: 42,
  status: 'FINISHED',
  finalScore: 14,
  finishedAt: '2026-11-17T09:00:00',
  correctionStatus: 'DONE',
  correctedAt: '2026-11-17T11:30:00',
  statement: { title: 'Matemática', totalMaxScore: 20 },
};

test('a notificação traz a nota com a escala do enunciado', () => {
  assert.equal(correctionText(prova), 'A tua prova de Matemática foi corrigida: 14/20');
});

test('uma nota com vírgula mantém a vírgula', () => {
  assert.equal(correctionText({ ...prova, finalScore: 16.4 }), 'A tua prova de Matemática foi corrigida: 16,4/20');
});

test('a nota do motor usa a escala dele, não a cotação em pontos do Kixi (#817)', () => {
  const provaDe25 = { ...prova, statement: { title: 'Matemática', totalMaxScore: 25 }, finalScore: 17.75 };
  assert.equal(correctionText(provaDe25), 'A tua prova de Matemática foi corrigida: 17,75/25');
  assert.equal(correctionText({ ...provaDe25, grade: { score: 14.2, scale: 20 } }), 'A tua prova de Matemática foi corrigida: 14,2/20');
  // Motor ligado mas sem nota: não se cai na cotação em pontos, que é outra escala.
  assert.equal(correctionText({ ...provaDe25, grade: null }), 'A tua prova de Matemática foi corrigida.');
});

test('a data da notificação é a da correção, não a da entrega', () => {
  assert.deepEqual(correctionNoticeOf(prova), {
    key: 'sim-42',
    text: 'A tua prova de Matemática foi corrigida: 14/20',
    href: '/resultado?prova=42',
    at: '2026-11-17T11:30:00',
  });
});

test('enquanto a correção não acaba, a notificação da entrega continua', () => {
  for (const status of ['PENDING', 'IN_PROGRESS', 'FAILED']) {
    assert.equal(correctionNoticeOf({ ...prova, correctionStatus: status }), null);
  }
});

test('uma prova por terminar nunca tem notificação de correção', () => {
  assert.equal(correctionNoticeOf({ ...prova, status: 'IN_PROGRESS' }), null);
});

test('sem nota ou sem escala não se inventa um denominador', () => {
  assert.equal(correctionText({ ...prova, finalScore: null }), 'A tua prova de Matemática foi corrigida.');
  assert.equal(correctionText({ ...prova, statement: { title: 'Matemática' } }), 'A tua prova de Matemática foi corrigida.');
  assert.equal(correctionText({ ...prova, statement: null }), 'A tua prova foi corrigida.');
});

test('sem data de correção, a da entrega chega; sem nenhuma, nada', () => {
  assert.equal(correctionNoticeOf({ ...prova, correctedAt: null })?.at, prova.finishedAt);
  assert.equal(correctionNoticeOf({ ...prova, correctedAt: null, finishedAt: null }), null);
});
