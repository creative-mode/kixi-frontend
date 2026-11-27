import { Logo } from '@/components/kixi';

/** Esqueleto da landing: cabeçalho, herói (texto e a questão de prova) e os passos, com o Skeleton do design system. */
export default function Loading() {
  return (
    <>
      <header className="site-header">
        <div className="wrap site-header__in">
          <span className="site-header__logo"><Logo size={28} wordmark /></span>
          <span className="site-header__nav" aria-hidden="true">
            <i className="lp-sk" style={{ width: 64, height: 14 }} /><i className="lp-sk" style={{ width: 80, height: 14 }} /><i className="lp-sk" style={{ width: 56, height: 14 }} />
          </span>
          <span className="site-header__actions" aria-hidden="true">
            <i className="lp-sk" style={{ width: 104, height: 36 }} /><i className="lp-sk" style={{ width: 72, height: 36 }} />
          </span>
        </div>
      </header>
      <main role="status" aria-label="A carregar">
        <section className="hero" aria-hidden="true">
          <div className="wrap hero__in">
            <div className="hero__copy" style={{ gap: 16, width: '100%' }}>
              <i className="lp-sk" style={{ width: 220, height: 28, borderRadius: 999 }} />
              <i className="lp-sk" style={{ width: 'min(560px, 92%)', height: 'clamp(36px, 5vw, 60px)' }} />
              <i className="lp-sk" style={{ width: 'min(420px, 70%)', height: 'clamp(36px, 5vw, 60px)' }} />
              <i className="lp-sk" style={{ width: 'min(400px, 86%)', height: 18, marginTop: 4 }} />
              <span style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <i className="lp-sk" style={{ width: 188, height: 50 }} /><i className="lp-sk" style={{ width: 148, height: 50 }} />
              </span>
            </div>
            <i className="lp-sk lp-sk-quiz" />
          </div>
        </section>
        <section className="wrap lp-sk-cols" aria-hidden="true">
          {[0, 1, 2].map((i) => <i key={i} className="lp-sk" style={{ height: 180, borderRadius: 20 }} />)}
        </section>
      </main>
    </>
  );
}
