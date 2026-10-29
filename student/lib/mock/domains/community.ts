import { integrityRefusal, isIntegrityKind, parseQuestionId } from '@/lib/integrity';
import { expired, toLocalDateTime } from '../simulation';

import { QUESTIONS_BY_STATEMENT, SimulationRow, json, problem, simulationResponse, validationError } from '../store';
import type { MockCtx } from '../store';

/** Rotas do domínio «community» do mock; devolve `undefined` quando o pedido não é deste domínio. */
export async function communityRoutes({ method, pathname, search, filter, body, text, accountId, account, staff, db }: MockCtx): Promise<Response | undefined> {
  void [method, pathname, search, filter, body, text, accountId, account, staff, db];
  // ── comunidade e partilha de resoluções (#119/#32) ──────────────────────────
  const community = pathname.match(/^\/statements\/(\d+)\/community$/);
  if (community && method === 'GET') {
    const statementId = Number(community[1]);
    const finished = db.simulations.filter((s) => s.statementId === statementId && s.status === 'FINISHED');
    const mine = finished.find((s) => s.accountId === account.id) ?? null;
    const scores = finished.map((s) => s.finalScore).filter((v): v is number => v != null);
    const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    return json({
      statementId,
      sampleSize: scores.length,
      meanScore: mean,
      medianScore: mean,
      scoreDistribution: scores.length
        ? [
            { index: 0, from: 0, to: 10, count: scores.filter((s) => s < 10).length },
            { index: 1, from: 10, to: 15, count: scores.filter((s) => s >= 10 && s < 15).length },
            { index: 2, from: 15, to: null, count: scores.filter((s) => s >= 15).length },
          ]
        : [],
      questions: [],
      avgTimeSpentSeconds: null,
      timeSampleSize: 0,
      mine: mine ? { simulationId: mine.id, finalScore: mine.finalScore } : null,
    });
  }

  const solutionsMatch = pathname.match(/^\/statements\/(\d+)\/community\/solutions$/);
  if (solutionsMatch && method === 'GET') {
    const statementId = Number(solutionsMatch[1]);
    const institutionId = filter('institutionId');
    const shares = db.solutionShares.filter((sh) => {
      const sim = db.simulations.find((s) => s.id === sh.simulationId);
      if (!sim || sim.statementId !== statementId) return false;
      if (institutionId === undefined) return true;
      return db.institutionByAccount[sim.accountId] === institutionId;
    });
    return json({
      content: shares.map((sh) => {
        const sim = db.simulations.find((s) => s.id === sh.simulationId);
        const schoolId = sim ? db.institutionByAccount[sim.accountId] : undefined;
        const school = schoolId ? db.institutions.find((i) => i.id === schoolId) : undefined;
        return {
          shareId: sh.id,
          institution: !sh.anonymous && school ? { id: school.id, code: school.code } : null,
          authorName: sh.anonymous ? null : sh.displayName,
          finalScore: sim?.finalScore ?? null,
          timeSpentSeconds: sim?.timeSpentSeconds ?? null,
          answers: [],
        };
      }),
      page: 0, size: shares.length, totalElements: shares.length, totalPages: 1,
    });
  }

  const shareMatch = pathname.match(/^\/simulations\/(\d+)\/share$/);
  if (shareMatch && method === 'POST') {
    const simulationId = Number(shareMatch[1]);
    const sim = db.simulations.find((s) => s.id === simulationId && s.accountId === account.id);
    if (!sim) return problem(404, 'Simulation not found');
    if (sim.status !== 'FINISHED') return problem(409, 'Only a finished simulation can be shared');
    const anonymous = body.anonymous !== false;
    const displayName = text('displayName') || null;
    db.solutionShares = db.solutionShares.filter((sh) => sh.simulationId !== simulationId);
    const share = { id: db.nextShare++, simulationId, anonymous, displayName, consentAt: toLocalDateTime(new Date()) };
    db.solutionShares.push(share);
    return json(
      { shareId: share.id, simulationId, anonymous, displayName, consentAt: share.consentAt },
      201,
    );
  }
  if (shareMatch && method === 'DELETE') {
    const simulationId = Number(shareMatch[1]);
    const sim = db.simulations.find((s) => s.id === simulationId && s.accountId === account.id);
    if (!sim) return problem(404, 'Simulation not found');
    db.solutionShares = db.solutionShares.filter((sh) => sh.simulationId !== simulationId);
    return new Response(null, { status: 204 });
  }

  if (pathname === '/simulations' && method === 'GET') {
    const mine = db.simulations.filter((s) => s.accountId === account.id);
    return json(mine.map((s) => simulationResponse(db, s)));
  }

  if (pathname === '/simulations' && method === 'POST') {
    const target = Number(body.accountId);
    const statementId = Number(body.statementId);
    // SimulationService.java:103-105: o accountId tem de ser o da conta
    // autenticada. Sem esta verificação o mock aceitaria criar em nome de outro.
    if (!staff && target !== account.id) {
      return problem(403, 'A simulation can only be created for the authenticated account');
    }
    const statement = db.statements.find((s) => s.id === statementId);
    // Um aluno só começa uma prova que pode ler: publicada, senão 404 como no /full.
    if (!statement || (!staff && !statement.visible)) return problem(404, 'Statement not found');

    const row: SimulationRow = {
      id: db.nextSimulation++,
      accountId: target,
      statementId,
      // O relógio começa no servidor (SimulationService.java:95); o que o cliente
      // mande em startedAt ou status é ignorado, tal como no backend.
      status: 'IN_PROGRESS',
      finalScore: null,
      startedAt: toLocalDateTime(new Date()),
      finishedAt: null,
      timeSpentSeconds: null,
    };
    db.simulations.push(row);
    return json(simulationResponse(db, row), 201);
  }

  // O modo de avaliação (#192) a registar um evento. O corpo leva o tipo e, na
  // colagem, a questão — nunca texto de resposta. A hora é do servidor: um cliente
  // não carimba os seus próprios eventos.
  //
  // As regras são as do `SimulationIntegrityEventService` do backend e vivem em
  // `integrityRefusal`, para não divergirem: `PASTE_BLOCKED` exige uma questão (e só
  // esse tipo a leva), a questão tem de ser desta prova, e a tentativa tem de estar a
  // decorrer. O backend fecha por `IN_PROGRESS`; aqui fecha-se também pelo prazo,
  // porque o mock não tem um scheduler que mude o estado quando o tempo acaba.
  const integrityMatch = pathname.match(/^\/simulations\/(\d+)\/integrity-events$/);
  if (integrityMatch && method === 'POST') {
    const simulationId = Number(integrityMatch[1]);
    if (!isIntegrityKind(body.kind)) return validationError({ kind: 'Evento de integridade desconhecido' });
    const kind = body.kind;
    // `0`, `-1`, `1.5` ou `"abc"` não são "sem questão": o backend recusa-os com 400
    // na desserialização. Passá-los a `null` deixaria um `TAB_HIDDEN` inválido entrar.
    const questionId = parseQuestionId(body.questionId);
    if (questionId === undefined) {
      return validationError({ questionId: 'questionId tem de ser um inteiro positivo' });
    }
    const simulation = db.simulations.find((s) => s.id === simulationId && s.accountId === account.id);
    const refusal = integrityRefusal({
      kind,
      questionId,
      attempt: simulation
        ? {
            active: simulation.status === 'IN_PROGRESS',
            expired: expired(simulationResponse(db, simulation).deadline),
            questionBelongs:
              questionId === null
                ? null
                : (QUESTIONS_BY_STATEMENT[simulation.statementId] ?? []).includes(questionId),
          }
        : null,
    });
    if (refusal) {
      return refusal.status === 400
        ? validationError({ questionId: refusal.message })
        : problem(refusal.status, refusal.message);
    }

    const event = {
      id: db.nextIntegrityEvent++,
      simulationId,
      kind,
      questionId,
      at: toLocalDateTime(new Date()),
    };
    db.integrityEvents.push(event);
    return json(event, 201);
  }

  return undefined;
}
