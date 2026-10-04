import { APP_URL } from '@/lib/content';
import { Cartridge } from './Cartridge';

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap hero__in">
        <h1 id="hero-title" className="hero__title">
          A prova não é o fim.
          <span>É onde o estudo começa.</span>
        </h1>
        <p className="hero__sub">Simula a prova, estuda com um tutor de IA e compara com alunos de outras escolas.</p>
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
      <figure className="hero__fig">
        <Cartridge explode={0.2} view="hero" className="hero__cart" />
        <figcaption>Fig. 1. O cartucho Kixi, fechado.</figcaption>
      </figure>
    </section>
  );
}
