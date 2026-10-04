import Link from 'next/link';
import { Logo } from '@/components/kixi';
import { APP_URL, NAV } from '@/lib/content';

export function Header() {
  return (
    <header className="site-header" data-theme="dark">
      <div className="wrap site-header__in">
        <Link href="/" aria-label="Kixi, início" className="site-header__logo">
          <Logo size={28} wordmark />
        </Link>
        <nav aria-label="Principal" className="site-header__nav">
          {NAV.map((n) => <a key={n.href} href={n.href}>{n.label}</a>)}
        </nav>
        <span className="kx-btn-wrap kx-scope">
          <a href={APP_URL} className="kx-btn kx-btn--sm" style={{ textDecoration: 'none' }}>
            <span className="kx-btn__label">Entrar</span>
          </a>
        </span>
      </div>
    </header>
  );
}
