import { NextResponse, type NextRequest } from 'next/server';
import { prefersMarkdown } from './lib/markdown-negotiation';
import { redirectOrigin, SESSION_COOKIE, sessionDestination } from './lib/session-destination';

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
 *
 * <p>Desde a #522 isto vale só para o que varia com o pedido. O HTML público das
 * páginas listadas vai para cache partilhada: está num URL que nunca serve Markdown.</p>
 */
const NOT_SHARED_CACHE = 'no-store, must-revalidate';

/**
 * O redireccionamento de quem tem sessão para a sua app.
 *
 * O destino é um caminho (`/aluno/inicio`, `/manager`) resolvido contra a origem pública,
 * e não contra `request.nextUrl`: atrás do gateway o host que o Next vê é o interno da
 * landing. Um destino absoluto (`NEXT_PUBLIC_MANAGER_URL`) é usado como está.
 *
 * Nunca vai para cache: a mesma `/` é a landing para uns e um redireccionamento para outros.
 */
function sessionRedirect(request: NextRequest, destination: string) {
  const origin = redirectOrigin(
    process.env.APP_ORIGIN,
    request.headers,
    request.nextUrl.protocol,
    process.env.NODE_ENV === 'production',
  );
  if (!origin && destination.startsWith('/')) return null;
  const response = NextResponse.redirect(new URL(destination, origin ?? undefined), 307);
  response.headers.set('Cache-Control', NOT_SHARED_CACHE);
  response.headers.set('Vary', 'Cookie');
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Os não-negociáveis saem limpos: um `Vary: Accept` num ficheiro estático não
  // fragmenta o cache por nada, porque estático não varia com o `Accept`.
  if (NOT_NEGOTIABLE.some((pattern) => pattern.test(pathname))) {
    return NextResponse.next();
  }

  const wantsMarkdown = prefersMarkdown(request.headers.get('accept'));

  // Quem já tem sessão não precisa da página de apresentação: vai direto para a sua app.
  // Só na raiz, de propósito: /doar, /privacidade e /cookies continuam abertos a quem
  // está autenticado. E só para HTML, porque quem pede Markdown é um agente sem sessão.
  if (pathname === '/' && !wantsMarkdown) {
    const destination = sessionDestination(
      request.cookies.get(SESSION_COOKIE)?.value,
      process.env.NEXT_PUBLIC_MANAGER_URL,
    );
    const redirect = destination ? sessionRedirect(request, destination) : null;
    if (redirect) return redirect;
  }

  if (wantsMarkdown) {
    const url = request.nextUrl.clone();
    url.pathname = `/api/markdown${pathname === '/' ? '' : pathname}`;
    // A resposta Markdown é a que se serve; o `Vary` põe-se nela, na rota que a escreve.
    return NextResponse.rewrite(url);
  }

  // HTML de uma rota negociada: só vai para um cache partilhado quando é igual para
  // toda a gente. A raiz varia com a sessão e o resto (inexistente incluído) não se
  // promete a nenhum CDN.
  // Sem tocar no Cache-Control: o que aqui se põe numa resposta renderizada não
  // sobrevive (medido: sai sempre o da config da rota). Cache desta landing
  // decide-se por página, com `revalidate` (públicas) ou `dynamic` (a raiz, que
  // varia com a sessão) — ver #522.
  const response = NextResponse.next();
  return response;
}

export const config = {
  // Tudo menos o que é ficheiro estático: o proxy só existe para o que é página.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};