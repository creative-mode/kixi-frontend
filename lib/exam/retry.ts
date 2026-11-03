/**
 * O que «Repetir esta página» faz ao rascunho: pega nas questões que o OCR devolveu
 * para uma página do original e troca-as pelas que lá estavam.
 *
 * A troca é local: o original continua no painel «Original», por isso basta mexer no
 * que veio de uma página em vez de substituir o rascunho todo. Quem veio de onde
 * identifica-se, por esta ordem: a página (`sourcePageIndex`), o número impresso
 * (`sourceNumber`). Sem nenhum, fica «não sei» e quem chama pergunta antes de escrever.
 */
import type { DraftQuestion } from './draft.ts';

export interface RetryMerge {
  items: DraftQuestion[];
  /** Quantas questões saíram (as que substituímos). */
  replaced: number;
  /** Quantas entraram no lugar; pode diferir de `replaced`: o OCR errou de outra forma. */
  added: number;
  /** `true` quando não foi possível identificar as questões da página com confiança. */
  ambiguous: boolean;
}

const printed = (value: unknown) => String(value ?? '').trim();

/** `sourcePageIndex` como número válido, ou `null`. */
function pageOf(question: DraftQuestion): number | null {
  return typeof question.sourcePageIndex === 'number' && question.sourcePageIndex >= 0
    ? question.sourcePageIndex
    : null;
}

/**
 * As posições do rascunho que vieram da página `pageIndex` do original: por página,
 * quando a página é conhecida e os itens a trazem; senão, pelo número impresso.
 */
function positionsForPage(current: readonly DraftQuestion[], pageIndex: number | null, retriedNumbers: Set<string>): number[] {
  if (pageIndex != null) {
    const byPage = current
      .map((question, i) => ({ i, match: pageOf(question) === pageIndex }))
      .filter((x) => x.match)
      .map((x) => x.i);
    if (byPage.length > 0) return byPage;
  }
  const out: number[] = [];
  current.forEach((question, i) => {
    if (question.sourceNumber && retriedNumbers.has(printed(question.sourceNumber))) out.push(i);
  });
  return out;
}

export function mergePageRetry(
  current: readonly DraftQuestion[],
  retried: readonly DraftQuestion[],
  pageIndex: number | null,
): RetryMerge {
  if (current.length === 0 || retried.length === 0) {
    return { items: [...current], replaced: 0, added: 0, ambiguous: current.length > 0 };
  }
  const numbers = new Set(retried.map((q) => printed(q.sourceNumber)).filter(Boolean));
  const positions = positionsForPage(current, pageIndex, numbers);
  if (positions.length === 0) {
    return { items: [...current], replaced: 0, added: 0, ambiguous: true };
  }

  const first = Math.min(...positions);
  // Uma página relida reescreve o que dela saiu: as questões novas herdam a página,
  // mesmo quando o backend desta leitura parcial a devolveu a 0 (só conhece a sua página).
  const replacements = pageIndex != null
    ? retried.map((question) => (pageOf(question) === null ? { ...question, sourcePageIndex: pageIndex } : question))
    : retried;
  // As posições da página podem não ser contíguas: o professor pode ter reordenado
  // as questões antes de repetir a leitura. Remonta-se posição a posição — apagar
  // o intervalo entre a primeira e a última apagava o que ficou no meio delas.
  const saem = new Set(positions);
  const items: DraftQuestion[] = current.flatMap((question, i) =>
    i === first ? [...replacements, ...(saem.has(i) ? [] : [question])] : saem.has(i) ? [] : [question],
  );
  return {
    items,
    replaced: positions.length,
    added: replacements.length,
    ambiguous: false,
  };
}
