// Salas de Prova no mock, com as regras do `examrooms` do backend (BE-16/BE-17):
// ExamRoomService (criar, convidar, transições, entrar) e ExamRoomMonitoringService
// (progresso ao vivo e notas). Separado do backend.ts para ter testes: o mock que
// diverge do backend já custou duas rondas de revisão (#114, #117).
//
// O relógio é a hora de parede de Luanda, como o do backend (TZ=Africa/Luanda),
// e não o `now()` UTC do resto do mock.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Clock = () => string;

/** Hora de parede de Luanda, `YYYY-MM-DDTHH:mm:ss`. */
export const luandaClock: Clock = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 19);

type Problem = { status: number; detail: string };
export type Outcome<T> = { ok: true; status: number; body: T } | { ok: false; problem: Problem };

const ok = <T>(body: T, status = 200): Outcome<T> => ({ ok: true, status, body });
const no = (status: number, detail: string): Outcome<never> => ({ ok: false, problem: { status, detail } });

/** As partes do mock de que as salas precisam, injectadas para os testes. */
export interface RoomWorld {
  db: any;
  add: (table: string, row: any) => any;
  clock: Clock;
  /** `StatementWriteAccessService.checkCanWrite` para esta conta. */
  canWriteStatement: (statementId: number, accountId: number, admin: boolean) => boolean;
  isStudent: (accountId: number) => boolean;
}

const roomResponse = (r: any) => ({
  id: r.id,
  statementId: r.statementId,
  classId: r.classId,
  teacherAccountId: r.teacherAccountId,
  startsAt: r.startsAt,
  endsAt: r.endsAt,
  durationMinutes: r.durationMinutes,
  status: r.status,
});

const participantResponse = (p: any) => ({
  roomId: p.examRoomId,
  accountId: p.accountId,
  simulationId: p.simulationId ?? null,
  joinedAt: p.joinedAt ?? null,
});

const seconds = (a: string, b: string) =>
  Math.floor((Date.parse(`${b}Z`) - Date.parse(`${a}Z`)) / 1000);

