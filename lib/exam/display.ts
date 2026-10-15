/**
 * Como se mostram as questões de um enunciado que tem alíneas, a partir do que `GET /statements/{id}/full` devolve.
 *
 * O backend guarda cada alínea como uma questão com `parentId` e `label`, e dá-lhe o número `pai * 100 + índice`
 * (301, 302…) para a ordem por número pôr a alínea a seguir ao pai. Esse número não é para mostrar: o que o
 * professor e o aluno leem é `3a`. Por isso nunca se imprime `number` de uma alínea.
 */

export interface TreeQuestion {
  id: number;
  number: number;
  parentId?: number | null;
  label?: string | null;
  questionType?: string | null;
}

/** As questões com cada alínea logo a seguir ao pai, pela ordem do número. Uma alínea cujo pai não está na
 *  lista (apagado, ou filtrado) é tratada como questão de topo, para não desaparecer. */
export function orderWithGroups<T extends TreeQuestion>(questions: readonly T[]): T[] {
  const ids = new Set(questions.map((q) => q.id));
  const children = new Map<number, T[]>();
  const top: T[] = [];
  for (const q of questions) {
    if (q.parentId != null && ids.has(q.parentId)) children.set(q.parentId, [...(children.get(q.parentId) ?? []), q]);
    else top.push(q);
  }
  const byNumber = (a: T, b: T) => a.number - b.number;
  return top.sort(byNumber).flatMap((q) => [q, ...(children.get(q.id) ?? []).sort(byNumber)]);
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
