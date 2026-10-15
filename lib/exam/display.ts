/**
 * Como se mostram as questões de um enunciado que tem alíneas, a partir do que `GET /statements/{id}/full` devolve.
 *
 * O backend guarda cada alínea como uma questão com `parentId` e `label`, e dá-lhe o número `pai * 100 + índice`
 * (301, 302…) só para ser único. Esse número não é para mostrar: o que o professor e o aluno leem é `3a`, por isso
 * nunca se imprime `number` de uma alínea.
 *
 * A ordem das questões é a do servidor (a ordem em que chegaram quando a prova foi guardada, com cada alínea a
 * seguir ao pai): o front não reordena por `number`, que não é uma ordem.
 */

export interface TreeQuestion {
  id: number;
  number: number;
  parentId?: number | null;
  label?: string | null;
  questionType?: string | null;
}

/** O número a mostrar: `5` para uma questão, `3a` para a alínea a da 3. */
export function displayNumber(question: TreeQuestion, all: readonly TreeQuestion[]): string {
  if (question.parentId == null) return String(question.number);
  const parent = all.find((q) => q.id === question.parentId);
  if (!parent) return `${question.number}${question.label ?? ''}`;
  return `${parent.number}${question.label ?? ''}`;
}

/** Uma questão que só tem alíneas e nenhuma resposta própria. */
export const isGroup = (q: TreeQuestion) => (q.questionType ?? '').toLowerCase() === 'group';
