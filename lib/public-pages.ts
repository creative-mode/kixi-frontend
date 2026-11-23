/**
 * As páginas do gestor que se abrem sem sessão (ou sem acesso): não levam a barra lateral nem o cabeçalho autenticados.
 * O `proxy.ts` trata de quem as pode abrir; aqui decide-se só o que se desenha à volta (`ManagerNavbar` e `AuthLayout`).
 */
export const MANAGER_PUBLIC_PAGES = ['/login', '/403', '/recuperar'] as const;

/** `pathname` é o caminho sem o prefixo `/manager` (o `usePathname` do Next já o tira); uma barra final não conta. */
export function isManagerPublicPage(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return (MANAGER_PUBLIC_PAGES as readonly string[]).includes(path);
}
