/** O `llms.txt`: o que um site diz a um agente que chega sem saber o que é (#218).
 *
 *  Texto simples, gerado do `content.ts` — a mesma coisa que a página diz, em vez
 *  de uma segunda versão que se esquece de actualizar. */

import { llmsTxt } from '@/lib/markdown.ts';

export const dynamic = 'force-static';

/**
 * O ficheiro é Markdown e diz que é: `text/markdown` seja qual for o `Accept`.
 *
 * <p>Anunciar `text/plain` para um corpo em Markdown é metade verdade, e o cliente
 * decide pelo `Content-Type` se sabe ou não ler o que vem a seguir. Não há
 * negociação aqui: este endereço tem um único conteúdo e esse é o seu tipo.</p>
 */
export function GET(): Response {
  return new Response(llmsTxt(), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}