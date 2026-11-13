'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AccountMenu } from './account-menu';
import { NavProgress } from './nav-progress';
import { NavIcon, type NavIconName } from './nav-icons';
import { contextLine, fullName, photoUrl } from '@/lib/profile';
import { useMe } from '@/lib/me-context';
import { cn } from '@/lib/utils';
import { mobileNavItems, type ShellNavItem } from '@/lib/shell-nav';

/** A navegação do protótipo «nova experiência»: cinco destinos no computador e quatro no telemóvel
 *  (as notificações vivem no sino do cabeçalho). Tutor e Pautas deixam de ter entrada própria:
 *  chega-se ao Tutor pelos resultados e às Pautas pelo perfil. */
const ITEMS: (ShellNavItem & { label: string; ariaLabel?: string; icon: NavIconName })[] = [
  { href: '/inicio', label: 'Início', icon: 'inicio', also: [] },
  { href: '/provas', label: 'Provas', icon: 'provas', also: ['/prova', '/resultado', '/sala', '/tutor'] },
  { href: '/pesquisa', label: 'Explorar', ariaLabel: 'Pesquisar escolas, professores e alunos', icon: 'explorar', also: ['/escola', '/u'] },
  { href: '/turma', label: 'Turma', icon: 'turma', also: ['/ranking', '/pautas', '/discussao'] },
  { href: '/notificacoes', label: 'Notificações', icon: 'notificacoes', also: [], desktopOnly: true },
];

/** Páginas onde a coluna da direita atrapalha: conversa com o tutor, que precisa de largura. */
const NO_RAIL = ['/tutor', '/notificacoes', '/perfil', '/provas/preparar', '/turma', '/ranking', '/publicar', '/discussao'];

const SHIP =
  'M12 0h1v1h-1zM10 1h3v1h-3zM8 2h5v1h-5zM8 3h5v1h-5zM8 4h5v1h-5zM8 5h5v1h-5zM8 6h5v1h-5zM8 7h5v1h-5zM8 8h5v1h-5zM8 9h6v1h-6zM7 10h7v1h-7zM7 11h8v1h-8zM6 12h10v1h-10zM6 13h11v1h-11zM5 14h14v1h-14zM4 15h18v1h-18zM3 16h21v1h-21zM3 17h4v1h-4zM14 17h9v1h-9zM1 18h2v1h-2zM17 18h5v1h-5zM19 19h1v1h-1z';
const WORD =
  'M0 0h2v1h-2zM4 0h2v1h-2zM7 0h6v1h-6zM14 0h2v1h-2zM18 0h2v1h-2zM21 0h6v1h-6zM0 1h2v1h-2zM3 1h2v1h-2zM9 1h2v1h-2zM14 1h2v1h-2zM18 1h2v1h-2zM23 1h2v1h-2zM0 2h4v1h-4zM9 2h2v1h-2zM15 2h4v1h-4zM23 2h2v1h-2zM0 3h3v1h-3zM9 3h2v1h-2zM16 3h2v1h-2zM23 3h2v1h-2zM0 4h4v1h-4zM9 4h2v1h-2zM15 4h4v1h-4zM23 4h2v1h-2zM0 5h2v1h-2zM3 5h2v1h-2zM9 5h2v1h-2zM14 5h2v1h-2zM18 5h2v1h-2zM23 5h2v1h-2zM0 6h2v1h-2zM4 6h2v1h-2zM7 6h6v1h-6zM14 6h2v1h-2zM18 6h2v1h-2zM21 6h6v1h-6z';

/**
 * Computador: barra lateral de 232 px, coluna central de 680 px e coluna da direita (`rail`, vinda do servidor).
 * Telemóvel: cabeçalho com a nave, o sino e o avatar, e barra de 4 separadores em baixo.
 */
