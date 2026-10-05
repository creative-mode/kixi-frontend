'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar, Icon, Logo } from './ui';
import { me } from '@/lib/data';

const ITEMS = [
  { href: '/inicio', label: 'Início', icon: 'home', also: [] as string[] },
  { href: '/provas', label: 'Provas', icon: 'file', also: ['/prova', '/resultado'] },
  { href: '/ranking', label: 'Turma', icon: 'users', also: [] as string[] },
  { href: '/tutor', label: 'Tutor', icon: 'chat', also: [] as string[] },
  { href: '/perfil', label: 'Perfil', icon: 'user', also: [] as string[] },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const on = (it: (typeof ITEMS)[number]) => [it.href, ...it.also].some((p) => path === p || path.startsWith(p + '/'));

  return (
    <div className="shell">
      <aside className="side">
        <Link href="/inicio" className="side__logo" aria-label="Kixi, início"><Logo size={26} wordmark /></Link>
        <nav className="nav" aria-label="Principal">
          {ITEMS.map((it) => (
            <Link key={it.href} href={it.href} className="nav__item" aria-current={on(it) ? 'page' : undefined}>
              <Icon name={it.icon} /><span>{it.label}</span>
            </Link>
          ))}
        </nav>
        <div className="side__foot">
          <Link href="/provas" className="btn"><Icon name="camera" size={18} />Carregar prova</Link>
          <Link href="/perfil" className="me">
            <Avatar name={me.name} size={36} />
            <span><span className="me__name" style={{ display: 'block' }}>{me.name}</span><span className="me__meta">{me.escola} · Turma {me.turma}</span></span>
          </Link>
        </div>
      </aside>

      <div className="content">
        <header className="topbar">
          <Link href="/inicio" aria-label="Kixi, início"><Logo size={22} wordmark /></Link>
          <div style={{ display: 'flex', gap: 4 }}>
            <Link href="/provas" className="iconbtn" aria-label="Procurar provas"><Icon name="search" /></Link>
            <button type="button" className="iconbtn" aria-label="Notificações"><Icon name="bell" /></button>
          </div>
        </header>
        {children}
      </div>

      <nav className="tabbar" aria-label="Principal">
        {ITEMS.map((it) => (
          <Link key={it.href} href={it.href} aria-current={on(it) ? 'page' : undefined}>
            <Icon name={it.icon} size={22} /><span>{it.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
