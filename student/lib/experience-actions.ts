'use server';

import { apiGet } from './api';
import { parseAcademicYear, type AcademicYear } from './experience-rules';

/** O histórico académico de um ano lectivo. O backend só o devolve ao próprio aluno com sessão. */
export async function loadAcademicYearAction(schoolYearId: number): Promise<{ ok: true; year: AcademicYear } | { ok: false; message: string }> {
  if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) return { ok: false, message: 'Ano lectivo inválido.' };
  const r = await apiGet<unknown>('/me/academic-history', { schoolYearId });
  if (r.ok) return { ok: true, year: parseAcademicYear(r.data, schoolYearId) };
  return { ok: false, message: r.status === 404 ? 'O histórico deste ano ainda não está disponível.' : r.message };
}
