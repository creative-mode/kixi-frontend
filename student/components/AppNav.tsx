'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, Logo } from './kixi';

const ITEMS = [
  { href: '/inicio', label: 'Início', icon: 'home' },
  { href: '/provas', label: 'Provas', icon: 'book' },
  { href: '/ranking', label: 'Ranking', icon: 'trophy' },
  { href: '/tutor', label: 'Tutor', icon: 'chat' },
  { href: '/perfil', label: 'Perfil', icon: 'user' },
];

export function AppNav() {
  const path = usePathname();
  return (
    <nav className="kx-nav kx-scope" aria-label="Principal">
      <span className="kx-nav__brand"><Logo size={28} wordmark /></span>
      {ITEMS.map((it) => {
        const active = path === it.href;
        return (
          <Link key={it.href} href={it.href} className={`kx-nav__item nav-link${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
            <Icon name={it.icon} size={24} />
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
