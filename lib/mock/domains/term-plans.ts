/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, json, problem } from '../store';
import type { MockContext } from './auth';

/** O plano do trimestre no mock (kixi#523): as mesmas regras do backend, em memória. O estado derivado vem do que está ligado. */
const plans: any[] = [];
let nextPlan = 1;
let nextAssessment = 1;

const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** A sala está ligada a uma avaliação de um plano do trimestre: a correção é da IA no fluxo, não do professor (kixi#542). */
export function isPlanRoom(roomId: number): boolean {
  return plans.some((p) => p.assessments.some((a: any) => a.roomId === roomId));
}

function status(a: any) {
  if (a.dispensedAt) return 'DISPENSED';
  if (a.roomId) {
    const room = db['exam-rooms']?.find((r: any) => r.id === a.roomId);
    return room?.status === 'CLOSED' ? 'GRADED' : 'ROOM_OPEN';
  }
  if (a.manualDone) return 'GRADED';
  return a.statementId ? 'STATEMENT_READY' : 'PLANNED';
}

function view(p: any) {
  const klass = db.classes.find((c: any) => c.id === p.classId);
  const subject = db.subjects.find((s: any) => s.id === p.subjectId);
  const term = db.terms.find((t: any) => t.id === p.termId);
  const assessments = p.assessments.map((a: any) => ({
    id: a.id, kind: a.kind, seq: a.seq, title: a.title, plannedDate: a.plannedDate, statementId: a.statementId ?? null, roomId: a.roomId ?? null,
    status: status(a), dispensedReason: a.dispensedReason ?? null, daysLeft: daysBetween(today(), a.plannedDate),
  }));
  return {
    id: p.id, classId: p.classId, className: klass?.code ?? String(p.classId), subjectId: p.subjectId, subjectName: subject?.name ?? String(p.subjectId),
    termId: p.termId, termNumber: term?.number ?? 1, institutionId: klass?.institutionId ?? null, approved: !!p.approvedAt, schedulingConcluded: !!p.concludedAt,
    readyForPauta: assessments.length > 0 && assessments.every((a: any) => a.status === 'GRADED' || a.status === 'DISPENSED'),
    pautaOpened: false, pautaRef: null, assessments,
  };
}

function viewer(auth: any) {
  const accountId = Number(auth?.sub);
  const roles = auth?.roles ?? [];
  const teacher = db.teachers.find((t: any) => t.accountId === accountId && !t.deletedAt);
  const pairs = db['teaching-assignments'].filter((a: any) => !a.deletedAt && a.teacherId === teacher?.id);
  return { accountId, admin: roles.includes('ADMIN'), coordinator: roles.includes('COORDINATOR'), teaches: (c: number, s: number) => pairs.some((a: any) => a.classId === c && a.subjectId === s) };
}

export async function termPlanRoutes({ method, path, auth, readBody }: MockContext): Promise<Response | undefined> {
  const m = path.match(/^\/api\/v1\/term-plans(?:\/(reminders|\d+)(?:\/(?:assessments\/(\d+)(?:\/(done|dispense|reschedule))?|(approve|conclude)))?)?$/);
  if (!m) return undefined;
  const who = viewer(auth);
  const can = (p: any) => who.admin || who.coordinator || who.teaches(p.classId, p.subjectId);
  const edit = (p: any) => who.admin || who.teaches(p.classId, p.subjectId);

  if (path === '/api/v1/term-plans' && method === 'GET') return json(200, plans.filter(can).map(view));
  if (path === '/api/v1/term-plans/reminders' && method === 'GET') {
    const out: any[] = [];
    for (const p of plans.filter((x) => edit(x))) for (const a of view(p).assessments) {
      const action = a.status === 'PLANNED' ? 'BUILD_STATEMENT' : a.status === 'STATEMENT_READY' ? 'OPEN_ROOM' : null;
      const level = a.daysLeft < 0 ? 'LATE' : a.daysLeft <= 2 ? 'D2' : a.daysLeft <= 7 ? 'D7' : a.daysLeft <= 14 ? 'D14' : null;
      if (action && level) out.push({ planId: p.id, assessmentId: a.id, kind: a.kind, title: a.title, plannedDate: a.plannedDate, daysLeft: a.daysLeft, action, level, className: view(p).className, subjectName: view(p).subjectName });
    }
    return json(200, out);
  }
  if (path === '/api/v1/term-plans' && method === 'POST') {
    const b = readBody();
    if (!who.admin && !who.teaches(b.classId, b.subjectId)) return problem(403, 'Only the teacher of this class and subject plans its term');
    if (plans.some((p) => p.classId === b.classId && p.subjectId === b.subjectId && p.termId === b.termId)) return problem(409, 'There is already a plan for this class, subject and term');
    const mac = Number(b.macCount ?? 0);
    const plan = { id: nextPlan++, classId: b.classId, subjectId: b.subjectId, termId: b.termId, approvedAt: null, assessments: [
      { id: nextAssessment++, kind: 'P1', seq: 1, title: 'P1', plannedDate: b.p1Date },
      { id: nextAssessment++, kind: 'P2', seq: 1, title: 'P2', plannedDate: b.p2Date },
      ...Array.from({ length: mac }, (_, i) => ({ id: nextAssessment++, kind: 'MAC', seq: i + 1, title: b.macTitles?.[i] || `MAC ${i + 1}`, plannedDate: b.macDates?.[i] })),
    ] };
    plans.push(plan);
    return json(201, view(plan));
  }
  const id = m[1] && m[1] !== 'reminders' ? Number(m[1]) : null;
  const plan = plans.find((p) => p.id === id);
  if (!plan) return problem(404, 'Term plan not found');
  if (!can(plan)) return problem(403, 'Not allowed to read this term plan');
  const assessment = m[2] ? plan.assessments.find((a: any) => a.id === Number(m[2])) : null;
  if (method === 'GET' && !m[2] && !m[4]) return json(200, view(plan));
  if (m[4] === 'conclude' && method === 'POST') {
    if (!plan.assessments.some((a: any) => a.kind === 'P1' && a.statementId) || !plan.assessments.some((a: any) => a.kind === 'P2' && a.statementId)) {
      return problem(409, 'P1 and P2 need a statement before the scheduling is concluded');
    }
    plan.concludedAt = plan.concludedAt ?? new Date().toISOString();
    return json(200, view(plan));
  }
  if (m[4] && method === 'POST') {
    if (!who.admin && !who.coordinator) return problem(403, 'Only the coordinator of the institution approves or dispenses');
    plan.approvedAt = new Date().toISOString();
    return json(200, view(plan));
  }
  if (assessment && m[3] === 'reschedule' && method === 'POST') {
    if (!who.admin && !who.coordinator) return problem(403, 'Only the coordinator of the institution approves or dispenses');
    const b = readBody();
    if (assessment.kind === 'MAC') return problem(400, 'Only P1 and P2 can be rescheduled');
    if (!String(b.reason ?? '').trim()) return problem(400, 'A reason is required to reschedule an assessment');
    Object.assign(assessment, { plannedDate: b.date, statementId: null, roomId: null, manualDone: false, dispensedAt: null, dispensedReason: null });
    return json(200, view(plan));
  }
  if (assessment && m[3] === 'dispense' && method === 'POST') {
    if (!who.admin && !who.coordinator) return problem(403, 'Only the coordinator of the institution approves or dispenses');
    if (assessment.kind !== 'MAC') return problem(409, 'P1 and P2 cannot be dispensed: reschedule them');
    const reason = String(readBody().reason ?? '').trim();
    if (!reason) return problem(400, 'A reason is required to dispense an assessment');
    assessment.dispensedAt = new Date().toISOString();
    assessment.dispensedReason = reason;
    return json(200, view(plan));
  }
  if (!edit(plan)) return problem(403, 'Only the teacher of this class and subject edits its plan');
  if (assessment && m[3] === 'done' && method === 'POST') {
    if (assessment.kind !== 'MAC' || assessment.roomId) return problem(400, 'Only a MAC assessment with no room can be marked done');
    assessment.manualDone = true;
    return json(200, view(plan));
  }
  if (assessment && !m[3] && method === 'PATCH') {
    const b = readBody();
    if (b.roomId) assessment.roomId = b.roomId;
    if (b.statementId) assessment.statementId = b.statementId;
    return json(200, view(plan));
  }
  return problem(405, 'Method Not Allowed');
}
