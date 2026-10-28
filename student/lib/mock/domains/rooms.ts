import { toLocalDateTime, type MockAnswer, type MockQuestion } from '../simulation';

import { invitationsOf, join, studentView } from '../exam-rooms';
import { QUESTIONS_BY_STATEMENT, SimulationRow, closeSimulation, editableGuard, json, optionRefusal, ownedBy, problem, simulationResponse, simulationResult } from '../store';
import type { MockCtx } from '../store';

/** Rotas do domínio «rooms» do mock; devolve `undefined` quando o pedido não é deste domínio. */
export async function roomsRoutes({ method, pathname, search, filter, body, text, accountId, account, staff, db }: MockCtx): Promise<Response | undefined> {
  void [method, pathname, search, filter, body, text, accountId, account, staff, db];
  // ── salas de prova (FE-14) ─────────────────────────────────────────────────
  if (pathname === '/exam-rooms/mine' && method === 'GET') {
    return json(invitationsOf(
      account.id,
      db.rooms,
      db.participants,
      (id) => db.statements.find((s) => s.id === id)?.title ?? null,
      (id) => db.simulations.find((s) => s.id === id),
      toLocalDateTime(new Date()),
    ));
  }
  const roomMatch = /^\/exam-rooms\/(\d+)\/(join|student)$/.exec(pathname);
  if (roomMatch) {
    const roomId = Number(roomMatch[1]);
    const now = toLocalDateTime(new Date());
    if (roomMatch[2] === 'join' && method === 'POST') {
      const joined = join(roomId, account.id, db.rooms, db.participants, now, (room) => {
        const row: SimulationRow = {
          id: db.nextSimulation++, accountId: account.id, statementId: room.statementId, status: 'IN_PROGRESS',
          finalScore: null, startedAt: now, finishedAt: null, timeSpentSeconds: null, examRoomId: room.id,
        };
        db.simulations.push(row);
        return row.id;
      });
      return joined.ok ? json(joined.body) : problem(joined.problem.status, joined.problem.detail);
    }
    if (roomMatch[2] === 'student' && method === 'GET') {
      const view = studentView(roomId, account.id, db.rooms, db.participants, now, (statementId) =>
        (QUESTIONS_BY_STATEMENT[statementId] ?? [])
          .map((qid) => db.questions.find((q) => q.id === qid))
          .filter((q): q is MockQuestion => q !== undefined)
          // Sem gabarito: a vista do aluno nunca leva o `isCorrect`.
          .map((q) => ({ ...q, options: q.options.map(({ isCorrect: _hidden, ...o }) => o) })),
      );
      return view.ok ? json(view.body) : problem(view.problem.status, view.problem.detail);
    }
  }

  // ── a sala de prova ─────────────────────────────────────────────────────────

  const simulationMatch = /^\/simulations\/(\d+)(\/result)?$/.exec(pathname);
  if (simulationMatch && method === 'GET') {
    const id = Number(simulationMatch[1]);
    const row = db.simulations.find((s) => s.id === id && s.accountId === account.id);
    // Fora do dono é 404, não 403 (SimulationResultService.java:70-71): um aluno
    // não fica a saber de que lado está a tentativa de outra pessoa.
    if (!row) return problem(404, 'Simulation not found');
    if (simulationMatch[2]) {
      // SimulationResultService.java:83-90: o resultado só existe depois de FINISHED.
      // É este 409 que esconde o gabarito durante a prova.
      if (row.status !== 'FINISHED') {
        return problem(409, 'The result is only available once the simulation is finished');
      }
      return json(simulationResult(db, row));
    }
    return json(simulationResponse(db, row));
  }

  const submitMatch = /^\/simulations\/(\d+)\/submit$/.exec(pathname);
  if (submitMatch && method === 'POST') {
    const id = Number(submitMatch[1]);
    const row = db.simulations.find((s) => s.id === id && s.accountId === account.id);
    if (!row) return problem(404, 'Simulation not found');
    // SimulationSubmissionService.java:55-57: entregar duas vezes é 409.
    if (row.status !== 'IN_PROGRESS') {
      return problem(409, 'Simulation has already been submitted');
    }
    closeSimulation(db, row);
    return json(simulationResult(db, row));
  }

  if (pathname === '/simulation-answers' && method === 'GET') {
    return json(db.answers.filter((a) => ownedBy(db, a.simulationId, account.id)));
  }

  if (pathname === '/simulation-answers' && method === 'POST') {
    const simulationId = Number(body.simulationId);
    const questionId = Number(body.questionId);
    const guard = editableGuard(db, simulationId, account.id);
    if (guard) return guard;

    // SimulationAnswerService.java:95-99: um segundo POST da mesma pergunta é 409,
    // porque não há upsert. O cliente tem de guardar o id devolvido e usar PUT.
    if (db.answers.some((a) => a.simulationId === simulationId && a.questionId === questionId)) {
      return problem(409, 'This question has already been answered in this simulation.');
    }
    const refused = optionRefusal(db, questionId, body.selectedOptionId);
    if (refused) return refused;
    const answer: MockAnswer = {
      id: db.nextAnswer++,
      simulationId,
      questionId,
      selectedOptionId: Number(body.selectedOptionId) || null,
      answerText: body.answerText === null || body.answerText === undefined ? null : String(body.answerText),
      scoreObtained: null,
      isCorrect: null,
      reviewStatus: null,
      answeredAt: null,
    };
    db.answers.push(answer);
    return json(answer, 201);
  }

  const answerMatch = /^\/simulation-answers\/(\d+)$/.exec(pathname);
  if (answerMatch && method === 'PUT') {
    const existing = db.answers.find((a) => a.id === Number(answerMatch[1]));
    if (!existing || !ownedBy(db, existing.simulationId, account.id)) {
      return problem(404, 'Simulation answer not found');
    }
    const guard = editableGuard(db, existing.simulationId, account.id);
    if (guard) return guard;
    // O enunciado não pode mudar de pergunta a meio: o PUT reescreve a linha com o
    // questionId que vem no corpo, e a chave única (simulação, pergunta) barra-o.
    const refused = optionRefusal(db, existing.questionId, body.selectedOptionId);
    if (refused) return refused;
    existing.selectedOptionId = Number(body.selectedOptionId) || null;
    existing.answerText =
      body.answerText === null || body.answerText === undefined ? null : String(body.answerText);
    return json(existing);
  }

  return undefined;
}
