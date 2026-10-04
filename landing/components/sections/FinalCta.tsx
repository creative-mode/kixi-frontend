import { Logo } from '@/components/kixi';
import { APP_URL, NAV } from '@/lib/content';
import { Sprite } from './Bug';

export function FinalCta() {
  return (
    <section className="final" id="comecar" aria-labelledby="final-title">
      <div className="final__sky" aria-hidden="true" />
      <div className="wrap final__in">
        <div className="final__bugs" aria-hidden="true"><Sprite kind="fly" width={36} /><Sprite kind="moth" width={56} /><Sprite kind="fly" width={36} /></div>
        <h2 id="final-title" className="final__title">Pronto para disparar?</h2>
        <p className="lead">Entra, escolhe uma prova e começa a derrotar os temas que te estão a travar.</p>
        <div className="hero__cta hero__cta--center">
          <span className="kx-btn-wrap kx-scope">
            <a href={APP_URL} className="kx-btn kx-btn--lg" style={{ textDecoration: 'none' }}>
              <span className="kx-btn__label">Começar a estudar</span>
            </a>
          </span>
          <span className="kx-btn-wrap kx-scope">
            <a href="#professores" className="kx-btn kx-btn--secondary kx-btn--lg" style={{ textDecoration: 'none' }}>
              <span className="kx-btn__label">Sou professor</span>
            </a>
          </span>
        </div>
      </div>
    <div className="ship ship--static" aria-hidden="true"><Sprite kind="ship" width={78} /></div>
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
        <p className="footer__copy">© 2026 @creativemode. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}
