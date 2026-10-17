/** A turma escolhida no onboarding vem num só valor, «<turma>:<ano letivo>», para o par nunca se
 *  separar nem depender do estado do cliente (a escolha podia perder-se antes da hidratação). */
export const turmaValue = (classId: number, schoolYearId: number | null | undefined): string => `${classId}:${schoolYearId ?? ''}`;

export function parseTurma(value: unknown): { classId: number; schoolYearId: number } | null {
  if (typeof value !== 'string') return null;
  const [c, y] = value.split(':');
  const classId = Number(c);
  const schoolYearId = Number(y);
  if (!Number.isInteger(classId) || classId < 1 || !Number.isInteger(schoolYearId) || schoolYearId < 1) return null;
  return { classId, schoolYearId };
}
