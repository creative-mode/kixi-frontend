import { Logo } from '@/components/kixi';

/** Esqueleto da landing: cabeçalho, herói e secção "para quem", no estilo de manual técnico da página. */
export default function Loading() {
  return (
    <>
      <header className="site-header">
        <div className="wrap site-header__in">
          <span className="site-header__logo"><Logo size={28} wordmark /></span>
          <span className="site-header__nav" aria-hidden="true">
            <i className="lp-sk" style={{ width: 64, height: 14 }} /><i className="lp-sk" style={{ width: 80, height: 14 }} /><i className="lp-sk" style={{ width: 56, height: 14 }} />
          </span>
          <i className="lp-sk site-header__cta" style={{ width: 88, height: 40 }} aria-hidden="true" />
        </div>
      </header>
      <main role="status" aria-label="A carregar">
        <section className="wrap lp-sk-hero">
          <div className="lp-sk-stack" aria-hidden="true">
            <i className="lp-sk" style={{ width: 'min(620px, 88%)', height: 'clamp(28px, 5vw, 64px)' }} />
            <i className="lp-sk" style={{ width: 'min(460px, 70%)', height: 'clamp(28px, 5vw, 64px)' }} />
            <i className="lp-sk" style={{ width: 'min(380px, 80%)', height: 18, marginTop: 8 }} />
            <span style={{ display: 'flex', gap: 16, marginTop: 12 }}>
              <i className="lp-sk" style={{ width: 188, height: 56 }} /><i className="lp-sk" style={{ width: 148, height: 56 }} />
            </span>
            <i className="lp-sk lp-sk-cart" />
          </div>
        </section>
        <div className="hatch" aria-hidden="true" />
        <section className="wrap lp-sk-cols" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
              <i className="lp-sk" style={{ width: '60%', height: 36 }} />
              <i className="lp-sk" style={{ width: '100%', height: 16 }} />
              <i className="lp-sk" style={{ width: '90%', height: 16 }} />
              <i className="lp-sk" style={{ width: '70%', height: 16 }} />
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
