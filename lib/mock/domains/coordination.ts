/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, json, problem } from '../store';
import type { MockContext } from './auth';

/** As salas da instituição para o coordenador (kixi#529) no mock: leitura, com os dados das salas e simulações que o mock já tem. */
export async function coordinationRoutes({ method, path }: MockContext): Promise<Response | undefined> {
  const m = path.match(/^\/api\/v1\/coordination\/exam-rooms(?:\/(\d+)\/grades)?$/);
  if (!m) return undefined;
  if (method !== 'GET') return problem(405, 'Method Not Allowed');
  const rooms = (db['exam-rooms'] ?? []).filter((r: any) => !r.deletedAt);
  const sims = (db.simulations ?? []).filter((s: any) => !s.deletedAt);
  const answers = (db['simulation-answers'] ?? []).filter((a: any) => !a.deletedAt);
  const pending = (simId: number) => answers.filter((a: any) => a.simulationId === simId && a.reviewStatus === 'PENDING_REVIEW').length;
  const nameOf = (accountId: number) => {
    const u = db.users.find((x: any) => x.accountId === accountId);
    return u ? `${u.firstName} ${u.lastName}`.trim() : null;
  };
  if (!m[1]) {
    return json(200, rooms.map((r: any) => {
      const roomSims = sims.filter((s: any) => s.examRoomId === r.id);
      const statement = db.statements?.find((s: any) => s.id === r.statementId);
      const klass = db.classes.find((c: any) => c.id === r.classId);
      return {
        id: r.id, status: r.status, startsAt: r.startsAt, endsAt: r.endsAt, className: klass?.code ?? String(r.classId),
        statementTitle: statement?.title ?? `Enunciado ${r.statementId}`, teacherAccountId: r.teacherAccountId, teacherName: nameOf(r.teacherAccountId),
        participants: (r.participants ?? roomSims).length, finished: roomSims.filter((s: any) => s.status === 'FINISHED').length,
        pendingAnswers: roomSims.reduce((n: number, s: any) => n + pending(s.id), 0),
      };
    }));
  }
  const room = rooms.find((r: any) => r.id === Number(m[1]));
  if (!room) return problem(403, 'This room is not in your institution');
  return json(200, sims.filter((s: any) => s.examRoomId === room.id).map((s: any) => ({
    accountId: s.accountId, name: nameOf(s.accountId), status: s.status, finalScore: s.finalScore ?? null, pendingAnswers: pending(s.id),
  })));
}
