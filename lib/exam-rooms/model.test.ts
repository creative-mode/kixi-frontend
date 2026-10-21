// node --test lib/exam-rooms/model.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  draftProblem,
  formatCountdown,
  formatWall,
  gradesCsv,
  gradesToSend,
  invalidDrafts,
  parseScore,
  luandaNowInput,
  participantName,
  roomActions,
  statementFitsRoom,
  summarizeGrades,
  summarizeIntegrity,
  INTEGRITY_COALESCE_MS,
  INTEGRITY_LABEL,
  toLocalDateTime,
  wallMinutes,
  preselectFromStatement,
  type IntegrityEvent,
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

const review = {
  pending: 3,
  graded: 1,
  questions: [
    {
      questionId: 1, number: 3, label: 'a', parentId: null, text: 'Explica', maxScore: 4, modelAnswer: 'x',
      answers: [
        { answerId: 10, accountId: 1, displayName: 'Ana', answerText: 'a', status: 'PENDING_REVIEW' as const, scoreObtained: null },
        { answerId: 11, accountId: 2, displayName: 'Bruno', answerText: 'b', status: 'PENDING_REVIEW' as const, scoreObtained: null },
        { answerId: 12, accountId: 3, displayName: 'Carla', answerText: 'c', status: 'GRADED' as const, scoreObtained: 2 },
      ],
    },
  ],
};

test('a nota aceita vírgula decimal e recusa o vazio, o negativo e o que passa da cotação', () => {
  assert.equal(parseScore('2,5', 4), 2.5);
  assert.equal(parseScore('', 4), null);
  assert.equal(parseScore('-1', 4), null);
  assert.equal(parseScore('4,5', 4), null);
  assert.equal(parseScore('abc', 4), null);
  assert.equal(parseScore('9', null), 9);
});

test('só seguem as respostas por corrigir com nota válida; as já corrigidas ficam de fora', () => {
  const drafts = { 10: '3', 11: '', 12: '1' };
  assert.deepEqual(gradesToSend(review, drafts), [{ answerId: 10, score: 3 }]);
});

test('as notas inválidas são apontadas para o professor as ver', () => {
  assert.deepEqual(invalidDrafts(review, { 10: '5', 11: '2' }), [10]);
  assert.deepEqual(invalidDrafts(review, { 10: '', 11: '1' }), []);
});

test('os tipos de evento são os mesmos que o aluno escreve', () => {
  // A lista do aluno (`student/lib/integrity.ts`) e o contrato do backend têm de
  // falar destes nomes. Este é o lado do gestor: um evento que o aluno escreve e
  // aqui não se sabe ler aparece como um código cru no ecrã do professor.
  assert.deepEqual(
    Object.keys(INTEGRITY_LABEL).sort(),
    ['PASTE_BLOCKED', 'TAB_HIDDEN', 'TAB_VISIBLE', 'TUTOR_BLOCKED', 'WINDOW_BLUR', 'WINDOW_FOCUS'].sort(),
  );
});

test('o resumo conta as saídas e não os regressos', () => {
  const events: IntegrityEvent[] = [
    { id: 1, kind: 'TAB_HIDDEN', at: '2026-10-18T09:00:00', questionId: null },
    { id: 2, kind: 'WINDOW_BLUR', at: '2026-10-18T09:00:01', questionId: null },
    { id: 3, kind: 'TAB_VISIBLE', at: '2026-10-18T09:00:30', questionId: null },
    { id: 4, kind: 'PASTE_BLOCKED', at: '2026-10-18T09:01:00', questionId: 12 },
  ];
  const s = summarizeIntegrity(events);
  assert.equal(s.total, 4);
  // Esconder o separador e perder o foco são a MESMA saída: um segundo de
  // diferença cai dentro da janela de coalescência, e o regresso não soma.
  assert.equal(s.exits, 1);
  // A contagem por tipo continua crua: dois sinais, dois eventos.
  assert.deepEqual(s.byKind, [
    { kind: 'TAB_HIDDEN', label: 'Saiu do separador', count: 1 },
    { kind: 'WINDOW_BLUR', label: 'Perdeu o foco da janela', count: 1 },
    { kind: 'TAB_VISIBLE', label: 'Voltou ao separador', count: 1 },
    { kind: 'PASTE_BLOCKED', label: 'Tentou colar uma resposta', count: 1 },
  ]);
  assert.deepEqual(summarizeIntegrity([]), { total: 0, exits: 0, byKind: [] });
});

test('a janela da mesma saída é a mesma do aluno', () => {
  // Duplicada de `student/lib/integrity.ts` (`COALESCE_MS`), como a lista de tipos:
  // se uma mudar sem a outra, o professor conta saídas que o aluno não teve.
  assert.equal(INTEGRITY_COALESCE_MS, 2_000);
});

test('duas saídas separadas contam duas, mesmo com os dois sinais em cada', () => {
  const events: IntegrityEvent[] = [
    { id: 1, kind: 'TAB_HIDDEN', at: '2026-10-18T09:00:00', questionId: null },
    { id: 2, kind: 'WINDOW_BLUR', at: '2026-10-18T09:00:01', questionId: null },
    { id: 3, kind: 'TAB_VISIBLE', at: '2026-10-18T09:00:30', questionId: null },
    { id: 4, kind: 'WINDOW_FOCUS', at: '2026-10-18T09:00:31', questionId: null },
    { id: 5, kind: 'WINDOW_BLUR', at: '2026-10-18T09:05:00', questionId: null },
    { id: 6, kind: 'TAB_HIDDEN', at: '2026-10-18T09:05:01', questionId: null },
  ];
  assert.equal(summarizeIntegrity(events).exits, 2);
});

test('a deduplicação é pela hora, não pela ordem de chegada', () => {
  const events: IntegrityEvent[] = [
    { id: 1, kind: 'WINDOW_BLUR', at: '2026-10-18T09:00:01', questionId: null },
    { id: 2, kind: 'TAB_HIDDEN', at: '2026-10-18T09:00:00', questionId: null },
  ];
  assert.equal(summarizeIntegrity(events).exits, 1);
});

test('um evento sem hora legível não engole a saída seguinte', () => {
  const events: IntegrityEvent[] = [
    { id: 1, kind: 'TAB_HIDDEN', at: 'lixo', questionId: null },
    { id: 2, kind: 'WINDOW_BLUR', at: '2026-10-18T09:00:00', questionId: null },
  ];
  // Sem hora não se pode provar que é a mesma saída: conta como uma, e a que tem
  // hora conta como outra. Vale mais contar a mais do que esconder a saída.
  assert.equal(summarizeIntegrity(events).exits, 2);
});

test('um evento que o gestor não conhece mostra o código, não um rótulo inventado', () => {
  // O backend pode acrescentar um evento antes de o gestor o conhecer; mostrar o
  // código cru diz ao professor que há ali algo novo, em vez de o esconder.
  const s = summarizeIntegrity([{ id: 1, kind: 'NOVO_EVENTO', at: '2026-10-18T09:00:00', questionId: null }]);
  assert.equal(s.byKind[0].label, 'NOVO_EVENTO');
});
