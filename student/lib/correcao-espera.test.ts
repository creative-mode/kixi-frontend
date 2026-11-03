// node --test student/lib/correcao-espera.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { faseDaEspera, passosDaEspera } from './correcao-espera.ts';

const MINUTO = 60_000;

test('a espera começa tranquila e informa que a prova está guardada', () => {
  const f = faseDaEspera(0);
  assert.equal(f.id, 'inicio');
  assert.match(f.mensagem, /guardada/);
  assert.equal(f.conselho, null);
});

test('as fases avançam com o tempo e nenhuma é um erro nem desiste de ler', () => {
  const fases = [0, 10_000, 45_000, 3 * MINUTO, 12 * MINUTO, 60 * MINUTO].map(faseDaEspera);
  assert.deepEqual(fases.map((f) => f.id), ['inicio', 'inicio', 'a-decorrer', 'demora', 'demora', 'demora']);
  for (const f of fases) {
    assert.ok(f.intervaloMs > 0 && Number.isFinite(f.intervaloMs), 'continua a ler, sempre');
    assert.doesNotMatch(`${f.titulo} ${f.mensagem}`, /demorar mais do que o esperado|falhou|erro|não conseguimos|problema/i);
  }
});

test('o intervalo de leitura alonga-se para não sobrecarregar, sem nunca parar', () => {
  const intervalos = [0, 45_000, 3 * MINUTO, 12 * MINUTO].map((t) => faseDaEspera(t).intervaloMs);
  assert.deepEqual(intervalos, [3000, 8000, 15000, 30000]);
});

test('só depois de muito tempo há um conselho, dito sem alarme, e diz que o aluno pode sair', () => {
  assert.equal(faseDaEspera(5 * MINUTO).conselho, null);
  const c = faseDaEspera(11 * MINUTO).conselho ?? '';
  assert.match(c, /fecha este ecrã e volta mais tarde/);
  assert.match(c, /professor/);
});

test('um tempo negativo conta como o início', () => {
  assert.equal(faseDaEspera(-5).id, 'inicio');
});

test('os passos são entregue (feito), a corrigir (agora) e resultado (a seguir)', () => {
  assert.deepEqual(passosDaEspera().map((p) => [p.id, p.estado]), [['entregue', 'feito'], ['a-corrigir', 'atual'], ['resultado', 'seguinte']]);
});
