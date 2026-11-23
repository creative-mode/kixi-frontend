/** A lógica do lightbox, sem React: a imagem que se está a ver, a que vem a seguir e o texto
 *  alternativo. Assim as contas testam-se no node e os componentes ficam só com o desenho. */

/** Uma imagem que o lightbox sabe mostrar: o caminho no backend, a descrição e a legenda. */
export interface LightboxImage {
  url: string;
  alt?: string | null;
  caption?: string | null;
}

/** O `alt` de uma imagem da publicação. Nunca fica vazio (uma imagem sem descrição ainda é uma imagem),
 *  mas a descrição escrita pelo autor tem sempre prioridade. */
export function imageAlt(alt: string | null | undefined, fallback: string): string {
  const clean = (alt ?? '').trim();
  return clean || fallback;
}

/** Avança (1) ou recua (-1) na galeria, dando a volta nas pontas: da última seta vai-se para a primeira. */
export function stepIndex(current: number, length: number, step: number): number {
  if (length <= 0) return 0;
  return (((current + step) % length) + length) % length;
}

export const nextIndex = (current: number, length: number): number => stepIndex(current, length, 1);
export const previousIndex = (current: number, length: number): number => stepIndex(current, length, -1);

/** O sentido de um swipe: arrastar para a esquerda mostra a imagem seguinte (+1), para a direita a anterior (-1). */
export function swipeStep(deltaX: number, threshold = 48): -1 | 0 | 1 {
  if (deltaX <= -threshold) return 1;
  if (deltaX >= threshold) return -1;
  return 0;
}
