import { Logo } from '@/components/kixi';
import { APP_URL, NAV } from '@/lib/content';
import { Sprite } from './Bug';

export function FinalCta() {
  return (
    <section className="final" id="comecar" aria-labelledby="final-title">
      <div className="sky" aria-hidden="true" />
      <div className="wrap final__in">
        <h2 id="final-title" className="h2 h2--pixel">Pronto para disparar?</h2>
        <div className="actions">
          <span className="kx-btn-wrap kx-scope">
            <a href={APP_URL} className="kx-btn kx-btn--lg" style={{ textDecoration: 'none' }}>
              <span className="kx-btn__label">Começar a estudar</span>
            </a>
          </span>
        </div>
      </div>
      <div className="ship ship--static" aria-hidden="true"><Sprite kind="ship" width={72} /></div>
    </section>
  );
}

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
