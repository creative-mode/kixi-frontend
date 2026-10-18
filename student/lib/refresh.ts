import { revalidatePath } from 'next/cache';

/**
 * Chamar numa server action depois de uma escrita que muda o que outras páginas mostram (iniciar ou entregar
 * uma prova, matricular, amizades, consentimento do ranking): o browser guarda as páginas já vistas
 * (`staleTimes` em next.config.ts) e sem isto o aluno voltava a uma lista com o estado de antes.
 */
export function forgetVisitedPages(): void {
  revalidatePath('/', 'layout');
}
