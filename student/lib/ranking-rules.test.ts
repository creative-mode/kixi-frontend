import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAverage, globalNote, myPositionLabel, nextPlaceGap, podiumGap, METRIC_LABEL, PERIOD_LABEL, SCOPE_LABEL, showsNameInRanking, relativeBandLabel, visibilityNote, type VisibilityPreferences } from './ranking-rules.ts';

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

test('a faixa relativa fala do topo e do meio, mas nunca nomeia o fundo', () => {
  assert.equal(relativeBandLabel(1, 10), 'Estás entre os 30% melhores.');
  assert.equal(relativeBandLabel(3, 10), 'Estás entre os 30% melhores.');
  assert.equal(relativeBandLabel(5, 10), 'Estás entre os 40% do meio.');
  assert.equal(relativeBandLabel(7, 10), 'Estás entre os 40% do meio.');
  // O fundo não leva etiqueta: o aluno continua a ver a posição, sem o ecrã lhe
  // dizer que é dos últimos.
  assert.equal(relativeBandLabel(8, 10), null);
  assert.equal(relativeBandLabel(10, 10), null);
  assert.equal(relativeBandLabel(null, 10), null);
  assert.equal(relativeBandLabel(3, 0), null);
});

test('o interruptor só está ligado quando o nome aparece nos três âmbitos', () => {
  const visible: VisibilityPreferences = { class: 'visible', school: 'visible', friends: 'visible' };
  const anonymous: VisibilityPreferences = { class: 'anonymous', school: 'anonymous', friends: 'anonymous' };
  const mixed: VisibilityPreferences = { class: 'hidden', school: 'visible', friends: 'hidden' };
  const hidden: VisibilityPreferences = { class: 'hidden', school: 'hidden', friends: 'hidden' };
  assert.equal(showsNameInRanking(visible), true);
  assert.equal(showsNameInRanking(anonymous), false);
  assert.equal(showsNameInRanking(mixed), false);
  assert.equal(showsNameInRanking(hidden), false);
});

test('o texto do interruptor diz o que os colegas veem, em cada estado', () => {
  const visible: VisibilityPreferences = { class: 'visible', school: 'visible', friends: 'visible' };
  const anonymous: VisibilityPreferences = { class: 'anonymous', school: 'anonymous', friends: 'anonymous' };
  const mixed: VisibilityPreferences = { class: 'hidden', school: 'visible', friends: 'hidden' };
  const hidden: VisibilityPreferences = { class: 'hidden', school: 'hidden', friends: 'hidden' };
  // Ligado ou desligado, a frase é a mesma que a maquete mostra: desligar deixa
  // a linha na tabela, só o nome sai.
  assert.match(visibilityNote(visible), /Desligado, os colegas veem «Um colega»/);
  assert.match(visibilityNote(anonymous), /Um colega/);
  assert.match(visibilityNote(mixed), /alguns rankings/);
  assert.match(visibilityNote(hidden), /não te veem no ranking/);
  assert.match(visibilityNote(hidden), /Continuas a ver a tua posição/);
});

test('o próximo lugar mede-se pelo vizinho logo acima, sem inventar dados', () => {
  const board = {
    scope: 'class' as const, groupId: 1, statementId: null, period: 'all' as const,
    totalStudents: 10, rankedStudents: 10, smallGroup: false, myPosition: 4, myAverage: 14.2,
    entries: [
      { position: 3, accountId: null, displayName: 'Colega A', average: 16.5, xp: 500, me: false },
      { position: 4, accountId: 4, displayName: 'Tu', average: 14.2, xp: 380, me: true },
    ],
  };
  assert.equal(nextPlaceGap(board, 'average'), 'Faltam 2,3 pontos para subires um lugar.');
  assert.equal(nextPlaceGap(board, 'xp'), 'Faltam 120 XP para subires um lugar.');
  // Sem a linha de cima à vista, não há distância a anunciar.
  assert.equal(nextPlaceGap({ ...board, entries: [board.entries[1]] }, 'average'), null);
  // O primeiro lugar não tem ninguém acima.
  assert.equal(nextPlaceGap({ ...board, myPosition: 1, entries: [{ ...board.entries[1], position: 1 }] }, 'average'), null);
  // Sem nota de um dos lados, também não.
  assert.equal(nextPlaceGap({ ...board, entries: [{ ...board.entries[0], average: null }, board.entries[1]] }, 'average'), null);
  // O global compara percentis dentro da própria escola, não notas.
  const global = {
    ...board, scope: 'global' as const, myPercentile: 60,
    entries: [
      { position: 3, accountId: null, displayName: 'Aluno de outra escola', average: 18, percentile: 72, me: false },
      board.entries[1],
    ],
  };
  assert.equal(nextPlaceGap(global, 'average'), 'Faltam 12,0 pontos percentuais para subires um lugar.');
});
