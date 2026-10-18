'use server';

import { forgetVisitedPages } from './refresh';
import { redirect } from 'next/navigation';
import { apiPost } from './api';
import { parseTurma } from './enrollment-rules';
import type { Enrollment } from './types';

export type EnrollmentState = { error?: string; alreadyEnrolled?: boolean } | undefined;

/** Enrolls the signed-in student in the class they picked.
 *
 *  A auto-matrícula passou a exigir um código emitido pela escola: é ele, e não o
 *  classId/schoolYearId que o aluno escolheu no ecrã, que decide a turma no backend
 *  (ver EnrollmentService#resolveBySelfEnrollCode). Continuamos a enviar o par
 *  classId/schoolYearId porque o backend valida a consistência entre eles quando
 *  presentes, mas quem manda é o código. */
export async function matricularAction(
  _: EnrollmentState,
  form: FormData,
): Promise<EnrollmentState> {
  const turma = parseTurma(form.get('turma'));
  if (!turma) return { error: 'Escolhe a tua turma para continuares.' };
  const { classId, schoolYearId } = turma;

  const code = String(form.get('codigo') ?? '').trim();
  if (!code) return { error: 'Introduz o código de matrícula que a tua escola te deu.' };

  const result = await apiPost<Enrollment>('/enrollments', { classId, schoolYearId, code });

  if (!result.ok) {
    // 409: an active enrollment already exists for this school year. Sending them to
    // the profile is more useful than an error, so the screen offers that way out.
    if (result.status === 409) {
      return { error: result.message, alreadyEnrolled: true };
    }
    return { error: result.message };
  }

  // Caminho cru, de propósito: numa server action o Next escreve este valor no
  // cabecalho `x-action-redirect` e o cliente acrescenta o basePath. Escrever
  // `/aluno/inicio` aqui dava `/aluno/aluno/inicio`. Ver `README.md`, "basePath".
  // `matriculado=1` é o sinal de uso único do kixi-frontend#219 ("onboarding
  // concluído"): `/inicio` por si só não chega, porque é a página normal de entrada,
  // visitada em todas as sessões seguintes.
  forgetVisitedPages();
  redirect('/inicio?matriculado=1');
}
