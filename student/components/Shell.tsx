'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Ico, type IcoName } from '@/components/ui/ico';
import { AccountMenu } from './account-menu';
import { Logo } from './brand';
import { NavProgress } from './nav-progress';
import { contextLine, fullName, photoUrl } from '@/lib/profile';
import { useMe } from '@/lib/me-context';
import { cn } from '@/lib/utils';
import { mobileNavItems, type ShellNavItem } from '@/lib/shell-nav';

/** O perfil não tem entrada aqui: abre-se pelo avatar (menu da conta), que também termina a sessão.
 *  A pesquisa é `desktopOnly` porque o telemóvel já a tem no cabeçalho; na barra inferior
 *  duplicaria o mesmo destino. As Pautas são `mobileHidden` (#704): a barra inferior tem
 *  4 colunas e 5 itens partiam o último para uma segunda linha; no telemóvel chega-se
 *  às pautas pelo perfil. */
const ITEMS: (ShellNavItem & { label: string; ariaLabel?: string; icon: IcoName })[] = [
  { href: '/inicio', label: 'Início', icon: 'home', also: [] },
  { href: '/provas', label: 'Provas', icon: 'file', also: ['/prova', '/resultado', '/sala'] },
  { href: '/pesquisa', label: 'Explorar', ariaLabel: 'Pesquisar escolas, professores e alunos', icon: 'search', also: ['/escola', '/u'] },
  { href: '/ranking', label: 'Turma', icon: 'trophy', also: [] },
  { href: '/tutor', label: 'Tutor', icon: 'chat', also: [], mobileHidden: true },
  { href: '/pautas', label: 'Pautas', icon: 'award', also: [], mobileHidden: true },
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
        Saltar para o conteúdo
      </a>

      <header className="sticky top-0 hidden above-banner-h w-[232px] shrink-0 flex-col justify-between gap-7 px-4 py-7 md:flex">
        <div className="grid gap-7">
          <Link href="/inicio" aria-label="Kixi, início" className="flex items-center py-1 pl-3.5"><Logo size={24} wordmark /></Link>
          <nav aria-label="Principal" className="grid gap-0.5">
            {ITEMS.map((it) => (
              <Link
                key={it.href}
                prefetch
                data-press
                href={it.href}
                aria-current={on(it) ? 'page' : undefined}
                aria-label={it.ariaLabel ?? it.label}
                className="flex h-[46px] items-center gap-3.5 rounded-xl px-3.5 text-[15px] font-semibold text-[#3d4a41] outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-[current=page]:bg-accent aria-[current=page]:font-bold aria-[current=page]:text-primary"
              >
                <Ico name={it.icon} filled={on(it)} size={22} />
                {it.label}
              </Link>
            ))}
          </nav>
        </div>
        <AccountMenu name={name} photo={photoUrl(me)} subtitle={contextLine(me)} active={path === '/perfil' || path.startsWith('/perfil/')} placement="side" landingOrigin={landingOrigin} />
      </header>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 bg-background/90 px-5 backdrop-blur md:hidden">
          <Link href="/inicio" aria-label="Kixi, início" className="grid min-h-11 place-items-center"><Logo size={26} wordmark /></Link>
          <AccountMenu name={name} photo={photoUrl(me)} active={path === '/perfil'} placement="top" landingOrigin={landingOrigin} />
        </header>

        <div className="flex min-w-0 flex-1">
          <main id="conteudo" tabIndex={-1} className={cn('mx-auto min-w-0 w-full max-w-[728px] flex-1 outline-none md:px-6')}>
            {children}
          </main>
          {showRail && (
            <aside aria-label="Destaques" className="sticky top-0 hidden above-banner-h w-[340px] shrink-0 overflow-y-auto py-7 pr-6 [scrollbar-width:none] xl:block">
              <div className="grid gap-4 pb-8">{rail}</div>
            </aside>
          )}
        </div>
      </div>

      {/* `--ck-banner-h` (#506): com o banner de cookies em baixo, a barra sobe por cima dele em vez de ficar tapada.
          São sempre 4 itens (`mobileNavItems`) num `grid-cols-4`: um quinto partiria o último para outra linha (#704).
          O texto fica visível e o item ativo tem fundo e negrito, não só cor (#511); o rótulo de 11 px usa a cor
          do texto, não a atenuada, para ter contraste por cima do fundo translúcido da barra. */}
      <nav aria-label="Principal" data-testid="nav-mobile" className="fixed inset-x-0 bottom-[var(--ck-banner-h,0px)] z-30 grid grid-cols-4 border-t bg-background px-2 pt-1.5 pb-[calc(8px+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        {mobileNavItems(ITEMS).map((it) => (
          <Link key={it.href} prefetch data-press href={it.href} aria-current={on(it) ? 'page' : undefined} className="group grid min-h-14 min-w-0 place-items-center gap-0.5 rounded-xl text-muted-foreground aria-[current=page]:font-bold aria-[current=page]:text-primary">
            <Ico name={it.icon} filled={on(it)} size={24} />
            <span className="text-[11px] font-semibold leading-tight text-foreground group-aria-[current=page]:text-primary">{it.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