export function Shell({ children, rail, landingOrigin, unread = 0 }: { children: React.ReactNode; rail?: React.ReactNode; landingOrigin: string | null; unread?: number }) {
  const path = usePathname();
  const me = useMe();
  const on = (it: (typeof ITEMS)[number]) => [it.href, ...it.also].some((p) => path === p || path.startsWith(p + '/'));
  const name = fullName(me) || 'Aluno';
  const showRail = !!rail && !NO_RAIL.some((p) => path === p || path.startsWith(p + '/'));

  return (
    <div className="mx-auto flex above-banner-min-h w-full max-w-[1440px] flex-wrap items-start bg-white">
      <NavProgress />
      <a
        href="#conteudo"
        className="sr-only left-3 top-3 z-50 rounded-md bg-card px-4 py-3 text-[15px] font-semibold shadow-md focus:not-sr-only focus:absolute"
      >
        Saltar para o conteúdo
      </a>

      {/* Computador */}
      <header className="sticky top-0 hidden above-banner-h w-[232px] shrink-0 flex-col gap-7 px-4 py-7 md:flex">
        <Link href="/inicio" aria-label="Kixi, início" className="flex items-center py-1 pl-3.5">
          <svg viewBox="0 0 57 20" height="24" width="68" shapeRendering="crispEdges" aria-hidden="true">
            <path d={SHIP} fill="#1f5a2c" />
            <path transform="translate(30 6.5)" d={WORD} fill="#121c15" />
          </svg>
        </Link>
        <nav aria-label="Principal" className="flex flex-col gap-0.5">
          {ITEMS.map((it) => (
            <Link
              key={it.href}
              prefetch
              data-press
              href={it.href}
              aria-current={on(it) ? 'page' : undefined}
              aria-label={it.ariaLabel ?? it.label}
              className="flex h-[46px] items-center gap-3.5 rounded-xl px-3.5 text-[15px] font-semibold text-[#3d4a41] outline-none transition-colors hover:bg-[#f5f6f4] hover:text-[#121c15] focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-[current=page]:bg-[#f1f6ee] aria-[current=page]:font-bold aria-[current=page]:text-[#1f5a2c]"
            >
              <NavIcon name={it.icon} active={on(it)} size={22} desktop />
              {it.label}
              {it.icon === 'notificacoes' && unread > 0 && <span className="ml-auto size-[7px] shrink-0 rounded-full bg-[#c2383e]" aria-label={`${unread} novas`} />}
            </Link>
          ))}
        </nav>
        <div className="mt-auto">
          <AccountMenu name={name} photo={photoUrl(me)} subtitle={contextLine(me)} placement="side" landingOrigin={landingOrigin} />
        </div>
      </header>

      <div className="flex min-w-0 flex-1 flex-col md:flex-[999_1_560px]">
        {/* Telemóvel: a nave, o sino e o avatar, que abre o menu da conta (perfil, privacidade, cookies, terminar sessão). */}
        <header className="sticky top-0 z-20 flex items-center gap-1 bg-white pt-2 pr-3 pl-5 md:hidden">
          <Link href="/inicio" aria-label="Kixi, início" className="mr-auto grid min-h-12 place-items-center py-1">
            <svg viewBox="0 0 24 20" width="34" height="28" shapeRendering="crispEdges" aria-hidden="true"><path d={SHIP} fill="#1f5a2c" /></svg>
          </Link>
          <Link href="/notificacoes" data-press aria-label={unread > 0 ? `Notificações, ${unread} novas` : 'Notificações'} className="relative grid size-12 place-items-center rounded-full text-[#121c15]">
            <NavIcon name="notificacoes" size={22} />
            {unread > 0 && <span className="absolute top-3 right-3 size-[7px] rounded-full bg-[#c2383e]" />}
          </Link>
          <AccountMenu name={name} photo={photoUrl(me)} placement="top" landingOrigin={landingOrigin} />
        </header>

        <div className="flex min-w-0 flex-1">
          <main id="conteudo" tabIndex={-1} className={cn('mx-auto min-w-0 w-full max-w-[728px] flex-1 outline-none md:px-6', !showRail && 'md:max-w-[728px]')}>
            {children}
          </main>
        </div>
      </div>

      {showRail && (
        <aside aria-label="Destaques" className="sticky top-0 hidden above-banner-h w-[340px] max-w-[340px] shrink-0 overflow-y-auto py-7 pr-6 [scrollbar-width:none] xl:block">
          <div className="grid gap-5 pb-8">{rail}</div>
        </aside>
      )}

      {/* `--ck-banner-h` (#506): com o banner de cookies em baixo, a barra sobe por cima dele em vez de ficar tapada. */}
      <nav aria-label="Principal" data-testid="nav-mobile" className="fixed inset-x-0 bottom-[var(--ck-banner-h,0px)] z-30 grid grid-cols-4 border-t border-[#e9ece6] bg-white px-2 pt-1.5 pb-[calc(20px+env(safe-area-inset-bottom))] md:hidden">
        {mobileNavItems(ITEMS).map((it) => (
          <Link
            key={it.href}
            prefetch
            data-press
            href={it.href}
            aria-current={on(it) ? 'page' : undefined}
            className="group flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] text-[11.5px] font-semibold text-[#5f6b63] aria-[current=page]:font-bold aria-[current=page]:text-[#1f5a2c]"
          >
            <NavIcon name={it.icon} active={on(it)} size={24} />
            {it.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

