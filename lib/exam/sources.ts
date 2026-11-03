/**
 * Os ficheiros originais que o professor carrega para o OCR: o que a lista do
 * importador mostra e o que o painel «Original» abre depois da leitura.
 *
 * Puras e sem React: a ordem é mandatória (as páginas são lidas pela ordem em que
 * as adicionar), e reordenar antes de enviar muda o resultado. Depois da leitura a
 * ordem fica fixa — reordenar não relê nada — e o painel «Original» é só consulta.
 */
import type { SourceKind } from './draft.ts';

/** O texto que `accept` deixa passar, mapeado ao tipo que o importador conhece. */
export function sourceKind(file: { type?: string; name: string }): SourceKind {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? 'pdf' : 'image';
}

/** O par (id, ficheiro). Os id's são estáveis para o foco sobreviver à reordenação. */
export function newSourceId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `src-${Math.random().toString(36).slice(2)}`;
}

/** Um ficheiro à espera de leitura, com o id que o mantém no foco quando a lista muda. */
export interface SourceFile {
  id: string;
  file: File;
  kind: SourceKind;
  /** Páginas do PDF, quando já se sabe (imagens contam 1; `null` para PDF por abrir). */
  pageCount: number | null;
}

/** As páginas de um conjunto de ficheiros, na ordem em que foram adicionadas. */
export interface SourcePageRef {
  /** Índice 0-based em `sources`. */
  sourceIndex: number;
  sourceName: string;
  /** Página dentro do ficheiro, 1-based. */
  page: number;
  /** Índice 0-based na sequência global das páginas carregadas. */
  pageIndex: number;
}

/** O nº de páginas de um ficheiro: 1 para imagens, o que sabe sobre o PDF (0 = desconhecido/à espera). */
export function sourcePageCount(file: { name: string; type?: string }, pageCount: number | null): number {
  if (sourceKind(file) === 'image') return 1;
  return pageCount != null && pageCount > 0 ? pageCount : 1;
}

/** Página 0-based global → de que ficheiro e página dentro dele. `null` quando não existe. */
export function pageAtSources(
  getCount: (sourceIndex: number) => number,
  total: number,
  pageIndex: number,
): { sourceIndex: number; page: number } | null {
  if (pageIndex < 0) return null;
  let left = pageIndex;
  for (let i = 0; i < total; i += 1) {
    const count = Math.max(1, getCount(i));
    if (left < count) return { sourceIndex: i, page: left + 1 };
    left -= count;
  }
  return null;
}

/** Flatten das páginas, na ordem global. Pura, para os testes passarem sem navegador. */
export function flattenSourcePages(
  sources: readonly { name: string }[],
  counts: readonly number[],
): SourcePageRef[] {
  const out: SourcePageRef[] = [];
  let pageIndex = 0;
  sources.forEach((source, sourceIndex) => {
    const count = Math.max(1, counts[sourceIndex] ?? 1);
    for (let page = 1; page <= count; page += 1) {
      out.push({ sourceIndex, sourceName: source.name, page, pageIndex });
      pageIndex += 1;
    }
  });
  return out;
}

/** O texto do anúncio de uma reordenação, para a região `aria-live`. */
export function moveAnnouncement(name: string, from: number, to: number): string {
  const position = (n: number) => `posição ${n + 1}`;
  return `«${name}» passou da ${position(from)} para a ${position(to)}.`;
}
