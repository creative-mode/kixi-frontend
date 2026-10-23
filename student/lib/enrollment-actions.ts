'use server';

import { forgetVisitedPages } from './refresh';
import { apiPost } from './api';
import type { Enrollment } from './types';
import { redirectFromAction } from './action-redirect';

export type EnrollmentState = { error?: string; alreadyEnrolled?: boolean } | undefined;

/** Enrolls the signed-in student with the code the school gave them.
 *
 *  Since kixi#255 the code is the whole request: the backend redeems it and takes the
 *  class and school year from the code, never from the client. Sending the old
 *  `classId`/`schoolYearId` pair would only echo a choice the server ignores — and would
 *  keep the illusion that the class picked in the wizard decides anything.
 */
export async function matricularAction(
  _: EnrollmentState,
  form: FormData,
): Promise<EnrollmentState> {
  const code = String(form.get('codigo') ?? '').trim();
  if (!code) return { error: 'Introduz o código de matrícula que a tua escola te deu.' };

  const result = await apiPost<Enrollment>('/enrollments', { code });

  if (!result.ok) {
    // 409: an active enrollment already exists for this school year. Sending them to
    // the profile is more useful than an error, so the screen offers that way out.
    if (result.status === 409) {
      return {
        error: 'Já tens uma matrícula ativa neste ano letivo. Vê o teu perfil.',
        alreadyEnrolled: true,
      };
    }
    // O backend não distingue código inexistente, expirado, revogado ou esgotado — de
    // propósito, para não ajudar quem anda a adivinhar. A mensagem também não tenta.
    if (result.status === 400) {
      return { error: 'Código inválido, expirado, revogado ou já usado. Confirma o código com a escola.' };
    }
    if (result.status === 429) {
      return { error: 'Demasiadas tentativas de matrícula. Espera um pouco e tenta de novo.' };
    }
    if (result.status === 404) {
      return { error: 'A turma deste código já não existe. Pede um código novo à escola.' };
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
  await redirectFromAction('/inicio?matriculado=1');
}
