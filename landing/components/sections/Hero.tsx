import { APP_URL } from '@/lib/content';
import { Sprite } from './Bug';

function Fleet({ side }: { side: 'l' | 'r' }) {
  return (
    <div className={`fleet fleet--${side}`} aria-hidden="true">
      <div className="fleet__row">
        <Sprite kind="fly" width={32} />
        <Sprite kind="fly" width={32} />
      </div>
      <Sprite kind="moth" width={56} />
    </div>
  );
}

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="sky" aria-hidden="true" />
      <Fleet side="l" />
      <Fleet side="r" />
      <div className="hero__in">
        <p className="eyebrow">Feito por alunos do ITEL</p>
        <h1 id="hero-title" className="hero__title">
          A prova não é o fim.
          <span>É onde o estudo começa.</span>
        </h1>
        <p className="hero__sub">Simula, estuda com IA e compara com outras escolas.</p>
        <div className="actions">
          <span className="kx-btn-wrap kx-scope">
            <a href={APP_URL} className="kx-btn kx-btn--lg" style={{ textDecoration: 'none' }}>
              <span className="kx-btn__label">Começar a estudar</span>
            </a>
          </span>
          <span className="kx-btn-wrap kx-scope">
            <a href="#para-quem" className="kx-btn kx-btn--secondary kx-btn--lg" style={{ textDecoration: 'none' }}>
              <span className="kx-btn__label">Sou professor</span>
            </a>
          </span>
        </div>
      </div>
      <div className="ship" aria-hidden="true">
        <span className="ship__shot" />
        <Sprite kind="ship" width={72} />
      </div>
    </section>
  );
}
