// node --test lib/exam-rooms/model.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  draftProblem,
  formatCountdown,
  formatWall,
  gradesCsv,
  luandaNowInput,
  participantName,
  roomActions,
  statementFitsRoom,
  summarizeGrades,
  toLocalDateTime,
  wallMinutes,
  preselectFromStatement,
} from './model.ts';

test('a hora de parede não passa pelo fuso do browser', () => {
  assert.equal(wallMinutes('2026-10-12T09:30:00')! - wallMinutes('2026-10-12T08:00')!, 90);
  assert.equal(wallMinutes('lixo'), null);
  assert.equal(formatWall('2026-10-12T09:05:00', 2026), '12/10 09:05');
  assert.equal(formatWall('2025-01-02T23:59:00', 2026), '02/01/2025 23:59');
  assert.equal(toLocalDateTime('2026-10-12T09:05'), '2026-10-12T09:05:00');
});

test('agora em Luanda é UTC+1', () => {
  assert.equal(luandaNowInput(new Date('2026-10-12T23:30:00Z')), '2026-10-13T00:30');
});

test('contagem decrescente', () => {
  assert.equal(formatCountdown(65), '01:05');
  assert.equal(formatCountdown(3725), '1:02:05');
  assert.equal(formatCountdown(-3), '00:00');
});

const base = { classId: '1', statementId: '2', startsAt: '2026-10-12T09:00', endsAt: '2026-10-12T11:00', durationMinutes: '90' };

test('a sala só se cria com turma, enunciado, janela e duração que cabe nela', () => {
  assert.equal(draftProblem(base), null);
  assert.match(draftProblem({ ...base, classId: '' })!, /turma/);
  assert.match(draftProblem({ ...base, endsAt: '2026-10-12T09:00' })!, /fechar depois/);
  assert.match(draftProblem({ ...base, durationMinutes: '0' })!, /inteiro/);
  assert.match(draftProblem({ ...base, durationMinutes: '150' })!, /não cabe/);
});

test('o enunciado tem de ser da turma da sala; sem turma, só o ADMIN', () => {
  assert.equal(statementFitsRoom({ classId: 3 }, 3, false), true);
  assert.equal(statementFitsRoom({ classId: 4 }, 3, true), false);
  assert.equal(statementFitsRoom({ classId: null }, 3, false), false);
  assert.equal(statementFitsRoom({ classId: null }, 3, true), true);
});

const room = { startsAt: '2026-10-12T09:00:00', endsAt: '2026-10-12T11:00:00' };

test('as transições seguem o ExamRoomService.transition', () => {
  const draftEarly = roomActions({ ...room, status: 'DRAFT' }, '2026-10-12T08:00');
  assert.equal(draftEarly.open.allowed, true);
  assert.equal(draftEarly.start.allowed, false);
  assert.equal(draftEarly.close.allowed, false);

  assert.equal(roomActions({ ...room, status: 'DRAFT' }, '2026-10-12T11:00').open.allowed, false);

  const openEarly = roomActions({ ...room, status: 'OPEN' }, '2026-10-12T08:59');
  assert.equal(openEarly.start.allowed, false);
  assert.match(openEarly.start.reason!, /12\/10 09:00/);
  assert.equal(openEarly.close.allowed, true);

  assert.equal(roomActions({ ...room, status: 'OPEN' }, '2026-10-12T09:00').start.allowed, true);
  assert.equal(roomActions({ ...room, status: 'RUNNING' }, '2026-10-12T10:00').close.allowed, true);
  const closed = roomActions({ ...room, status: 'CLOSED' }, '2026-10-12T10:00');
  assert.equal(closed.open.allowed || closed.start.allowed || closed.close.allowed, false);
});

