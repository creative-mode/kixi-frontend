import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SimulationSummary } from './exam-rules.ts';
import { recentPapers, reviewPapers } from './tutor-papers-rules.ts';

const sim = (id: number, statementId: number, status: string, extra: Partial<SimulationSummary> = {}): SimulationSummary => ({
  id,
  status,
  finalScore: null,
  deadline: null,
  statement: { id: statementId, title: `Prova ${statementId}` },
  ...extra,
});

test('as provas recentes vêm da tentativa mais nova para a mais velha, uma por prova', () => {
  const papers = recentPapers(
    [
      sim(1, 10, 'FINISHED', { finalScore: 16.4 }),
      sim(2, 10, 'FINISHED', { finalScore: 12 }),
      sim(3, 11, 'CANCELLED'),
      sim(4, 12, 'FINISHED', { finalScore: 9.5 }),
    ],
    0,
  );
  assert.deepEqual(papers, [
    { statementId: 12, title: 'Prova 12', note: 'Concluída · 9,5' },
    { statementId: 11, title: 'Prova 11', note: 'Cancelada' },
    // A prova 10 aparece duas vezes: vale a tentativa mais recente (id 2), não a nota antiga.
    { statementId: 10, title: 'Prova 10', note: 'Concluída · 12' },
  ]);
});

test('uma prova a decorrer não é oferecida, porque o tutor está fechado', () => {
  const now = Date.parse('2026-01-01T10:00:00Z');
  const live = sim(5, 20, 'IN_PROGRESS', { deadline: '2026-01-01T12:00:00' });
  const expired = sim(4, 21, 'IN_PROGRESS', { deadline: '2026-01-01T09:00:00' });
  const papers = recentPapers([live, expired], now);
  assert.deepEqual(
    papers.map((p) => p.statementId),
    [21],
  );
});

test('uma tentativa sem prova conhecida não entra numa lista de provas', () => {
  const papers = recentPapers(
    [
      { id: 1, status: 'FINISHED', statement: null },
      { id: 2, status: 'FINISHED', statement: { id: null, title: 'Sem id' } },
      sim(3, 30, 'FINISHED'),
    ],
    0,
  );
  assert.deepEqual(papers.map((p) => p.statementId), [30]);
});

test('a lista fica nas três primeiras, e uma lista vazia continua vazia', () => {
  const many = Array.from({ length: 6 }, (_, i) => sim(i + 1, i + 1, 'FINISHED'));
  assert.equal(recentPapers(many, 0).length, 3);
  assert.deepEqual(recentPapers([], 0), []);
});

test('sem título, a prova não fica sem nome', () => {
  const [paper] = recentPapers([sim(1, 7, 'FINISHED', { statement: { id: 7, title: '  ' } })], 0);
  assert.equal(paper.title, 'Prova');
  assert.equal(paper.note, 'Concluída');
});

test('«Para rever» mantém a ordem do mais fraco para o mais forte e mostra a percentagem', () => {
  const papers = reviewPapers([
    { id: 1, label: 'Redes', value: 40 },
    { id: 2, label: 'Sistemas', value: 65 },
    { id: 3, label: 'Matemática', value: 80 },
    { id: 4, label: 'Física', value: 90 },
  ]);
  assert.deepEqual(papers, [
    { statementId: 1, title: 'Redes', note: '40%' },
    { statementId: 2, title: 'Sistemas', note: '65%' },
    { statementId: 3, title: 'Matemática', note: '80%' },
  ]);
});
