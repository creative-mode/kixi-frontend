import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAverage, globalNote, myPositionLabel, smallGroupNote, METRIC_LABEL, PERIOD_LABEL, SCOPE_LABEL } from './ranking-rules.ts';

test('os rótulos das abas são os scopes do backend', () => {
  assert.equal(SCOPE_LABEL.class, 'Turma');
  assert.equal(SCOPE_LABEL.school, 'Escola');
  assert.equal(SCOPE_LABEL.friends, 'Amigos');
  assert.equal(SCOPE_LABEL.global, 'Global');
});

test('a média formata-se com uma casa decimal, e sem nota dá um traço', () => {
  assert.equal(formatAverage(16.4), '16,4');
  assert.equal(formatAverage(20), '20,0');
  assert.equal(formatAverage(null), '—');
});

test('a posição só aparece com nota rankeável', () => {
  assert.equal(myPositionLabel(5, 28), '5.º de 28');
  assert.equal(myPositionLabel(null, 28), null);
});

test('o aviso de grupo pequeno só aparece quando o backend o assinala', () => {
  assert.match(smallGroupNote(true) ?? '', /últimos lugares/);
  assert.equal(smallGroupNote(false), null);
});

test('as opções de período e de métrica têm rótulo em português', () => {
  assert.equal(PERIOD_LABEL.month, 'Últimos 30 dias');
  assert.equal(METRIC_LABEL.xp, 'XP acumulado');
});

test('a nota do ranking global diz de quantas escolas vem e explica o percentil', () => {
  assert.match(globalNote(3, 'average'), /3 escolas/);
  assert.match(globalNote(3, 'average'), /percentil/);
  assert.match(globalNote(1, 'xp'), /1 escola,/);
  assert.doesNotMatch(globalNote(3, 'xp'), /percentil/);
  assert.match(globalNote(0, 'average'), /Ainda não há escolas/);
  assert.match(globalNote(undefined, 'average'), /Ainda não há escolas/);
});
