// node --test lib/mock/exam-rooms.test.ts
//
// O mock das salas tem de dizer o mesmo que o ExamRoomService do backend.
import test from 'node:test';
import assert from 'node:assert/strict';
import { examRooms, liveStream, type RoomWorld } from './exam-rooms.ts';

const TEACHER = 10;
const OTHER_TEACHER = 11;
const ADMIN = 1;
const S1 = 100;
const S2 = 101;
const OUTSIDER = 102;

function world(now = '2026-10-12T09:30:00') {
  let seq = 1000;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: Record<string, any[]> = {
    statements: [
      { id: 1, classId: 7, subjectId: 3, institutionId: 1, questions: [{ id: 1 }, { id: 2 }], deletedAt: null },
      { id: 2, classId: null, subjectId: 3, institutionId: null, questions: [], deletedAt: null },
      { id: 3, classId: 8, subjectId: 3, institutionId: 1, questions: [], deletedAt: null },
    ],
    classes: [{ id: 7, deletedAt: null }, { id: 8, deletedAt: null }],
    accounts: [{ id: S1 }, { id: S2 }, { id: OUTSIDER }, { id: TEACHER }],
    enrollments: [
      { accountId: S1, classId: 7, deletedAt: null },
      { accountId: S2, classId: 7, deletedAt: null },
      { accountId: OUTSIDER, classId: 8, deletedAt: null },
    ],
    simulations: [],
    'simulation-answers': [],
    'integrity-events': [],
  };
  const clock = { now };
  const w: RoomWorld = {
    db,
    add: (table, row) => {
      const r = { id: ++seq, ...row, deletedAt: null };
      (db[table] ??= []).push(r);
      return r;
    },
    clock: () => clock.now,
    // O professor 10 dá a turma 7; o 11 não dá nenhuma.
    canWriteStatement: (id, account, admin) => admin || (account === TEACHER && id === 1),
    isStudent: (id) => [S1, S2, OUTSIDER].includes(id),
  };
  return { rooms: examRooms(w), db, clock };
}

const room = { statementId: 1, classId: 7, startsAt: '2026-10-12T10:00:00', endsAt: '2026-10-12T12:00:00', durationMinutes: 90 };

test('criar: turma igual à do enunciado, e o professor tem de o poder escrever', () => {
  const { rooms } = world();
  const r = rooms.create(room, TEACHER, false);
  assert.equal(r.ok && r.status, 201);
  assert.equal(r.ok && r.body.status, 'DRAFT');

  const wrongClass = rooms.create({ ...room, classId: 8 }, TEACHER, false);
  assert.equal(!wrongClass.ok && wrongClass.problem.status, 403);
  const noClassStatement = rooms.create({ ...room, statementId: 2 }, TEACHER, false);
  assert.equal(!noClassStatement.ok && noClassStatement.problem.status, 403);
  assert.equal(rooms.create({ ...room, statementId: 2 }, ADMIN, true).ok, true);
  const notHis = rooms.create(room, OTHER_TEACHER, false);
  assert.equal(!notHis.ok && notHis.problem.status, 403);
  const backwards = rooms.create({ ...room, endsAt: room.startsAt }, TEACHER, false);
  assert.equal(!backwards.ok && backwards.problem.status, 400);
});

test('convidar a turma inteira; aluno de outra turma é recusado', () => {
  const { rooms } = world();
  const r = rooms.create(room, TEACHER, false);
  const id = r.ok ? r.body.id : 0;
  assert.equal(rooms.addParticipant(id, { classId: 7 }, TEACHER, false).ok, true);
  const first = rooms.live(id, TEACHER, false);
  assert.equal(first.ok && first.body.totalParticipants, 2);
  // convidar outra vez não duplica
  rooms.addParticipant(id, { classId: 7 }, TEACHER, false);
  const again = rooms.live(id, TEACHER, false);
  assert.equal(again.ok && again.body.totalParticipants, 2);
  const outsider = rooms.addParticipant(id, { accountId: OUTSIDER }, TEACHER, false);
  assert.equal(!outsider.ok && outsider.problem.status, 403);
  const both = rooms.addParticipant(id, { accountId: S1, classId: 7 }, TEACHER, false);
  assert.equal(!both.ok && both.problem.status, 400);
  const stranger = rooms.addParticipant(id, { classId: 7 }, OTHER_TEACHER, false);
  assert.equal(!stranger.ok && stranger.problem.status, 403);
});

