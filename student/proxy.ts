import { NextResponse, type NextRequest } from 'next/server';
import { managerUrl as configuredManagerUrl, resolveOrigin } from '@/lib/origin';

/** Public: the two entrance screens. Everything else needs a live session. */
const PUBLIC = ['/entrar', '/cadastro'];
/** O manager vive no mesmo endereço, em /manager (fora do basePath deste app). */
/** Atrás do gateway/Docker o origin visto pelo Next é o interno: usa o endereço público
 *  (configuração primeiro, cabeçalhos do gateway como recurso). */
/** A origem de confiança, ou null quando não há nenhuma.
 *
 * Em produção `resolveOrigin` recusa sem `APP_ORIGIN`, por isso este null só acontece em
 * desenvolvimento. Aí o redirect fica no endereço de onde o pedido veio, que é onde o
 * browser já está, em vez de num host tirado dos cabeçalhos. */
function publicOrigin(req: NextRequest): string | null {
  return resolveOrigin(req.headers, req.nextUrl.protocol);
}
/**
 * Para onde vai quem é do gestor.
 *
 * Sem `APP_ORIGIN` e sem `NEXT_PUBLIC_MANAGER_URL` não há endereço de confiança para outra
 * app. O `nextUrl` deste proxy é relativo ao basePath, portanto `/manager` aqui daria
 * `/aluno/manager`, que é um 404 dentro do app do aluno — o gestor vive na raiz do
 * gateway. E reconstruir a URL a partir do host do pedido seria um open redirect. Fica então
 * no `/403`, que é um ecrã terminal, tal como o `guard.ts` faz depois do login.
 *
 * `NextResponse.redirect` recusa URLs relativas, daí o `go()` em vez de um caminho solto.
 */
function gotoManager(req: NextRequest) {
  const configured = configuredManagerUrl();
  if (configured) return NextResponse.redirect(configured);
  const confiavel = publicOrigin(req);
  return confiavel
    ? NextResponse.redirect(new URL('/manager', confiavel).toString())
    : go(req, '/403?reason=manager');
}

/** Redireciona dentro deste app (mantém o basePath /aluno). Aceita `?a=b` no path. */
function go(req: NextRequest, destino: string) {
  const [caminho, pesquisa] = destino.split('?');
  const url = req.nextUrl.clone();
  const confiavel = publicOrigin(req);
  if (confiavel) {
    url.host = new URL(confiavel).host;
    url.protocol = new URL(confiavel).protocol;
  }
  url.pathname = caminho;
  url.search = pesquisa ?? '';
  return NextResponse.redirect(url);
}

function roles(token?: string): string[] | null {
  if (!token) return null;
  try {
    const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof p.exp === 'number' && p.exp * 1000 < Date.now()) return null;
    const list = Array.isArray(p.roles) ? p.roles : [];
    // Sem papéis reconhecidos a sessão não serve: trata-a como "sem sessão"
    // para o utilizador ir ao login em vez de ficar num loop 403 ↔ início.
    return list.length > 0 ? list : null;
  } catch {
    return null;
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const r = roles(req.cookies.get('auth_token')?.value);
  // A página 403 é uma tela estática do manual: segura de mostrar a qualquer
  // visitante (paridade com o manager, que também deixa abrir /403 sem sessão).
  if (pathname === '/403' || pathname.startsWith('/403/')) return NextResponse.next();
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (isPublic) {
    if (r) return (r.includes('ADMIN') ? gotoManager(req) : go(req, '/inicio'));
    return NextResponse.next();
  }
  if (!r) return go(req, '/entrar');
  if (r.includes('ADMIN')) return gotoManager(req);
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next|favicon.ico|.*\\..*).*)'] };
