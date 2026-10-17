'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, FileText, MessageCircle, Search, User, Users } from 'lucide-react';
import { Logo } from './brand';
import { UserAvatar } from './user-avatar';
import { Button } from '@/components/ui/button';
import { fullName, photoUrl } from '@/lib/profile';
import { useMe } from '@/lib/me-context';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/inicio', label: 'Início', icon: House, also: [] as string[] },
  { href: '/provas', label: 'Provas', icon: FileText, also: ['/prova', '/resultado', '/sala'] },
  { href: '/ranking', label: 'Turma', icon: Users, also: [] as string[] },
  { href: '/tutor', label: 'Tutor', icon: MessageCircle, also: [] as string[] },
  { href: '/perfil', label: 'Perfil', icon: User, also: [] as string[] },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const me = useMe();
  const on = (it: (typeof ITEMS)[number]) => [it.href, ...it.also].some((p) => path === p || path.startsWith(p + '/'));
  const name = fullName(me) || 'Aluno';

  return (
    <div className="min-h-dvh">
      <a
        href="#conteudo"
        className="sr-only left-3 top-3 z-50 rounded-md bg-card px-4 py-3 text-[15px] font-semibold shadow-md focus:not-sr-only focus:absolute"
      >
        Saltar para o conteudo
      </a>

      {/* Barra fina no topo, como numa rede social: a navegação é de ícones, com o nome ao lado em ecrã largo. */}
      <header className="sticky top-0 z-30 hidden h-14 border-b bg-card/95 backdrop-blur md:block">
        <div className="mx-auto flex h-full w-full max-w-[1320px] items-center gap-3 px-5">
          <Link href="/inicio" aria-label="Kixi, início" className="inline-flex shrink-0 px-1 py-1"><Logo size={24} wordmark /></Link>
          <nav aria-label="Principal" className="mx-auto flex items-center gap-1">
            {ITEMS.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                aria-current={on(it) ? 'page' : undefined}
                aria-label={it.label}
                title={it.label}
                className={cn(
                  'relative flex h-11 items-center justify-center gap-2 rounded-md px-3.5 text-sm font-semibold text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-[current=page]:text-primary',
                  "after:absolute after:inset-x-3 after:-bottom-[7px] after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 after:content-[''] aria-[current=page]:after:opacity-100",
                )}
              >
                <it.icon className="size-[22px]" strokeWidth={1.8} aria-hidden />
                <span className="hidden min-[1100px]:inline">{it.label}</span>
              </Link>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button asChild variant="ghost" size="icon" aria-label="Procurar provas"><Link href="/provas"><Search /></Link></Button>
            <Link href="/perfil" aria-label={`Perfil de ${name}`} className="flex items-center gap-2 rounded-full p-1 pr-3 text-sm font-semibold transition-colors hover:bg-secondary">
              <UserAvatar name={name} src={photoUrl(me)} size={32} />
              <span className="hidden max-w-32 truncate min-[1100px]:inline">{name}</span>
            </Link>
          </div>
        </div>
      </header>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-card px-4 md:hidden">
        <Link href="/inicio" aria-label="Kixi, início"><Logo size={22} wordmark /></Link>
        <div className="flex gap-1">
          <Button asChild variant="ghost" size="icon" aria-label="Procurar provas"><Link href="/provas"><Search /></Link></Button>
        </div>
      </header>

      <main id="conteudo" tabIndex={-1} className="outline-none">
        {children}
      </main>

      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card px-1 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] md:hidden">
        {ITEMS.map((it) => (
          <Link key={it.href} href={it.href} aria-current={on(it) ? 'page' : undefined} className="flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-muted-foreground aria-[current=page]:text-primary">
            <it.icon className="size-[22px]" strokeWidth={1.8} /><span>{it.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
