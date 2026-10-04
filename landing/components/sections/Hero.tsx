import { APP_URL } from '@/lib/content';
import { Sprite } from './Bug';

function Fleet({ side, label }: { side: 'l' | 'r'; label: string }) {
  return (
    <div className={`fleet fleet--${side}`} aria-hidden="true">
      <div className="fleet__row">
        <Sprite kind="fly" width={36} />
        <Sprite kind="fly" width={36} />
      </div>
      <Sprite kind="moth" width={64} />
      <span className="fleet__tag">{label}</span>
    </div>
  );
}

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__sky" aria-hidden="true" />
      <Fleet side="l" label="Subnetting" />
      <Fleet side="r" label="VLANs" />

      <div className="wrap hero__in">
        <p className="eyebrow">Feito por alunos do ITEL, para alunos</p>
        <h1 id="hero-title" className="hero__title">
          <span className="nw">A prova não é o fim.</span>
          <span className="hero__mark">É onde o estudo começa.</span>
        </h1>
        <p className="lead">
          O Kixi transforma cada prova dos anos anteriores num gémeo digital: simulas, estudas com um tutor de IA que conhece cada questão e comparas resoluções com alunos de outras escolas.
        </p>
        <div className="hero__cta">
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

      <div className="ship" aria-hidden="true">
        <span className="ship__shot" />
        <Sprite kind="ship" width={78} />
      </div>
      <p className="hud hud--l" aria-hidden="true">XP 1.240</p>
      <p className="hud hud--r" aria-hidden="true">SEQ 12</p>
    </section>
  );
}
