import Link from 'next/link';
import { Logo } from '@/components/kixi';
import { LOGIN_URL, NAV, SIGNUP_URL } from '@/lib/content';
import { Cta } from './CtaLink';

/** Cabeçalho desde o 1.º ecrã (#512): "Criar conta" primário e "Entrar"
 *  secundário, mais a navegação por âncoras a partir de desktop. */
export function Header() {
  return (
    <header className="site-header">
      <div className="wrap site-header__in">
        <Link href="/" aria-label="Kixi, início" className="site-header__logo">
          <Logo size={28} wordmark />
        </Link>
        <nav aria-label="Secções" className="site-header__nav">
          {NAV.map((n) => <a key={n.href} href={n.href}>{n.label}</a>)}
        </nav>
        <div className="site-header__actions">
          <Cta href={SIGNUP_URL} origem="header" size="sm">Criar conta</Cta>
          <Cta href={LOGIN_URL} origem="header" size="sm" secondary>Entrar</Cta>
        </div>
      </div>
    </header>
  );
}
