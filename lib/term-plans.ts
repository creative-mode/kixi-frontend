import type { Assessment, AssessmentStatus, PlanDraft, Reminder, ReminderLevel, TermPlan } from '@/types/term-plans';

/** Regras de apresentação do plano do trimestre, sem React: ficam testáveis com `node --test`. */

export const STATUS_LABEL: Record<AssessmentStatus, string> = {
  PLANNED: 'Planeada',
  STATEMENT_READY: 'Enunciado pronto',
  ROOM_OPEN: 'Sala aberta',
  DONE: 'Realizada, por corrigir',
  GRADED: 'Corrigida',
  DISPENSED: 'Dispensada',
};

export const KIND_LABEL = { P1: 'P1', P2: 'P2', MAC: 'MAC' } as const;

export const LEVEL_LABEL: Record<ReminderLevel, string> = {
  LATE: 'Em atraso',
  D2: 'Em 2 dias ou menos',
  D7: 'Esta semana',
  D14: 'Nas próximas duas semanas',
};

export const planTitle = (plan: Pick<TermPlan, 'className' | 'subjectName' | 'termNumber'>): string =>
  `${plan.className} · ${plan.subjectName} · ${plan.termNumber}.º trimestre`;

/** Uma avaliação fechada já não pede nada ao professor: está corrigida ou dispensada. */
export const isCleared = (a: Pick<Assessment, 'status'>): boolean => a.status === 'GRADED' || a.status === 'DISPENSED';

export function progress(plan: Pick<TermPlan, 'assessments'>): { done: number; total: number } {
  return { done: plan.assessments.filter(isCleared).length, total: plan.assessments.length };
}

/** «dd/mm/aaaa» sem passar por fusos horários: a data do backend é uma data civil. */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function daysText(daysLeft: number): string {
  if (daysLeft < 0) return `há ${-daysLeft} ${-daysLeft === 1 ? 'dia' : 'dias'}`;
  if (daysLeft === 0) return 'hoje';
  if (daysLeft === 1) return 'amanhã';
  return `em ${daysLeft} dias`;
}

export function reminderText(r: Pick<Reminder, 'action' | 'kind' | 'title' | 'plannedDate' | 'daysLeft' | 'className' | 'subjectName'>): string {
  const what = r.action === 'BUILD_STATEMENT' ? 'Montar o enunciado' : 'Abrir a sala';
  return `${what} de ${r.title} (${r.className} · ${r.subjectName}), ${formatDate(r.plannedDate)}, ${daysText(r.daysLeft)}.`;
}

export const MAX_MAC = 10;

/** O que impede de enviar o plano (a mensagem é para o professor), ou `null` se está bem. */
export function draftProblem(d: PlanDraft): string | null {
  if (!d.classId || !d.subjectId) return 'Escolha a turma e a disciplina.';
  if (!d.termId) return 'Escolha o trimestre.';
  if (!d.p1Date || !d.p2Date) return 'Defina as datas da P1 e da P2.';
  if (d.p2Date < d.p1Date) return 'A P2 não pode ser antes da P1.';
  if (!Number.isInteger(d.macCount) || d.macCount < 0 || d.macCount > MAX_MAC) return `O número de avaliações de MAC vai de 0 a ${MAX_MAC}.`;
  if (d.macDates.length !== d.macCount || d.macDates.some((x) => !x)) return 'Defina a data de cada avaliação de MAC.';
  return null;
}

/** Acerta a lista de datas e de títulos de MAC ao número escolhido, sem perder o que já foi escrito. */
export function resizeMac(d: PlanDraft, count: number): PlanDraft {
  const n = Math.max(0, Math.min(MAX_MAC, Math.trunc(count) || 0));
  return {
    ...d,
    macCount: n,
    macDates: Array.from({ length: n }, (_, i) => d.macDates[i] ?? ''),
    macTitles: Array.from({ length: n }, (_, i) => d.macTitles[i] ?? ''),
  };
}

export function remindersFirst(reminders: readonly Reminder[]): Reminder[] {
  const rank: Record<ReminderLevel, number> = { LATE: 0, D2: 1, D7: 2, D14: 3 };
  return [...reminders].sort((a, b) => rank[a.level] - rank[b.level] || a.plannedDate.localeCompare(b.plannedDate));
}