const grades = [
  { accountId: 1, simulationId: 1, status: 'FINISHED', finalScore: 15.5, correctAnswers: 8, totalQuestions: 10, pendingReviewCount: 0, finishedAt: '2026-10-12T10:30:00' },
  { accountId: 2, simulationId: 2, status: 'FINISHED', finalScore: 8, correctAnswers: 4, totalQuestions: 10, pendingReviewCount: 1, finishedAt: '2026-10-12T10:40:00' },
  { accountId: 3, simulationId: 3, status: 'FINISHED', finalScore: 20, correctAnswers: 10, totalQuestions: 10, pendingReviewCount: 0, finishedAt: null },
  { accountId: 4, simulationId: null, status: null, finalScore: null, correctAnswers: null, totalQuestions: null, pendingReviewCount: null, finishedAt: null, displayName: 'Ana Silva' },
];

test('resumo das notas: média, extremos, aprovação e distribuição', () => {
  const s = summarizeGrades(grades, 20);
  assert.equal(s.invited, 4);
  assert.equal(s.graded, 3);
  assert.equal(s.pendingReview, 1);
  assert.equal(s.average, 14.5);
  assert.equal(s.min, 8);
  assert.equal(s.max, 20);
  assert.equal(s.passRate, 66.7);
  // 20 cai no último intervalo, e não num 11.º
  assert.equal(s.buckets.length, 10);
  assert.equal(s.buckets[9].count, 1);
  assert.equal(s.buckets[7].count, 1);
  assert.equal(s.buckets[4].count, 1);
});

test('sem notas, o resumo não inventa zeros', () => {
  const s = summarizeGrades([grades[3]]);
  assert.equal(s.average, null);
  assert.equal(s.passRate, null);
});

test('o nome cai para o número da conta enquanto o backend não o devolve', () => {
  assert.equal(participantName({ accountId: 42 }), 'Aluno n.º 42');
  assert.equal(participantName({ accountId: 42, displayName: ' Ana ' }), 'Ana');
});

test('CSV para o Excel em português', () => {
  const csv = gradesCsv(grades);
  assert.ok(csv.startsWith('\uFEFFAluno;Conta;Estado;Nota'));
  assert.match(csv, /Aluno n\.º 1;1;Entregou;15,5;8;10;0;12\/10 10:30/);
  assert.match(csv, /Ana Silva;4;;;;;;/);
  assert.ok(gradesCsv([{ ...grades[0], displayName: 'Silva; "Zé"' }]).includes('"Silva; ""Zé""";1;'));
});


// ── abrir o assistente a partir de um enunciado ─────────────────────────────


const ENUNCIADOS = [
  { id: 7, classId: 12, durationMinutes: 90 },
  { id: 8, classId: null, durationMinutes: null },
  { id: 9, classId: 99, durationMinutes: 60 },
];
const TURMAS = [{ id: 12 }, { id: 13 }];

test('vindo de um enunciado, o assistente escolhe a turma dele e a duração da prova', () => {
  assert.deepEqual(preselectFromStatement(ENUNCIADOS, TURMAS, '7', false), { classId: '12', statementId: '7', durationMinutes: 90 });
});

test('um enunciado sem turma deixa a turma por escolher quando há várias, e usa-a quando há uma só (ADMIN)', () => {
  assert.deepEqual(preselectFromStatement(ENUNCIADOS, TURMAS, '8', true), { classId: '', statementId: '', durationMinutes: null });
  assert.deepEqual(preselectFromStatement(ENUNCIADOS, [{ id: 12 }], '8', true), { classId: '12', statementId: '8', durationMinutes: null });
});

test('um enunciado de uma turma que o utilizador não tem, ou que não existe, não se pré-seleciona', () => {
  assert.equal(preselectFromStatement(ENUNCIADOS, TURMAS, '9', false), null);
  assert.equal(preselectFromStatement(ENUNCIADOS, TURMAS, '1000', false), null);
});

test('um parâmetro que não é um número, ou ausente, não pré-seleciona nada', () => {
  assert.equal(preselectFromStatement(ENUNCIADOS, TURMAS, 'abc', false), null);
  assert.equal(preselectFromStatement(ENUNCIADOS, TURMAS, '7; drop', false), null);
  assert.equal(preselectFromStatement(ENUNCIADOS, TURMAS, undefined, false), null);
  assert.equal(preselectFromStatement(ENUNCIADOS, TURMAS, null, false), null);
});