test('de ponta a ponta: abrir, iniciar na janela, entrar, encerrar e notas', () => {
  const { rooms, clock, db } = world('2026-10-12T09:30:00');
  const r = rooms.create(room, TEACHER, false);
  const id = r.ok ? r.body.id : 0;
  rooms.addParticipant(id, { classId: 7 }, TEACHER, false);

  const early = rooms.transition(id, TEACHER, false, 'RUNNING');
  assert.equal(!early.ok && early.problem.status, 409);
  assert.equal(rooms.transition(id, TEACHER, false, 'OPEN').ok, true);
  // aberta mas antes da hora: entra na sala de espera, sem simulação
  const lobby = rooms.join(id, S1);
  assert.equal(lobby.ok && lobby.body.simulationId, null);
  const tooSoon = rooms.transition(id, TEACHER, false, 'RUNNING');
  assert.equal(!tooSoon.ok && tooSoon.problem.status, 409);

  clock.now = '2026-10-12T10:00:00';
  assert.equal(rooms.transition(id, TEACHER, false, 'RUNNING').ok, true);
  const joined = rooms.join(id, S1);
  const simId = joined.ok ? joined.body.simulationId : null;
  assert.ok(simId);
  db['simulation-answers'].push({ simulationId: simId, questionId: 1, isCorrect: true, deletedAt: null });
  const outsider = rooms.join(id, OUTSIDER);
  assert.equal(!outsider.ok && outsider.problem.status, 403);

  clock.now = '2026-10-12T10:30:00';
  const snap = rooms.live(id, TEACHER, false);
  assert.ok(snap.ok);
  if (snap.ok) {
    assert.equal(snap.body.remainingSeconds, 5400);
    assert.equal(snap.body.joinedParticipants, 1);
    const s1 = snap.body.participants.find((p: { accountId: number }) => p.accountId === S1);
    assert.deepEqual([s1.status, s1.answeredQuestions, s1.totalQuestions], ['IN_PROGRESS', 1, 2]);
  }

  assert.equal(rooms.transition(id, TEACHER, false, 'CLOSED').ok, true);
  const g = rooms.grades(id, TEACHER, false);
  assert.ok(g.ok);
  if (g.ok) {
    const s1 = g.body.find((x: { accountId: number }) => x.accountId === S1);
    const s2 = g.body.find((x: { accountId: number }) => x.accountId === S2);
    assert.equal(s1.status, 'FINISHED');
    assert.equal(s1.correctAnswers, 1);
    assert.equal(s2.simulationId, null);
  }
  const reopen = rooms.transition(id, TEACHER, false, 'OPEN');
  assert.equal(!reopen.ok && reopen.problem.status, 409);
  const closedJoin = rooms.join(id, S2);
  assert.equal(!closedJoin.ok && closedJoin.problem.status, 409);
});

test('os eventos de integridade saem por aluno, com a hora e sem os de outra tentativa', () => {
  const { rooms, db } = world('2026-10-12T10:30:00');
  const r = rooms.create(room, TEACHER, false);
  const id = r.ok ? r.body.id : 0;
  rooms.addParticipant(id, { classId: 7 }, TEACHER, false);
  assert.equal(rooms.transition(id, TEACHER, false, 'OPEN').ok, true);
  assert.equal(rooms.transition(id, TEACHER, false, 'RUNNING').ok, true);

  const joined = rooms.join(id, S1);
  const simId = joined.ok ? joined.body.simulationId : null;
  db['integrity-events'].push(
    { id: 1, simulationId: simId, kind: 'TAB_HIDDEN', questionId: null, at: '2026-10-12T10:05:00', deletedAt: null },
    { id: 2, simulationId: simId, kind: 'PASTE_BLOCKED', questionId: 1, at: '2026-10-12T10:06:00', deletedAt: null },
    // De outra tentativa, de outro aluno: não pode aparecer na sala.
    { id: 3, simulationId: 999, kind: 'TAB_HIDDEN', questionId: null, at: '2026-10-12T10:07:00', deletedAt: null },
  );

  const seen = rooms.integrity(id, TEACHER, false);
  assert.ok(seen.ok);
  if (seen.ok) {
    const s1 = seen.body.participants.find((p: { accountId: number }) => p.accountId === S1);
    assert.deepEqual(s1.events.map((e: { id: number }) => e.id), [1, 2]);
    assert.equal(s1.events[1].questionId, 1);
    // O S2 foi convidado mas não entrou: sem tentativa, sem eventos.
    const s2 = seen.body.participants.find((p: { accountId: number }) => p.accountId === S2);
    assert.deepEqual(s2.events, []);
  }

  // Outro professor não lê os eventos de uma sala que não é dele.
  const stranger = rooms.integrity(id, OTHER_TEACHER, false);
  assert.equal(!stranger.ok && stranger.problem.status, 403);
});

