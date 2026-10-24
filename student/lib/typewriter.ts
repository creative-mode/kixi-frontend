/**
 * Quantos caracteres da resposta mostrar (#484).
 *
 * A Groq entrega a resposta inteira em menos de um segundo: chega "token a token", mas tão depressa que o
 * ecrã a mostra de uma vez. O ritmo aqui é o da leitura: uma velocidade base e, se o que falta mostrar for
 * muito, acelera para o ecrã não ficar para trás da resposta.
 */
export const BASE_CHARS_PER_SECOND = 90;

/** Os caracteres a mostrar passados `elapsedMs`, sem passar de `total` nem partir um par de substitutos. */
export function advance(shown: number, total: number, elapsedMs: number, text?: string): number {
  if (shown >= total) return total;
  const backlog = total - shown;
  const perSecond = Math.max(BASE_CHARS_PER_SECOND, backlog * 2.5);
  let next = Math.min(total, shown + Math.max(1, Math.floor((perSecond * elapsedMs) / 1000)));
  if (text && next < total) {
    const code = text.charCodeAt(next - 1);
    if (code >= 0xd800 && code <= 0xdbff) next += 1;
  }
  return Math.min(next, total);
}
