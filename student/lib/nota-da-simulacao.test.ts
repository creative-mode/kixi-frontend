import assert from 'node:assert/strict';
import { test } from 'node:test';
import { estadoDaNotaEmPalavras, notaDaSimulacao, notaFinal } from './nota-da-simulacao.ts';

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

test('um estado novo do backend cai na nota final em vez de esconder tudo', () => {
  assert.deepEqual(notaDaSimulacao({ correctionStatus: 'OUTRO', finalScore: 11 }), { kind: 'nota', nota: 11 });
});
