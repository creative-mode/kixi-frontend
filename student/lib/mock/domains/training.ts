import { toLocalDateTime, type MockQuestion } from '../simulation';
import { QUESTIONS_BY_STATEMENT, SimulationRow, json, problem, simulationResponse, yearLabel } from '../store';
import type { MockCtx, Store } from '../store';
import { allocate, planItems, type Candidate } from '../training';

/** Que questões do banco servem para treinar uma prova: as de enunciados publicados da mesma disciplina, menos o da
 *  própria sala e os de qualquer sala ainda por fechar (nunca se vaza a prova à séria), com o histórico do aluno. */
function poolFor(db: Store, accountId: number, room: { id: number; statementId: number }): Candidate[] {
  const subjectId = db.statements.find((s) => s.id === room.statementId)?.subjectId ?? null;
  const locked = new Set(db.rooms.filter((r) => r.status !== 'CLOSED').map((r) => r.statementId));
  locked.add(room.statementId);
  const mine = new Set(db.simulations.filter((s) => s.accountId === accountId).map((s) => s.id));
  const verdict = new Map<number, 'wrong' | 'right'>();
  for (const answer of db.answers) {
    if (!mine.has(answer.simulationId) || answer.isCorrect == null) continue;
    const original = db.questionSource[answer.questionId] ?? answer.questionId;
    // Acertou alguma vez conta como certa; falhou e nunca acertou fica errada.
    if (answer.isCorrect) verdict.set(original, 'right');
    else if (verdict.get(original) !== 'right') verdict.set(original, 'wrong');
  }
  const out: Candidate[] = [];
  for (const statement of db.statements) {
    if (!statement.visible || statement.practiceOwner != null || statement.subjectId !== subjectId || locked.has(statement.id)) continue;
    const year = db.schoolYears.find((y) => y.id === statement.schoolYearId);
    for (const questionId of QUESTIONS_BY_STATEMENT[statement.id] ?? []) {
      const topicIds = db.questionTopics[questionId];
      const question = db.questions.find((q) => q.id === questionId);
      if (!topicIds?.length || !question || question.questionType === 'group') continue;
      out.push({
        questionId,
        statementId: statement.id,
        statementTitle: statement.title,
        year: year ? yearLabel(year) : null,
        topicIds,
        history: verdict.get(questionId) ?? 'new',
      });
    }
  }
  return out;
}

/** Rotas do domínio «treino» do mock: o plano de uma prova agendada e o treino montado por temas. */
export async function trainingRoutes({ method, pathname, body, account, db }: MockCtx): Promise<Response | undefined> {
  const plan = /^\/training\/rooms\/(\d+)\/plan$/.exec(pathname);
  if (plan && method === 'GET') {
    const roomId = Number(plan[1]);
    const room = db.rooms.find((r) => r.id === roomId);
    // Só quem foi convidado vê a matriz; para os outros a sala não existe.
    if (!room || !db.participants.some((p) => p.roomId === roomId && p.accountId === account.id)) return problem(404, 'Exam room not found');
    const matrix = db.matrices.find((m) => m.roomId === roomId);
    if (!matrix) return problem(404, 'Matrix not found');
    const statement = db.statements.find((s) => s.id === room.statementId);
    return json({
      roomId,
      subjectId: statement?.subjectId ?? null,
      subjectName: db.subjects.find((s) => s.id === statement?.subjectId)?.name ?? null,
      statementTitle: statement?.title ?? null,
      startsAt: room.startsAt,
      durationMinutes: room.durationMinutes,
      totalPoints: matrix.totalPoints,
      items: planItems(matrix, db.topics, poolFor(db, account.id, room)),
    });
  }

  if (pathname === '/simulations/practice/matrix' && method === 'POST') {
    const roomId = Number(body.roomId);
    const room = db.rooms.find((r) => r.id === roomId);
    if (!room || !db.participants.some((p) => p.roomId === roomId && p.accountId === account.id)) return problem(404, 'Exam room not found');
    const matrix = db.matrices.find((m) => m.roomId === roomId);
    if (!matrix) return problem(404, 'Matrix not found');
    const requests = (Array.isArray(body.items) ? body.items : [])
      .map((x: { topicId?: unknown; count?: unknown }) => ({ topicId: Number(x.topicId), count: Number(x.count) }))
      .filter((x: { topicId: number; count: number }) => matrix.items.some((m) => m.topicId === x.topicId) && Number.isInteger(x.count) && x.count > 0);
    if (requests.length === 0) return problem(400, 'items must have at least one topic of the matrix');

    const { questionIds, allocation } = allocate(poolFor(db, account.id, room), requests);
    if (questionIds.length === 0) return problem(400, 'There are no questions for the chosen topics');

    // O enunciado virtual do treino: privado, com cópias das questões escolhidas, para a sala do treino e a correção
    // funcionarem como em qualquer enunciado.
    const original = db.statements.find((s) => s.id === room.statementId);
    const statementId = Math.max(...db.statements.map((s) => s.id)) + 1;
    const minutes = Number(body.durationMinutes);
    db.statements.push({
      id: statementId,
      title: `Treino · ${matrix.title ?? original?.title ?? 'Prova'}`,
      examType: 'Treino',
      subjectId: original?.subjectId ?? null,
      schoolYearId: original?.schoolYearId ?? null,
      termId: original?.termId ?? null,
      institutionId: original?.institutionId ?? null,
      classId: original?.classId ?? null,
      durationMinutes: Number.isInteger(minutes) && minutes > 0 ? minutes : null,
      totalMaxScore: null,
      variant: null,
      source: 'MANUAL',
      needsReview: false,
      ocrConfidence: null,
      visible: false,
      practiceOwner: account.id,
    });
    let nextQuestion = Math.max(...db.questions.map((q) => q.id)) + 1;
    const copies: number[] = [];
    questionIds.forEach((sourceId, index) => {
      const source = db.questions.find((q) => q.id === sourceId)!;
      const id = nextQuestion++;
      const copy: MockQuestion = {
        ...source,
        id,
        number: index + 1,
        orderIndex: index,
        parentId: null,
        label: null,
        options: source.options.map((o, i) => ({ ...o, id: id * 10 + i + 1 })),
      };
      db.questions.push(copy);
      db.questionSource[id] = sourceId;
      copies.push(id);
    });
    QUESTIONS_BY_STATEMENT[statementId] = copies;

    const row: SimulationRow = {
      id: db.nextSimulation++,
      accountId: account.id,
      statementId,
      status: 'IN_PROGRESS',
      finalScore: null,
      startedAt: toLocalDateTime(new Date()),
      finishedAt: null,
      timeSpentSeconds: null,
    };
    db.simulations.push(row);
    return json({ simulation: simulationResponse(db, row), allocation }, 201);
  }
  return undefined;
}