export function examRooms(w: RoomWorld) {
  const { db } = w;
  db['exam-rooms'] ??= [];
  db['exam-room-participants'] ??= [];
  db['integrity-events'] ??= [];

  const room = (id: number) => db['exam-rooms'].find((r: any) => r.id === id);
  const managed = (id: number, caller: number, admin: boolean): Outcome<any> => {
    const r = room(id);
    return r && (admin || r.teacherAccountId === caller)
      ? ok(r)
      : no(403, 'Only the room owner or ADMIN can manage it');
  };
  const participantsOf = (id: number) => db['exam-room-participants'].filter((p: any) => p.examRoomId === id);
  const simulation = (id: number | null) => (id ? db.simulations.find((s: any) => s.id === id) : null);
  const questionCount = (statementId: number) =>
    (db.statements.find((s: any) => s.id === statementId)?.questions ?? []).filter((q: any) => !q.deletedAt).length;

  function create(b: any, caller: number, admin: boolean): Outcome<any> {
    for (const f of ['statementId', 'classId', 'startsAt', 'endsAt', 'durationMinutes']) {
      if (b[f] === undefined || b[f] === null || b[f] === '') return no(400, `${f} is required`);
    }
    if (!(Number(b.durationMinutes) > 0)) return no(400, 'durationMinutes must be positive');
    if (!(b.endsAt > b.startsAt)) return no(400, 'The exam room end must be after its start');
    const st = db.statements.find((s: any) => s.id === Number(b.statementId) && !s.deletedAt);
    if (!st) return no(404, 'Statement not found');
    if (!admin && st.classId == null) return no(403, 'A teacher may only create a room for an assigned class');
    if (st.classId != null && Number(b.classId) !== st.classId) return no(403, 'The room class must match the statement class');
    if (!w.canWriteStatement(st.id, caller, admin)) return no(403, 'Teacher is not assigned to this class and subject');
    if (!db.classes.find((c: any) => c.id === Number(b.classId) && !c.deletedAt)) return no(404, 'Class not found');
    const r = w.add('exam-rooms', {
      statementId: st.id,
      classId: Number(b.classId),
      teacherAccountId: caller,
      startsAt: String(b.startsAt),
      endsAt: String(b.endsAt),
      durationMinutes: Number(b.durationMinutes),
      status: 'DRAFT',
    });
    return ok(roomResponse(r), 201);
  }

  function addParticipant(id: number, b: any, caller: number, admin: boolean): Outcome<any> {
    const has = (v: unknown) => v !== undefined && v !== null;
    if (has(b.accountId) === has(b.classId)) return no(400, 'Account ID or class ID is required, not both');
    const m = managed(id, caller, admin);
    if (!m.ok) return m;
    const r = m.body;
    if (has(b.classId) && Number(b.classId) !== r.classId) return no(403, 'The invitation class must match the room class');
    const enrolled = db.enrollments
      .filter((e: any) => e.classId === r.classId && !e.deletedAt)
      .map((e: any) => e.accountId);
    const targets: number[] = has(b.accountId) ? [Number(b.accountId)] : enrolled;
    if (!targets.length) return no(400, 'The class has no active students');
    for (const accountId of targets) {
      if (!db.accounts.find((a: any) => a.id === accountId)) return no(404, 'Account not found');
      if (!w.isStudent(accountId)) return no(403, 'The invited account must be a STUDENT');
      if (!enrolled.includes(accountId)) return no(403, 'The student is not enrolled in this room class');
    }
    let last: any = null;
    for (const accountId of targets) {
      last =
        participantsOf(id).find((p: any) => p.accountId === accountId) ??
        w.add('exam-room-participants', { examRoomId: id, accountId, simulationId: null, joinedAt: null });
    }
    return ok(participantResponse(last));
  }

  function transition(id: number, caller: number, admin: boolean, next: string): Outcome<any> {
    const m = managed(id, caller, admin);
    if (!m.ok) return m;
    const r = m.body;
    const valid =
      (next === 'OPEN' && r.status === 'DRAFT') ||
      (next === 'RUNNING' && r.status === 'OPEN') ||
      (next === 'CLOSED' && (r.status === 'OPEN' || r.status === 'RUNNING'));
    if (!valid) return no(409, 'Invalid exam room state transition');
    const now = w.clock();
    if (next === 'OPEN' && !(now < r.endsAt)) return no(409, 'The exam room has ended');
    if (next === 'RUNNING' && (now < r.startsAt || !(now < r.endsAt))) {
      return no(409, 'The exam room is outside its active window');
    }
    if (next === 'CLOSED') {
      // finalizeRoom: quem ainda está a responder é submetido automaticamente.
      for (const p of participantsOf(id)) {
        const sim = simulation(p.simulationId);
        if (sim && sim.status === 'IN_PROGRESS') {
          sim.status = 'FINISHED';
          sim.finishedAt = now;
          sim.finalScore ??= 0;
        }
      }
    }
    r.status = next;
    return ok(roomResponse(r));
  }

  function join(id: number, accountId: number): Outcome<any> {
    const r = room(id);
    if (!r) return no(404, 'Exam room not found');
    const p = participantsOf(id).find((x: any) => x.accountId === accountId);
    if (!p) return no(403, 'The student is not invited to this room');
    const now = w.clock();
    if (r.status === 'CLOSED' || r.status === 'DRAFT') return no(409, 'The exam room is not open');
    if (!(now < r.endsAt)) return no(409, 'The exam room has ended');
    if (r.status === 'OPEN') {
      p.joinedAt ??= now;
      return ok(participantResponse(p));
    }
    if (now < r.startsAt) return no(409, 'The exam room has not started');
    if (!p.simulationId) {
      const sim = w.add('simulations', {
        accountId,
        statementId: r.statementId,
        examRoomId: r.id,
        schoolYearId: null,
        startedAt: now,
        finishedAt: null,
        timeSpentSeconds: 0,
        finalScore: null,
        status: 'IN_PROGRESS',
      });
      p.simulationId = sim.id;
    }
    p.joinedAt ??= now;
    return ok(participantResponse(p));
  }

  function live(id: number, caller: number, admin: boolean): Outcome<any> {
    const r = room(id);
    if (!r || !(admin || r.teacherAccountId === caller)) return no(403, 'Only the room owner or ADMIN can view it');
    const now = w.clock();
    const total = questionCount(r.statementId);
    const participants = participantsOf(id).map((p: any) => {
      const sim = simulation(p.simulationId);
      const answered = sim
        ? new Set(
            db['simulation-answers']
              .filter((a: any) => a.simulationId === sim.id && !a.deletedAt)
              .map((a: any) => a.questionId),
          ).size
        : 0;
      return {
        accountId: p.accountId,
        simulationId: p.simulationId ?? null,
        joinedAt: p.joinedAt ?? null,
        status: sim ? sim.status : 'NOT_STARTED',
        answeredQuestions: answered,
        totalQuestions: total,
      };
    });
    const joined = participants.filter((p: any) => p.joinedAt).length;
    const submitted = participants.filter((p: any) => p.status === 'FINISHED').length;
    return ok({
      roomId: r.id,
      status: r.status,
      serverTime: now,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      remainingSeconds: Math.max(0, seconds(now, r.endsAt)),
      totalParticipants: participants.length,
      joinedParticipants: joined,
      submittedParticipants: submitted,
      progressPercentage: participants.length ? Math.round((submitted / participants.length) * 1000) / 10 : 0,
      participants,
    });
  }

  /**
   * Os eventos do modo de avaliação (#192) de cada participante. Só o dono da sala
   * (ou o ADMIN) os lê — é o mesmo cuidado do `live` e do `grades`, porque o que
   * aqui está é comportamento de um aluno concreto.
   *
   * O aluno escreve os eventos no seu próprio processo e a base do gestor é outra;
   * no backend verdadeiro é o mesmo `POST /simulations/{id}/integrity-events` a
   * guardá-los, e é desta rota que o professor os lê.
   */
  function integrity(id: number, caller: number, admin: boolean): Outcome<any> {
    const r = room(id);
    if (!r || !(admin || r.teacherAccountId === caller)) return no(403, 'Only the room owner or ADMIN can view it');
    const events: any[] = db['integrity-events'];
    return ok({
      roomId: r.id,
      serverTime: w.clock(),
      participants: participantsOf(id).map((p: any) => ({
        accountId: p.accountId,
        simulationId: p.simulationId ?? null,
        events: p.simulationId
          ? events
              .filter((e: any) => e.simulationId === p.simulationId && !e.deletedAt)
              .sort((a: any, b: any) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
              .map((e: any) => ({ id: e.id, kind: e.kind, at: e.at, questionId: e.questionId ?? null }))
          : [],
      })),
    });
  }

  function grades(id: number, caller: number, admin: boolean): Outcome<any> {
    const r = room(id);
    if (!r || !(admin || r.teacherAccountId === caller)) return no(403, 'Only the room owner or ADMIN can view it');
    const total = questionCount(r.statementId);
    return ok(
      participantsOf(id).map((p: any) => {
        const sim = simulation(p.simulationId);
        const answers = sim ? db['simulation-answers'].filter((a: any) => a.simulationId === sim.id && !a.deletedAt) : [];
        return {
          accountId: p.accountId,
          simulationId: p.simulationId ?? null,
          status: sim?.status ?? null,
          finalScore: sim?.finalScore ?? null,
          correctAnswers: sim ? answers.filter((a: any) => a.isCorrect).length : null,
          totalQuestions: sim ? total : null,
          pendingReviewCount: sim ? answers.filter((a: any) => a.reviewStatus === 'PENDING').length : null,
          finishedAt: sim?.finishedAt ?? null,
        };
      }),
    );
  }

  return {
    create,
    addParticipant,
    transition,
    join,
    live,
    grades,
    integrity,
    owned: (caller: number) =>
      db['exam-rooms']
        .filter((r: any) => r.teacherAccountId === caller)
        .sort((a: any, b: any) => b.id - a.id)
        .map(roomResponse),
    mine: (accountId: number) =>
      db['exam-room-participants']
        .filter((p: any) => p.accountId === accountId)
        .sort((a: any, b: any) => b.id - a.id)
        .map(participantResponse),
  };
}

/** Uma resposta `text/event-stream` com um evento `progress` a cada `everyMs`,
 *  como o `/live` do backend, que acaba quando a sala fecha ou o cliente sai. */
export function liveStream(snapshot: () => Outcome<any>, everyMs = 2000): Response {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | null = null;
  let done = false;
  const stop = () => {
    done = true;
    if (timer) clearInterval(timer);
  };
  const stream = new ReadableStream({
    start(controller) {
      const push = () => {
        if (done) return;
        const s = snapshot();
        if (!s.ok) {
          stop();
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(`event:progress\ndata:${JSON.stringify(s.body)}\n\n`));
        if (s.body.status === 'CLOSED') {
          stop();
          controller.close();
        }
      };
      push();
      if (!done) timer = setInterval(push, everyMs);
    },
    cancel() {
      stop();
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}
