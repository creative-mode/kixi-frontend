import { Logo } from '@/components/kixi';
import { CookieSettings } from '@/components/consent/CookieSettings';
import { CONTACT_EMAIL, LOGIN_URL, NAV, SIGNUP_URL } from '@/lib/content';

export function Footer() {
  return (
    <footer className="footer" data-theme="dark">
      <div className="wrap footer__in">
        <Logo size={28} wordmark />
        <p className="footer__lead">Feito por alunos do ITEL, para alunos.</p>
        <nav aria-label="Rodapé" className="footer__nav">
          {NAV.map((n) => <a key={n.href} href={n.href}>{n.label}</a>)}
          <a href="/doar">Doar um enunciado</a>
          <a href={SIGNUP_URL}>Criar conta</a>
          <a href={LOGIN_URL}>Entrar</a>
          <a href="/privacidade">Privacidade</a>
          <a href="/cookies">Cookies</a>
          <CookieSettings />
        </nav>
        {CONTACT_EMAIL ? <p className="footer__contact">Contacto: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p> : null}
        <p className="footer__copy">© 2026 @creativemode</p>
      </div>
    </footer>
  );
}
