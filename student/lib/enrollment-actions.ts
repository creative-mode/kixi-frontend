'use server';

import { redirect } from 'next/navigation';
import { apiPost } from './api';
import type { Enrollment } from './types';

export type EnrollmentState = { error?: string; alreadyEnrolled?: boolean } | undefined;

/** Enrolls the signed-in student in the class they picked.
 *
 *  The school year travels with the class id because the endpoint validates the pair
 *  (a class that does not belong to that year is a 400), so the client cannot talk
 *  the backend into an inconsistent enrollment. */
export async function matricularAction(
  _: EnrollmentState,
  form: FormData,
): Promise<EnrollmentState> {
  const classId = Number(form.get('classId'));
  const schoolYearId = Number(form.get('schoolYearId'));

  if (!Number.isInteger(classId) || classId < 1 || !Number.isInteger(schoolYearId) || schoolYearId < 1) {
    return { error: 'Escolhe a tua turma para continuares.' };
  }

  const result = await apiPost<Enrollment>('/enrollments', { classId, schoolYearId });

  if (!result.ok) {
    // 409: an active enrollment already exists for this school year. Sending them to
    // the profile is more useful than an error, so the screen offers that way out.
    if (result.status === 409) {
      return { error: result.message, alreadyEnrolled: true };
    }
    return { error: result.message };
  }

  redirect('/inicio');
}
