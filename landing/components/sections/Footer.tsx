import { Logo } from '@/components/kixi';
import { NAV } from '@/lib/content';

export function Footer() {
  return (
    <footer className="footer" data-theme="dark">
      <div className="wrap footer__in">
        <Logo size={28} wordmark />
        <nav aria-label="Rodapé" className="footer__nav">
          {NAV.map((n) => <a key={n.href} href={n.href}>{n.label}</a>)}
        </nav>
        <p className="footer__copy">© 2026 @creativemode</p>
      </div>
    </footer>
  );
}
