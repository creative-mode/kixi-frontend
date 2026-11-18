import assert from 'node:assert/strict';
import { test } from 'node:test';
import { estadoDaNotaEmPalavras, notaDaSimulacao, notaDoMotorDe, notaFinal, sufixoDaNota } from './nota-da-simulacao.ts';

test('corrigida mostra a nota do resultado', () => {
  assert.deepEqual(notaDaSimulacao({ correctionStatus: 'DONE', finalScore: 14.5 }), { kind: 'nota', nota: 14.5 });
  assert.equal(notaFinal({ correctionStatus: 'DONE', finalScore: 14.5 }), 14.5);
  assert.equal(estadoDaNotaEmPalavras({ correctionStatus: 'DONE', finalScore: 14.5 }), null);
  // zero é uma nota, não a ausência dela
  assert.deepEqual(notaDaSimulacao({ correctionStatus: 'DONE', finalScore: 0 }), { kind: 'nota', nota: 0 });
});

test('por corrigir nunca mostra a nota parcial do backend', () => {
  for (const estado of ['PENDING', 'IN_PROGRESS', 'pending', 'in_progress']) {
    assert.deepEqual(notaDaSimulacao({ correctionStatus: estado, finalScore: 9.5 }), { kind: 'a-corrigir' });
    assert.equal(notaFinal({ correctionStatus: estado, finalScore: 9.5 }), null);
    assert.equal(estadoDaNotaEmPalavras({ correctionStatus: estado, finalScore: 9.5 }), 'A corrigir');
  }
});

test('a correcção falhada diz-se, não se disfarça de nota', () => {
  assert.deepEqual(notaDaSimulacao({ correctionStatus: 'FAILED', finalScore: 9.5 }), { kind: 'falhou' });
  assert.equal(notaFinal({ correctionStatus: 'FAILED', finalScore: 9.5 }), null);
  assert.equal(estadoDaNotaEmPalavras({ correctionStatus: 'FAILED' }), 'Correção falhou');
});

test('sem estado da correcção vale a nota final que existir (prova de sala, backend antigo)', () => {
  assert.deepEqual(notaDaSimulacao({ finalScore: 12 }), { kind: 'nota', nota: 12 });
  assert.deepEqual(notaDaSimulacao({ correctionStatus: null, finalScore: 12 }), { kind: 'nota', nota: 12 });
  assert.deepEqual(notaDaSimulacao({}), { kind: 'sem-nota' });
  assert.deepEqual(notaDaSimulacao({ correctionStatus: 'DONE', finalScore: null }), { kind: 'sem-nota' });
  assert.equal(estadoDaNotaEmPalavras({}), null);
});

test('um estado novo do backend não se disfarça de nota final', () => {
  // O #820 mostrou que «estado desconhecido = nota final» contradizia o `labelOf`;
  // até haver um estado novo conhecido, diz-se «A corrigir» e não se inventa um número.
  assert.deepEqual(notaDaSimulacao({ correctionStatus: 'OUTRO', finalScore: 11 }), { kind: 'a-corrigir' });
  assert.equal(notaFinal({ correctionStatus: 'OUTRO', finalScore: 11 }), null);
  assert.equal(estadoDaNotaEmPalavras({ correctionStatus: 'OUTRO', finalScore: 11 }), 'A corrigir');
});

test('uma prova de sala entregue e DONE é a nota da pauta (o resultado mostra-a igual)', () => {
  // O backend calcula o `correctionStatus` para qualquer simulação entregue, sala
  // incluída (CorrectionSummary.of). Sem `correctedAt` também é DONE.
  assert.deepEqual(notaDaSimulacao({ correctionStatus: 'DONE', finalScore: 12 }), { kind: 'nota', nota: 12 });
  assert.deepEqual(notaDaSimulacao({ correctionStatus: 'DONE', finalScore: 12, correctedAt: null }), { kind: 'nota', nota: 12 });
});

test('quando a nota é a do motor, o número não aparece fora do resultado', () => {
  // 17,75 de 25 pontos no Kixi; o resultado mostra 14,2/20 do motor. Mostrar 17,75
  // na lista seria outra nota (#820).
  const livre = { correctionStatus: 'DONE', finalScore: 17.75, notaDoMotor: true };
  assert.deepEqual(notaDaSimulacao(livre), { kind: 'nota-no-resultado' });
  assert.equal(estadoDaNotaEmPalavras(livre), 'Corrigida');
  // A percentagem do desempenho continua a poder ser calculada sobre a cotação.
  assert.equal(notaFinal(livre), 17.75);
  // Uma simulação de sala não é «do motor»: mostra o número da pauta.
  assert.deepEqual(notaDaSimulacao({ ...livre, notaDoMotor: false }), { kind: 'nota', nota: 17.75 });
});

test('só uma simulação livre é que depende da nota do motor', () => {
  assert.equal(notaDoMotorDe(1, new Set([2, 3])), true);
  assert.equal(notaDoMotorDe(2, new Set([2, 3])), false);
  // Sem salas legíveis esconde-se: um número errado é pior do que nenhum.
  assert.equal(notaDoMotorDe(1, null), true);
});

test('o sufixo do sino diz a nota ou o estado, nunca um número inventado', () => {
  assert.equal(sufixoDaNota({ correctionStatus: 'DONE', finalScore: 14.5 }), ' com 14,5');
  assert.equal(sufixoDaNota({ correctionStatus: 'PENDING', finalScore: 9 }), ' — a corrigir');
  assert.equal(sufixoDaNota({ correctionStatus: 'FAILED' }), ' — correção falhou');
  // Uma livre corrigida pelo motor: o resultado é que tem o número (#820).
  assert.equal(sufixoDaNota({ correctionStatus: 'DONE', finalScore: 17.75, notaDoMotor: true }), ' — corrigida');
  assert.equal(sufixoDaNota({}), '');
});
