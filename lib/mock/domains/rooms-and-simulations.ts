/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
 
import { liveStream } from '../exam-rooms';
import { add, analytics, db, json, mapSimulation, now, problem, rooms } from '../store';
import type { MockContext } from './auth';

/** Rotas do domínio «rooms-and-simulations» do mock; devolve `undefined` quando o pedido não é deste domínio. */
export async function roomAndSimulationRoutes({ method, path, url, auth, isStaff, readBody, loginResponse, isAdmin, activeInst, writeWorld, denyWrite }: MockContext): Promise<Response | undefined> {
  let m: RegExpMatchArray | null = null;
  void [m, url, auth, isStaff, readBody, loginResponse, isAdmin, activeInst, writeWorld, denyWrite];
  // ── exam rooms (BE-16/BE-17) ──
  if ((m = path.match(/^\/api\/(?:v1\/)?exam-rooms(?:\/(mine|owned|\d+))?(?:\/(participants|open|start|close|join|live|grades|integrity))?$/))) {
    const me = Number(auth.sub);
    const roles = auth.roles ?? [];
    const admin = roles.includes('ADMIN');
    const staff = admin || roles.includes('TEACHER');
    const out = (o) => (o.ok ? json(o.status, o.body) : problem(o.problem.status, o.problem.detail));
    const [, target, action] = m;
    const id = Number(target);
    if (!target && !action && method === 'POST') {
      return staff ? out(rooms.create(readBody(), me, admin)) : problem(403, 'Only teachers or ADMIN can create exam rooms');
    }
    if (target === 'owned' && method === 'GET') return json(200, staff ? rooms.owned(me) : []);
    if (target === 'mine' && method === 'GET') return json(200, rooms.mine(me));
    if (Number.isFinite(id) && method === 'POST') {
      if (action === 'join') return out(rooms.join(id, me));
      if (!staff) return problem(403, 'Only teachers or ADMIN can manage exam rooms');
      if (action === 'participants') return out(rooms.addParticipant(id, readBody(), me, admin));
      const next = { open: 'OPEN', start: 'RUNNING', close: 'CLOSED' }[action];
      if (next) return out(rooms.transition(id, me, admin, next));
    }
    if (Number.isFinite(id) && method === 'GET' && staff) {
      if (action === 'grades') return out(rooms.grades(id, me, admin));
      if (action === 'integrity') return out(rooms.integrity(id, me, admin));
      if (action === 'live') {
        const first = rooms.live(id, me, admin);
        return first.ok ? liveStream(() => rooms.live(id, me, admin)) : out(first);
      }
    }
    if (Number.isFinite(id) && method === 'GET' && !staff) return problem(403, 'Only teachers or ADMIN can view exam room progress');
    return problem(405, 'Method not allowed');
  }

  // ── simulations (note: /api/simulations, restore is PUT, purge is /permanent) ──
  if ((m = path.match(/^\/api\/simulations(?:\/(trash|\d+)(?:\/(restore|permanent))?)?$/))) {
    const t = m[1];
    const list = (del) => db.simulations.filter((s) => (del ? s.deletedAt : !s.deletedAt) && (isStaff || s.accountId === Number(auth.sub))).map(mapSimulation);
    if (!t && method === 'GET') return json(200, list(false));
    if (t === 'trash' && method === 'GET') return json(200, list(true));
    if (!t && method === 'POST') {
      const b = readBody();
      const r = add('simulations', { accountId: b.accountId ?? Number(auth.sub), statementId: b.statementId, schoolYearId: b.schoolYearId ?? null, startedAt: b.startedAt ?? now(), finishedAt: b.finishedAt ?? null, timeSpentSeconds: b.timeSpentSeconds ?? 0, finalScore: b.finalScore ?? null, status: b.status ?? 'IN_PROGRESS' });
      return json(201, mapSimulation(r));
    }
    const sim = db.simulations.find((x) => x.id === Number(t));
    if (!sim) return problem(404, 'Simulation not found');
    if (!m[2] && method === 'GET') return json(200, mapSimulation(sim));
    if (!m[2] && method === 'DELETE') { sim.deletedAt = now(); return json(204); }
    if (m[2] === 'restore' && method === 'PUT') { sim.deletedAt = null; return json(204); }
    if (m[2] === 'permanent' && method === 'DELETE') { db.simulations = db.simulations.filter((x) => x !== sim); return json(204); }
  }

  if (path.startsWith('/api/v1/analytics') && method === 'GET') { const a = analytics(path, url, auth); if (a) return a; }

  return undefined;
}
