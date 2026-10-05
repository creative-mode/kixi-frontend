'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Camera, ChevronsUpDown, House, FileText, MessageCircle, Search, User, Users } from 'lucide-react';
import { Logo } from './brand';
import { UserAvatar } from './user-avatar';
import { Button } from '@/components/ui/button';
import { me } from '@/lib/data';

const ITEMS = [
  { href: '/inicio', label: 'Início', icon: House, also: [] as string[] },
  { href: '/provas', label: 'Provas', icon: FileText, also: ['/prova', '/resultado'] },
  { href: '/ranking', label: 'Turma', icon: Users, also: [] as string[] },
  { href: '/tutor', label: 'Tutor', icon: MessageCircle, also: [] as string[] },
  { href: '/perfil', label: 'Perfil', icon: User, also: [] as string[] },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const on = (it: (typeof ITEMS)[number]) => [it.href, ...it.also].some((p) => path === p || path.startsWith(p + '/'));

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 border-r bg-sidebar p-4 text-sidebar-foreground md:flex">
        <Link href="/inicio" aria-label="Kixi, início" className="inline-flex px-2.5 py-1"><Logo size={26} wordmark /></Link>
        <nav aria-label="Principal" className="grid gap-0.5">
          {ITEMS.map((it) => (
            <Link key={it.href} href={it.href} aria-current={on(it) ? 'page' : undefined} className="flex h-11 items-center gap-3 rounded-md px-3 text-[15px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground">
              <it.icon className="size-5" strokeWidth={1.8} />{it.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto grid gap-3">
          <Button asChild className="bg-highlight text-highlight-foreground hover:bg-highlight/85"><Link href="/provas"><Camera />Carregar prova</Link></Button>
          <Link href="/perfil" className="flex items-center gap-2.5 rounded-md p-2 hover:bg-secondary">
            <UserAvatar name={me.name} size={36} />
            <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-sm font-semibold">{me.name}</span><span className="text-xs text-muted-foreground">{me.escola} · Turma {me.turma}</span></span>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </Link>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-card px-4 md:hidden">
          <Link href="/inicio" aria-label="Kixi, início"><Logo size={22} wordmark /></Link>
          <div className="flex gap-1">
            <Button asChild variant="ghost" size="icon" aria-label="Procurar provas"><Link href="/provas"><Search /></Link></Button>
            <Button variant="ghost" size="icon" aria-label="Notificações"><Bell /></Button>
          </div>
        </header>
        {children}
      </div>

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
