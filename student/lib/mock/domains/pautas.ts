import { ownTermSheets } from '../pautas';
import { json } from '../store';
import type { MockCtx } from '../store';

/** Rotas do domínio «pautas» do mock do aluno; devolve `undefined` quando o pedido não é deste domínio. */
export async function pautasRoutes({ method, pathname, account, staff, db }: MockCtx): Promise<Response | undefined> {
  // kixi#506: o aluno lê só a sua linha, de pautas fechadas da sua turma. Quem não é aluno não tem linhas.
  if (pathname !== '/me/term-sheets' || method !== 'GET') return undefined;
  if (staff) return json([]);
  const enrollment = db.enrollments.find((e) => e.accountId === account.id && e.status === 'ACTIVE');
  const klass = enrollment && db.classes.find((c) => c.id === enrollment.classId);
  const year = enrollment && db.schoolYears.find((y) => y.id === enrollment.schoolYearId);
  if (!klass || !year) return json([]);
  return json(ownTermSheets({ accountId: account.id, className: klass.code, schoolYear: `${year.startYear}/${year.endYear}`, subjects: db.subjects }));
}
