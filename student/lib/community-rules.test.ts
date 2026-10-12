import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bucketLabel, compareToAverage, pctCorrectLabel } from './community-rules.ts';

test('compara a nota do aluno com a média, com o sinal certo', () => {
  assert.equal(compareToAverage(16.4, 12.8), 'Tu: 16,4 · Média: 12,8 (+3,6)');
  assert.equal(compareToAverage(10, 12.8), 'Tu: 10,0 · Média: 12,8 (-2,8)');
});

test('sem a nota do aluno ou sem média, não há comparação', () => {
  assert.equal(compareToAverage(null, 12.8), null);
  assert.equal(compareToAverage(16.4, null), null);
});

test('sem tentativas avaliadas, a pergunta diz "sem dados", não 0%', () => {
  assert.equal(pctCorrectLabel(null), 'Sem dados');
  assert.equal(pctCorrectLabel(0), '0% acertou');
  assert.equal(pctCorrectLabel(66.6), '67% acertou');
});

test('o intervalo do histograma lê-se por extenso nos extremos', () => {
  assert.equal(bucketLabel(null, 5), 'até 5');
  assert.equal(bucketLabel(15, null), '15+');
  assert.equal(bucketLabel(10, 15), '10–15');
});
