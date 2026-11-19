import assert from 'node:assert/strict';
import { test } from 'node:test';
import { passoDepoisDaLeitura } from './correcao-polling.ts';

test('enquanto está a corrigir, o ecrã continua a ler', () => {
  assert.equal(passoDepoisDaLeitura('a-corrigir'), 'continuar');
});

test('quando a correção termina, pede uma recarga e para o ciclo', () => {
  for (const kind of ['corrigida', 'incompleta', 'falhou']) {
    assert.equal(passoDepoisDaLeitura(kind), 'terminar');
  }
  // Um estado novo do motor também termina a espera: o resultado é que manda.
  assert.equal(passoDepoisDaLeitura('outro-estado'), 'terminar');
});
