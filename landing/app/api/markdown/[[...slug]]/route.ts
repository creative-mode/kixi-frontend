/**
 * O Markdown da landing, para quem pede Markdown (#218).
 *
 * Existe como rota própria em vez de um `Accept` no HTML porque não há como reescrever
 * o corpo de uma página já renderizada: o proxy manda quem pede Markdown para aqui, e o
 * caminho que chegou é o que se escreve. O que não existe também é servido — com 404 e
 * com o mapa do site em vez de uma página vazia.
 */

import { SITE_URL } from '@/lib/content';
import { donateMarkdown, homeMarkdown, notFoundMarkdown } from '@/lib/markdown.ts';
import { trustMarkdown } from '@/lib/trust-pages';

export const dynamic = 'force-static';

const MARKDOWN = {
  'Content-Type': 'text/markdown; charset=utf-8',
  // Os dois lados são Markdown gerado; o 404 já levava isto e o 200 ficava de fora.
  'X-Content-Type-Options': 'nosniff',
  Vary: 'Accept',
} as const;

/**
 * Páginas que existem mas não têm um gêmeo em Markdown.
 *
 * <p>São as legais, escritas em JSX (#300). Devolvê-las como 404 seria mentira — a
 * página existe, e é a que o `llms.txt` manda ler. Devolver o HTML inteiro aqui seria
 * fingir que há uma versão Markdown que não há. O que sai é o apontamento: o que a
 * página é e onde a ler.</p> */
const SO_EM_HTML: Record<string, string> = {
  '/privacidade': 'Que dados recolhemos, porquê, por quanto tempo e como exerces os teus direitos.',
  '/cookies': 'Que cookies e que analítica usamos, e como mudares a tua escolha.',
};
function pageFor(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return homeMarkdown();
  if (path === '/doar') return donateMarkdown();
  return trustMarkdown(path);
}

/**
 * A página pedida em Markdown, quando existe; se não existe, um 404 em Markdown.
 *
 * <p>Três respostas possíveis, e o que decide entre elas é o caminho: a página em
 * Markdown, o apontamento de uma página que só é HTML (`SO_EM_HTML`), ou o 404. Um 200
 * com um título de erro dentro não serve a ninguém — um agregador precisa de ver o 404,
 * e é o status que diz o que a página é.</p>
 */
export async function GET(request: Request, context: { params: Promise<{ slug?: string[] }> }): Promise<Response> {
  const { slug } = await context.params;
  const pathname = `/${(slug ?? []).join('/')}`;
  const body = pageFor(pathname);

  if (body) {
    return new Response(`${body}\n`, { status: 200, headers: MARKDOWN });
  }

  const soHtml = SO_EM_HTML[pathname];
  if (soHtml) {
    const url = `${SITE_URL}${pathname}`;
    return new Response(
      [
        `# ${pathname.slice(1)}`,
        '',
        soHtml,
        '',
        `Esta página é HTML e não tem versão em Markdown: [${url}](${url}).`,
        '',
      ].join('\n'),
      { status: 200, headers: MARKDOWN },
    );
  }

  return new Response(`${notFoundMarkdown(pathname)}\n`, { status: 404, headers: MARKDOWN });
}