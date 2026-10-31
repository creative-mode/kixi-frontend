'use server';

// O plano do trimestre do professor (kixi#523), sobre `/api/v1/term-plans`. As regras de apresentação estão em `lib/term-plans.ts`.

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth.server';
import { call, fail, guard, message, ok, type Result } from '@/lib/crud/http';
import { ENTITIES, type Row } from '@/lib/crud/entities';
import { draftProblem } from '@/lib/term-plans';
import type { PlanDraft, Reminder, TermPlan } from '@/types/term-plans';

const BASE = '/api/v1/term-plans';

const safeId = (id: number) => {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Identificador inválido.');
  return id;
};

async function json<T>(path: string, init: RequestInit = {}): Promise<Result<T>> {
  const res = await call(path, init);
  if (!res.ok) return fail(await message(res));
  return ok((await res.json()) as T);
}

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export type PlanPair = { classId: number; subjectId: number; label: string };
export type RoomChoice = { id: number; classId: number | null; label: string };
export type PlanContext = {
  plans: TermPlan[];
  reminders: Reminder[];
  pairs: PlanPair[];
  terms: { id: number; label: string }[];
  rooms: RoomChoice[];
  canPlan: boolean;
  canDecide: boolean;
};

/** Tudo o que o ecrã precisa: planos e lembretes visíveis, as turmas e disciplinas que o professor leciona e as suas salas. */
export async function planContext(): Promise<Result<PlanContext>> {
  return guard(async () => {
    const user = await getCurrentUser();
    const roles = user?.roles ?? [];
    const admin = roles.includes('ADMIN');
    const teacher = roles.includes('TEACHER');
    const [plans, reminders] = await Promise.all([json<TermPlan[]>(BASE), json<Reminder[]>(`${BASE}/reminders`)]);
    if (!plans.ok) return plans;
    const [terms, assignments, classes, subjects, rooms, statements] = await Promise.all([
      json<Row[]>(ENTITIES.terms.api),
      teacher ? json<Row[]>('/api/v1/teaching-assignments/me') : Promise.resolve(ok<Row[]>([])),
      json<Row[]>(ENTITIES.classes.api),
      json<Row[]>(ENTITIES.subjects.api),
      teacher || admin ? json<Row[]>('/api/v1/exam-rooms/owned') : Promise.resolve(ok<Row[]>([])),
      teacher || admin ? json<Row[]>('/api/v1/statements') : Promise.resolve(ok<Row[]>([])),
    ]);
    const className = new Map((classes.ok ? classes.data : []).map((c) => [Number(c.id), ENTITIES.classes.titleOf(c)]));
    const subjectName = new Map((subjects.ok ? subjects.data : []).map((s) => [Number(s.id), String(s.name ?? s.code ?? s.id)]));
    const statementTitle = new Map((statements.ok ? statements.data : []).map((s) => [Number(s.id), String(s.title ?? `Enunciado ${s.id}`)]));
    return ok({
      plans: plans.data,
      reminders: reminders.ok ? reminders.data : [],
      pairs: (assignments.ok ? assignments.data : []).map((a) => ({
        classId: Number(a.classId), subjectId: Number(a.subjectId),
        label: `${className.get(Number(a.classId)) ?? `Turma ${a.classId}`} · ${subjectName.get(Number(a.subjectId)) ?? `Disciplina ${a.subjectId}`}`,
      })),
      terms: (terms.ok ? terms.data : []).map((t) => ({ id: Number(t.id), label: String(t.name ?? `${t.number}.º trimestre`) })),
      rooms: (rooms.ok ? rooms.data : []).map((r) => ({
        id: Number(r.id), classId: r.classId == null ? null : Number(r.classId),
        label: `Sala ${r.id} · ${statementTitle.get(Number(r.statementId)) ?? `Enunciado ${r.statementId}`}`,
      })),
      canPlan: teacher,
      canDecide: admin || (user?.roles ?? []).includes('COORDINATOR'),
    });
  });
}

export async function createPlan(draft: PlanDraft): Promise<Result<TermPlan>> {
  const problem = draftProblem(draft);
  if (problem) return fail(problem);
  return guard(async () => {
    const result = await json<TermPlan>(BASE, send('POST', {
      classId: draft.classId, subjectId: draft.subjectId, termId: draft.termId, p1Date: draft.p1Date, p2Date: draft.p2Date,
      macCount: draft.macCount, macDates: draft.macDates, macTitles: draft.macTitles,
    }));
    revalidatePath('/planos');
    return result;
  });
}

async function act(path: string, init: RequestInit): Promise<Result<TermPlan>> {
  return guard(async () => {
    const result = await json<TermPlan>(path, init);
    revalidatePath('/planos');
    return result;
  });
}

export async function linkRoom(planId: number, assessmentId: number, roomId: number): Promise<Result<TermPlan>> {
  return act(`${BASE}/${safeId(planId)}/assessments/${safeId(assessmentId)}`, send('PATCH', { roomId: safeId(roomId) }));
}

export async function markDone(planId: number, assessmentId: number): Promise<Result<TermPlan>> {
  return act(`${BASE}/${safeId(planId)}/assessments/${safeId(assessmentId)}/done`, send('POST'));
}

export async function dispense(planId: number, assessmentId: number, reason: string): Promise<Result<TermPlan>> {
  if (!reason.trim()) return fail('Diga o motivo da dispensa.');
  return act(`${BASE}/${safeId(planId)}/assessments/${safeId(assessmentId)}/dispense`, send('POST', { reason: reason.trim() }));
}

export async function approvePlan(planId: number): Promise<Result<TermPlan>> {
  return act(`${BASE}/${safeId(planId)}/approve`, send('POST'));
}
