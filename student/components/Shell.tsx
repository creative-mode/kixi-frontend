'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, FileText, MessageCircle, Search, Trophy, User } from 'lucide-react';
import { Logo } from './brand';
import { UserAvatar } from './user-avatar';
import { Button } from '@/components/ui/button';
import { fullName, photoUrl } from '@/lib/profile';
import { useMe } from '@/lib/me-context';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/inicio', label: 'Início', icon: House, also: [] as string[] },
  { href: '/provas', label: 'Provas', icon: FileText, also: ['/prova', '/resultado', '/sala'] },
  { href: '/ranking', label: 'Liga', icon: Trophy, also: [] as string[] },
  { href: '/tutor', label: 'Tutor', icon: MessageCircle, also: [] as string[] },
  { href: '/perfil', label: 'Perfil', icon: User, also: [] as string[] },
];

/** Páginas onde a coluna da direita atrapalha: conversa com o tutor, que precisa de largura. */
const NO_RAIL = ['/tutor'];

/**
 * A estrutura de rede social: barra lateral à esquerda (só ícones até `xl`), a coluna central de 600 px
 * e a coluna da direita (`rail`, vinda do servidor). No telemóvel: cabeçalho fino e barra de ícones em baixo.
 */
export function Shell({ children, rail }: { children: React.ReactNode; rail?: React.ReactNode }) {
  const path = usePathname();
  const me = useMe();
  const on = (it: (typeof ITEMS)[number]) => [it.href, ...it.also].some((p) => path === p || path.startsWith(p + '/'));
  const name = fullName(me) || 'Aluno';
  const showRail = !!rail && !NO_RAIL.some((p) => path === p || path.startsWith(p + '/'));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1280px]">
      <a
        href="#conteudo"
        className="sr-only left-3 top-3 z-50 rounded-md bg-card px-4 py-3 text-[15px] font-semibold shadow-md focus:not-sr-only focus:absolute"
      >
        Saltar para o conteudo
      </a>

      <header className="sticky top-0 hidden h-dvh w-[88px] shrink-0 flex-col justify-between border-r px-2 py-3 md:flex xl:w-[260px] xl:px-3">
        <div className="grid content-start gap-1">
          <Link href="/inicio" aria-label="Kixi, início" className="mb-2 inline-flex w-fit rounded-full p-3 transition-colors hover:bg-secondary"><Logo size={26} className="xl:hidden" /><Logo size={26} wordmark className="hidden xl:block" /></Link>
          <nav aria-label="Principal" className="grid gap-1">
            {ITEMS.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                aria-current={on(it) ? 'page' : undefined}
                aria-label={it.label}
                title={it.label}
                className="flex h-12 w-fit items-center gap-4 rounded-full px-3.5 text-xl text-foreground transition-colors outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-[current=page]:font-bold xl:pr-6"
              >
                <it.icon className="size-[26px]" strokeWidth={path === it.href || on(it) ? 2.4 : 1.8} aria-hidden />
                <span className="hidden xl:inline">{it.label}</span>
              </Link>
            ))}
          </nav>
        </div>
        <Link href="/perfil" aria-label={`Perfil de ${name}`} className="flex items-center gap-3 rounded-full p-2 transition-colors hover:bg-secondary">
          <UserAvatar name={name} src={photoUrl(me)} size={40} />
          <span className="hidden min-w-0 flex-1 truncate text-[15px] font-bold xl:block">{name}</span>
        </Link>
      </header>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-background/90 px-4 backdrop-blur md:hidden">
          <Link href="/perfil" aria-label={`Perfil de ${name}`}><UserAvatar name={name} src={photoUrl(me)} size={32} /></Link>
          <Link href="/inicio" aria-label="Kixi, início"><Logo size={22} wordmark /></Link>
          <Button asChild variant="ghost" size="icon" aria-label="Procurar provas"><Link href="/provas"><Search /></Link></Button>
        </header>

        <div className="flex min-w-0 flex-1">
          <main id="conteudo" tabIndex={-1} className={cn('min-w-0 flex-1 outline-none md:border-r', showRail ? 'lg:max-w-[600px]' : 'md:max-w-[700px]')}>
            {children}
          </main>
          {showRail && (
            <aside aria-label="Destaques" className="sticky top-0 hidden h-dvh w-[350px] shrink-0 overflow-y-auto px-6 py-3 [scrollbar-width:none] lg:block">
              <div className="grid gap-4 pb-8">{rail}</div>
            </aside>
          )}
        </div>
      </div>

      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background/95 px-1 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        {ITEMS.map((it) => (
          <Link key={it.href} href={it.href} aria-current={on(it) ? 'page' : undefined} aria-label={it.label} className="flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-muted-foreground aria-[current=page]:text-foreground">
            <it.icon className="size-[24px]" strokeWidth={on(it) ? 2.4 : 1.8} /><span>{it.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
