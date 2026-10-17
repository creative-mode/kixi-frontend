/**
 * Negociação de conteúdo: quando um pedido quer Markdown em vez de HTML (#218).
 *
 * Só isto, sem nada do Next, para se poder testar. A regra que interessa: um
 * wildcard no `Accept` — o que o `curl` manda sem dizer nada — tem de dar HTML,
 * ou o primeiro link que um agente segue deixa de ter por onde andar.
 */

/** Uma entrada de `Accept`: o tipo e a qualidade. */
type Entry = { type: string; q: number };

function parse(accept: string | null): Entry[] {
  if (!accept) return [];
  return accept.split(',').map((part) => {
    const [type, ...params] = part.trim().split(';');
    const q = params
      .map((p) => p.trim())
      .find((p) => p.startsWith('q='))
      ?.slice(2);
    const parsed = Number(q);
    return { type: type.trim().toLowerCase(), q: Number.isFinite(parsed) ? parsed : 1 };
  });
}

/** A qualidade com que este pedido aceita `type`, incluindo o `*` seguido de `/`. */
function qualityFor(entries: Entry[], type: string): number {
  const exact = entries.find((e) => e.type === type);
  if (exact) return exact.q;
  const wildcard = entries.find((e) => e.type === '*/*');
  return wildcard ? wildcard.q : 0;
}

/**
 * `true` quando a resposta deve ser Markdown.
 *
 * <p>Compara as qualidades de `text/markdown` e de `text/html` e só escolhe o
 * Markdown se ele for estritamente preferível. Assim:
 *
 * - `Accept: text/markdown` → Markdown.
 * - `Accept: text/html, text/markdown` (igual peso, HTML primeiro) → HTML.
 * - um wildcard (o `curl` sem `-H`) → HTML, porque empatam.
 * - Sem `Accept` nenhum → HTML, que é o que um navegador sempre quis.</p>
 */
export function prefersMarkdown(accept: string | null): boolean {
  const entries = parse(accept);
  if (entries.length === 0) return false;
  return qualityFor(entries, 'text/markdown') > qualityFor(entries, 'text/html');
}