test('o /live termina quando a sala fecha', async () => {
  let status = 'RUNNING';
  const res = liveStream(() => ({ ok: true, status: 200, body: { status } }), 5);
  const reader = res.body!.getReader();
  const first = new TextDecoder().decode((await reader.read()).value);
  assert.match(first, /^event:progress\ndata:\{"status":"RUNNING"\}\n\n$/);
  status = 'CLOSED';
  let done = false;
  for (let i = 0; i < 5 && !done; i++) done = (await reader.read()).done;
  assert.equal(done, true);
});

test('review: numa sala de um plano as respostas vêm com a nota e a observação da IA, só para leitura (kixi#542)', () => {
  const { rooms, db } = world();
  db.statements[0].questions = [{ id: 1, number: 1, text: 'Explique.', maxScore: 6, modelAnswer: 'chave' }];
  db['exam-rooms'] = [{ id: 50, statementId: 1, classId: 7, teacherAccountId: TEACHER, status: 'CLOSED', startsAt: '2026-10-12T10:00:00', endsAt: '2026-10-12T12:00:00', durationMinutes: 90 }];
  db['exam-room-participants'] = [{ examRoomId: 50, accountId: S1, simulationId: 900 }, { examRoomId: 50, accountId: S2, simulationId: 901 }];
  db['simulation-answers'] = [
    { id: 1, simulationId: 900, questionId: 1, answerText: 'a', reviewStatus: 'AI_GRADED', scoreObtained: 4, aiFeedback: 'Falta o tempo de vida.', aiLevel: 'PARCIAL', aiConfidence: 0.8, deletedAt: null },
    { id: 2, simulationId: 901, questionId: 1, answerText: 'b', reviewStatus: 'PENDING_REVIEW', scoreObtained: null, deletedAt: null },
  ];

  const r = rooms.review(50, TEACHER, false, true);

  assert.ok(r.ok);
  assert.equal(r.body.planLinked, true);
  assert.equal(r.body.aiGraded, 1);
  assert.equal(r.body.pending, 1);
  const [first, second] = r.body.questions[0].answers;
  assert.equal(first.status, 'AI_GRADED');
  assert.equal(first.aiFeedback, 'Falta o tempo de vida.');
  assert.equal(first.scoreObtained, 4);
  assert.equal(second.status, 'PENDING_REVIEW');
  assert.equal(second.scoreObtained, null);

  // outra pessoa não vê a sala
  const other = rooms.review(50, OTHER_TEACHER, false, true);
  assert.equal(!other.ok && other.problem.status, 403);
});

test('review: numa sala livre continua a ser do professor (planLinked falso)', () => {
  const { rooms, db } = world();
  db.statements[0].questions = [{ id: 1, number: 1, text: 'Explique.', maxScore: 6 }];
  db['exam-rooms'] = [{ id: 51, statementId: 1, classId: 7, teacherAccountId: TEACHER, status: 'CLOSED', startsAt: '2026-10-12T10:00:00', endsAt: '2026-10-12T12:00:00', durationMinutes: 90 }];
  db['exam-room-participants'] = [{ examRoomId: 51, accountId: S1, simulationId: 910 }];
  db['simulation-answers'] = [{ id: 3, simulationId: 910, questionId: 1, answerText: 'a', reviewStatus: 'PENDING_REVIEW', deletedAt: null }];

  const r = rooms.review(51, TEACHER, false, false);

  assert.ok(r.ok);
  assert.equal(r.body.planLinked, false);
  assert.equal(r.body.pending, 1);
});
