/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, json, problem } from '../store';
import type { MockContext } from './auth';
import { mockTermSheets } from './term-sheets';

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
    pautaOpened: !!p.pautaRef, pautaRef: p.pautaRef ?? null, assessments,
  };
}

/**
 * Cada pauta semeada (domains/term-sheets) tem o plano do trimestre que a abriu no motor, com o `pautaRef` igual ao id da
 * pauta: é por ele que o gestor exporta o PDF (kixi#622, kixi-frontend#808). As provas já foram corrigidas; a 2.ª MAC ficou
 * sem enunciado, e por isso sem resultado para exportar.
 */
let seeded = false;
function seedSheetPlans() {
  if (seeded) return;
  seeded = true;
  const statementId = db.statements[0]?.id ?? null;
  for (const sheet of mockTermSheets()) {
    const termId = db.terms.find((t: any) => t.number === sheet.termNumber)?.id;
    if (!termId) continue;
    const day = String(sheet.updatedAt).slice(0, 10);
    const done = (kind: string, seq: number, title: string, withStatement = true) =>
      ({ id: nextAssessment++, kind, seq, title, plannedDate: day, statementId: withStatement ? statementId : null, manualDone: true });
    plans.push({
      id: nextPlan++, classId: sheet.classId, subjectId: sheet.subjectId, termId, approvedAt: day, concludedAt: day,
      pautaRef: sheet.sheetId, sheetStatus: sheet.status,
      assessments: [done('P1', 1, 'P1'), done('P2', 1, 'P2'), done('MAC', 1, 'MAC 1'), done('MAC', 2, 'MAC 2', false)],
    });
  }
}

/** Um PDF mínimo, mas válido, com o nome do documento: o mock não tem motor que o gere. */
function pdf(name: string) {
  const text = `Kixi (mock) - ${name}`.replace(/[()\\]/g, '');
  const content = `BT /F1 14 Tf 72 770 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => { offsets.push(body.length); body += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store', 'Content-Disposition': `inline; filename="${name}.pdf"` },
  });
}

function viewer(auth: any) {
  const accountId = Number(auth?.sub);
  const roles = auth?.roles ?? [];
  const teacher = db.teachers.find((t: any) => t.accountId === accountId && !t.deletedAt);
  const pairs = db['teaching-assignments'].filter((a: any) => !a.deletedAt && a.teacherId === teacher?.id);
  return { accountId, admin: roles.includes('ADMIN'), coordinator: roles.includes('COORDINATOR'), teaches: (c: number, s: number) => pairs.some((a: any) => a.classId === c && a.subjectId === s) };
}

export async function termPlanRoutes({ method, path, url, auth, readBody }: MockContext): Promise<Response | undefined> {
  // A exportação em PDF (kixi#622): as mesmas respostas do backend, com o motor fingido aqui.
  const report = path.match(/^\/api\/v1\/term-plans\/(\d+)\/(?:reports\/(mini-pauta|class)|assessments\/(\d+)\/reports\/result)$/);
  if (report) {
    if (method !== 'GET') return problem(405, 'Method Not Allowed');
    seedSheetPlans();
    const who = viewer(auth);
    const plan = plans.find((p) => p.id === Number(report[1]));
    if (!plan) return problem(404, 'Term plan not found');
    if (!(who.admin || who.coordinator || who.teaches(plan.classId, plan.subjectId))) return problem(403, 'Not allowed to read this term plan');
    if (!plan.pautaRef) return problem(409, 'This plan has no pauta at the motor yet.');
    // A pauta da turma sai do registo escolar, não da pauta da disciplina: kixi#627.
    if (report[2] === 'class') return pdf(`pauta-turma-${plan.id}`);
    if (report[3]) {
      const assessment = plan.assessments.find((a: any) => a.id === Number(report[3]));
      if (!assessment) return problem(404, 'Assessment not found in this plan');
      if (!assessment.statementId) return problem(409, 'This assessment has no statement yet, so there is no result to export.');
      return pdf(`resultado-${plan.id}-${assessment.id}`);
    }
    // Uma pauta registada ainda não foi homologada: o motor não tem o PDF dela.
    if (plan.sheetStatus === 'REGISTADA') return problem(409, 'The motor has no PDF for this report yet. Export it again after the pauta is homologated.');
    return pdf(`mini-pauta-${plan.id}`);
  }
  const m = path.match(/^\/api\/v1\/term-plans(?:\/(reminders|\d+)(?:\/(?:assessments\/(\d+)(?:\/(done|dispense|reschedule))?|(approve|conclude)))?)?$/);
  if (!m) return undefined;
  const who = viewer(auth);
  const can = (p: any) => who.admin || who.coordinator || who.teaches(p.classId, p.subjectId);
  const edit = (p: any) => who.admin || who.teaches(p.classId, p.subjectId);

  seedSheetPlans();
  if (path === '/api/v1/term-plans' && method === 'GET') {
    const num = (k: string) => (url?.searchParams.get(k) ? Number(url.searchParams.get(k)) : null);
    const [classId, subjectId, termId] = [num('classId'), num('subjectId'), num('termId')];
    return json(200, plans
      .filter((p) => can(p) && (classId === null || p.classId === classId) && (subjectId === null || p.subjectId === subjectId) && (termId === null || p.termId === termId))
      .map(view));
  }
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
    // Uma avaliação de MAC é uma prova como a P1 e a P2 (kixi#623/schoolops#65): sem enunciado só se for dispensada.
    if (plan.assessments.some((a: any) => a.kind === 'MAC' && status(a) !== 'DISPENSED' && !a.statementId)) {
      return problem(409, 'Every MAC assessment needs a statement (or must be dispensed) before the scheduling is concluded');
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
    // Sem enunciado explícito, a sala traz o seu (TermPlanService.link, no backend real): ligar uma sala já liga o enunciado.
    const room = b.roomId ? db['exam-rooms']?.find((r: any) => r.id === b.roomId) : null;
    if (b.statementId) assessment.statementId = b.statementId;
    else if (room?.statementId) assessment.statementId = room.statementId;
    return json(200, view(plan));
  }
  return problem(405, 'Method Not Allowed');
}
