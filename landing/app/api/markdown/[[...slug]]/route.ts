/**
 * O Markdown da landing, para quem pede Markdown (#218).
 *
 * Existe como rota própria em vez de um `Accept` no HTML porque não há como reescrever
 * o corpo de uma página já renderizada: o proxy manda quem pede Markdown para aqui, e o
 * caminho que chegou é o que se escreve. O que não existe também é servido — com 404 e
 * com o mapa do site em vez de uma página vazia.
 */

import { donateMarkdown, homeMarkdown, notFoundMarkdown } from '@/lib/markdown.ts';
import { trustMarkdown } from '@/lib/trust-pages';

export const dynamic = 'force-static';

const MARKDOWN = { 'Content-Type': 'text/markdown; charset=utf-8', Vary: 'Accept' } as const;

/** As páginas que existem. `/` e `/doar`, e nada mais: anunciar uma página que dá 404
 *  a quem segue o link é pior do que não a anunciar. */
function pageFor(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return homeMarkdown();
  if (path === '/doar') return donateMarkdown();
  return trustMarkdown(path);
}

/**
 * `GET /` e `GET /doar` em Markdown; qualquer outro caminho é um 404 em Markdown.
 *
 * <p>O estado é o do caminho pedido, não um 200 com um título de erro dentro: um
 * agregador que indexa o que recebe precisa de ver o 404, e é o status que diz o que
 * a página é.</p>
 */
export async function GET(request: Request, context: { params: Promise<{ slug?: string[] }> }): Promise<Response> {
  const { slug } = await context.params;
  const pathname = `/${(slug ?? []).join('/')}`;
  const body = pageFor(pathname);

  if (body) {
    return new Response(`${body}\n`, { status: 200, headers: MARKDOWN });
  }

  return new Response(`${notFoundMarkdown(pathname)}\n`, {
    status: 404,
    headers: { ...MARKDOWN, 'X-Content-Type-Options': 'nosniff' },
  });
}