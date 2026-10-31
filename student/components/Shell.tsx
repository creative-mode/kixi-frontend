'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Ico, type IcoName } from '@/components/ui/ico';
import { AccountMenu } from './account-menu';
import { Logo } from './brand';
import { NavProgress } from './nav-progress';
import { fullName, photoUrl } from '@/lib/profile';
import { useMe } from '@/lib/me-context';
import { cn } from '@/lib/utils';

/** O perfil não tem entrada aqui: abre-se pelo avatar (menu da conta), que também termina a sessão.
 *  A pesquisa é `desktopOnly` porque o telemóvel já a tem no cabeçalho; na barra inferior
 *  duplicaria o mesmo destino. */
const ITEMS: { href: string; label: string; ariaLabel?: string; icon: IcoName; also: string[]; desktopOnly?: boolean }[] = [
  { href: '/inicio', label: 'Início', icon: 'home', also: [] },
  { href: '/provas', label: 'Provas', icon: 'file', also: ['/prova', '/resultado', '/sala'] },
  { href: '/ranking', label: 'Liga', icon: 'trophy', also: [] },
  { href: '/pautas', label: 'Pautas', icon: 'award', also: [] },
  { href: '/tutor', label: 'Tutor', icon: 'chat', also: [] },
  { href: '/pesquisa', label: 'Pesquisar', ariaLabel: 'Pesquisar escolas, professores e alunos', icon: 'search', also: [], desktopOnly: true },
];

/** Páginas onde a coluna da direita atrapalha: conversa com o tutor, que precisa de largura. */
const NO_RAIL = ['/tutor'];

/**
 * A estrutura de rede social: barra lateral à esquerda (só ícones até `xl`), a coluna central de 600 px
 * e a coluna da direita (`rail`, vinda do servidor). No telemóvel: cabeçalho fino e barra de ícones em baixo.
 */
export function Shell({ children, rail, landingOrigin }: { children: React.ReactNode; rail?: React.ReactNode; landingOrigin: string | null }) {
  const path = usePathname();
  const me = useMe();
  const on = (it: (typeof ITEMS)[number]) => [it.href, ...it.also].some((p) => path === p || path.startsWith(p + '/'));
  const name = fullName(me) || 'Aluno';
  const showRail = !!rail && !NO_RAIL.some((p) => path === p || path.startsWith(p + '/'));

  return (
    <div className="mx-auto flex above-banner-min-h w-full max-w-[1500px]">
      <NavProgress />
      <a
        href="#conteudo"
        className="sr-only left-3 top-3 z-50 rounded-md bg-card px-4 py-3 text-[15px] font-semibold shadow-md focus:not-sr-only focus:absolute"
      >
        Saltar para o conteudo
      </a>

      <header className="sticky top-0 hidden above-banner-h w-[72px] shrink-0 flex-col items-center justify-between border-r py-3 md:flex">
        <div className="grid justify-items-center gap-1">
          <Link href="/inicio" aria-label="Kixi, início" className="mb-2 grid size-12 place-items-center rounded-full transition-colors hover:bg-secondary"><Logo size={26} /></Link>
          <nav aria-label="Principal" className="grid justify-items-center gap-1">
            {ITEMS.map((it) => (
              <Link
                key={it.href}
                prefetch
                data-press
                href={it.href}
                aria-current={on(it) ? 'page' : undefined}
                aria-label={it.ariaLabel ?? it.label}
                title={it.label}
                className="grid size-12 place-items-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-[current=page]:text-primary"
              >
                <Ico name={it.icon} filled={on(it)} size={28} />
              </Link>
            ))}
          </nav>
        </div>
        <AccountMenu name={name} photo={photoUrl(me)} active={path === '/perfil' || path.startsWith('/perfil/')} placement="side" landingOrigin={landingOrigin} />
      </header>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-background/90 px-4 backdrop-blur md:hidden">
          <AccountMenu name={name} photo={photoUrl(me)} active={path === '/perfil'} placement="top" landingOrigin={landingOrigin} />
          <Link href="/inicio" aria-label="Kixi, início" className="grid min-h-11 place-items-center px-2"><Logo size={22} wordmark /></Link>
          <Link href="/pesquisa" data-press aria-label="Pesquisar escolas, professores e alunos" title="Pesquisar" className="grid size-12 place-items-center rounded-full hover:bg-secondary"><Ico name="search" size={26} /></Link>
        </header>

        <div className="flex min-w-0 flex-1">
          <main id="conteudo" tabIndex={-1} className={cn('min-w-0 flex-1 outline-none md:border-r', !showRail && !NO_RAIL.some((p) => path === p || path.startsWith(p + '/')) && 'md:max-w-[760px]')}>
            {children}
          </main>
          {showRail && (
            <aside aria-label="Destaques" className="sticky top-0 hidden above-banner-h w-[380px] shrink-0 overflow-y-auto px-4 py-3 [scrollbar-width:none] lg:block">
              <div className="grid gap-4 pb-8">{rail}</div>
            </aside>
          )}
        </div>
      </div>

      {/* `--ck-banner-h` (#506): com o banner de cookies em baixo, a barra sobe por cima dele em vez de ficar tapada. */}
      <nav aria-label="Principal" className="fixed inset-x-0 bottom-[var(--ck-banner-h,0px)] z-30 grid grid-cols-4 border-t bg-background/95 px-1 pt-1 pb-[calc(4px+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        {ITEMS.filter((it) => !it.desktopOnly).map((it) => (
          <Link key={it.href} prefetch data-press href={it.href} aria-current={on(it) ? 'page' : undefined} aria-label={it.label} title={it.label} className="grid min-h-14 place-items-center text-muted-foreground aria-[current=page]:text-primary">
            <Ico name={it.icon} filled={on(it)} size={28} />
          </Link>
        ))}
      </nav>
    </div>
  );
}
