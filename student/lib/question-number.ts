/**
 * O número que o aluno lê numa questão com alíneas.
 *
 * O backend guarda cada alínea como uma questão com `parentId` e `label`, e dá-lhe o número
 * `pai * 100 + índice` (301, 302…) para a ordem por número pôr a alínea a seguir ao pai. Esse número é
 * interno: o aluno lê «3a», e o tutor, que fala em questões inteiras, recebe o 3. Nada aqui chama o
 * servidor, para se poder testar.
 *
 * Um endpoint nem sempre traz `parentId` e `label` (a comunidade só traz o `number`), por isso o número
 * sozinho chega: um número de 100 para cima é de uma alínea, e a letra sai do resto (índice 1 → a).
 */

/** `a`, `b`, `c`… e `aa` depois de `z`. */
export function itemLabel(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode(97 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

export interface Numbered {
  number: number | null;
  label?: string | null;
  parentId?: number | null;
}

/** Se o número é o de uma alínea: com `parentId`, ou de 100 para cima. */
export function isItem(q: Numbered): boolean {
  return q.parentId != null || (q.number != null && q.number >= 100);
}

/** O número da questão inteira: o 3 para o 301. Para uma questão de topo, o próprio número. */
export function topNumber(number: number): number {
  return number >= 100 ? Math.floor(number / 100) : number;
}

/** `5` para uma questão, `3a` para a alínea a da 3, `—` quando não há número. */
export function displayNumber(q: Numbered): string {
  if (q.number == null) return '—';
  if (!isItem(q)) return String(q.number);
  const index = q.number % 100;
  const label = q.label?.trim() || (index > 0 ? itemLabel(index - 1) : '');
  return `${topNumber(q.number)}${label}`;
}

/** Os números de questão inteira a que um conjunto de questões erradas pertence, sem repetir e por ordem.
 *  É o que o tutor recebe: «estuda a questão 3», nunca «a 301». */
export function wholeNumbers(questions: readonly { number: number }[]): number[] {
  return [...new Set(questions.map((q) => topNumber(q.number)))].sort((a, b) => a - b);
}
