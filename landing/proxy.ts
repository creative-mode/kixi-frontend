import { NextResponse, type NextRequest } from 'next/server';
import { prefersMarkdown } from './lib/markdown-negotiation';

/**
 * Negociação de conteúdo na landing (#218).
 *
 * Um pedido que quer Markdown não pode ser servido com HTML: não há como reescrever o
 * corpo de uma página já renderizada, por isso o caminho é reescrito para a rota que o
 * escreve em Markdown, e o URL que o agente viu continua a ser o que pediu.
 *
 * O `Vary: Accept` vai nas respostas em Markdown, que é onde a variação importa. Nas
 * respostas HTML o Next é dono do cabeçalho `Vary` e reescreve o que aqui se põe — e o
 * HTML sai sempre com `Cache-Control: no-cache, must-revalidate`, portanto um cache
 * partilhado tem de revalidar com a origem antes de a servir, e a origem é este proxy,
 * que volta a decidir pelo `Accept`.
 */

/** Rotas que não são páginas: têm o seu próprio tipo de resposta e o seu próprio
 *  conteúdo, e reescrevê-las a Markdown trocaria um PNG por um 404. */
const NOT_NEGOTIABLE = [/^\/aluno(\/|$)/, /^\/manager(\/|$)/, /^\/api(\/|$)/, /^\/_next\//, /\.[a-z0-9]+$/i];

/** O proxy também não quer o `Vary` a passar por cima de um `Accept` que a rota já
 *  tenha posto — o `/llms.txt`, por exemplo. */
function withVary(response: NextResponse): NextResponse {
  const vary = response.headers.get('Vary');
  if (!vary) {
    response.headers.set('Vary', 'Accept');
  } else if (!vary.toLowerCase().split(',').some((v) => v.trim().toLowerCase() === 'accept')) {
    response.headers.append('Vary', 'Accept');
  }
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (NOT_NEGOTIABLE.some((pattern) => pattern.test(pathname))) {
    return withVary(NextResponse.next());
  }

  if (prefersMarkdown(request.headers.get('accept'))) {
    const url = request.nextUrl.clone();
    url.pathname = `/api/markdown${pathname === '/' ? '' : pathname}`;
    return withVary(NextResponse.rewrite(url));
  }

  return withVary(NextResponse.next());
}

export const config = {
  // Tudo menos o que é ficheiro estático: o proxy só existe para o que é página.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};