import { NextResponse, type NextRequest } from 'next/server';
import { prefersMarkdown } from './lib/markdown-negotiation';

/**
 * Negociação de conteúdo na landing (#218).
 *
 * Um pedido que quer Markdown não pode ser servido com HTML: não há como reescrever o
 * corpo de uma página já renderizada, por isso o caminho é reescrito para a rota que o
 * escreve em Markdown, e o URL que o agente viu continua a ser o que pediu.
 */

/** Rotas que não são páginas: têm o seu próprio tipo de resposta e o seu próprio
 *  conteúdo, e reescrevê-las a Markdown trocaria um PNG por um 404. */
const NOT_NEGOTIABLE = [/^\/aluno(\/|$)/, /^\/manager(\/|$)/, /^\/api(\/|$)/, /^\/_next\//, /\.[a-z0-9]+$/i];

/**
 * O que impede que a resposta em HTML pageable guarde o HTML de quem pediu Markdown.
 *
 * <p>Este era o furo: a resposta Markdown vinha com `Vary: Accept`, mas o Next é dono do
 * `Vary` das respostas renderizadas e apaga o que aqui se põe — o HTML saía com
 * `Vary: RSC, …` e, num build de produção, com `Cache-Control: s-maxage=31536000`. Um
 * CDN guardava o HTML de `/` durante um ano sem variar com o `Accept` e servia-o a quem
 * pedia Markdown: o ponto 2 da issue desfazia-se assim que houvesse cache à frente.
 * Medido antes de mexer, e é por isso que a resposta é não ser cacheável em vez de
 * tentar pôr o `Accept` no `Vary`.</p>
 *
 * <p>`no-store` e não `private`: `private` continua a deixar guardar no browser, e quem
 * recebe Markdown é um agente que vai guardá-lo para o volver a pedir. Guardar é
 * precisamente o que não pode acontecer a uma resposta que muda com o `Accept`.</p>
 */
const NOT_SHARED_CACHE = 'no-store, must-revalidate';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Os não-negociáveis saem limpos: um `Vary: Accept` num ficheiro estático não
  // fragmenta o cache por nada, porque estático não varia com o `Accept`.
  if (NOT_NEGOTIABLE.some((pattern) => pattern.test(pathname))) {
    return NextResponse.next();
  }

  if (prefersMarkdown(request.headers.get('accept'))) {
    const url = request.nextUrl.clone();
    url.pathname = `/api/markdown${pathname === '/' ? '' : pathname}`;
    // A resposta Markdown é a que se serve; o `Vary` põe-se nela, na rota que a escreve.
    return NextResponse.rewrite(url);
  }

  // HTML de uma rota negociada: não vai para um cache partilhado, para que ninguém
  // receba HTML a pedir Markdown. Um `Vary` que não chegue não chega.
  const response = NextResponse.next();
  response.headers.set('Cache-Control', NOT_SHARED_CACHE);
  return response;
}

export const config = {
  // Tudo menos o que é ficheiro estático: o proxy só existe para o que é página.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};