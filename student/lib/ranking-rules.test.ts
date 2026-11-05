import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAverage, globalNote, myPositionLabel, podiumGap, smallGroupNote, METRIC_LABEL, PERIOD_LABEL, SCOPE_LABEL } from './ranking-rules.ts';

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

test('o progresso até ao pódio respeita a métrica e não inventa dados ausentes', () => {
  const board = {
    scope: 'class' as const, groupId: 1, statementId: null, period: 'all' as const,
    totalStudents: 8, rankedStudents: 8, smallGroup: false, myPosition: 5, myAverage: 72.4,
    entries: [
      { position: 3, accountId: null, displayName: 'Colega', average: 76.6, xp: 500, me: false },
      { position: 5, accountId: 4, displayName: 'Tu', average: 72.4, xp: 260, me: true },
    ],
  };
  assert.equal(podiumGap(board, 'average'), 'A 4,2 pontos do 3.º lugar');
  assert.equal(podiumGap(board, 'xp'), 'A 240 XP do 3.º lugar');
  assert.equal(podiumGap({ ...board, myPosition: 3 }, 'average'), null);
  assert.equal(podiumGap({ ...board, entries: [] }, 'average'), null);
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
