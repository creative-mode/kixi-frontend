import { Logo } from '@/components/kixi';
import { APP_URL } from '@/lib/content';
import { Bug } from './Bug';

const TARGETS = [
  { label: 'Subnetting', hue: 'alvo' },
  { label: 'VLANs', hue: 'pop' },
  { label: 'Binário', hue: 'radar' },
  { label: 'Roteamento', hue: 'lila' },
] as const;

export function Hero() {
  return (
    <section className="hero kx-lcd" aria-labelledby="hero-title">
      <div className="wrap hero__in">
        <div className="hero__copy">
          <p className="eyebrow eyebrow--tiro">Feito por alunos do ITEL, para alunos</p>
          <h1 id="hero-title" className="hero__title">
            A prova não é o fim.<br />
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
          <p className="hero__tag" aria-hidden="true">Estuda. Dispara. Domina.</p>
        </div>

        <div
          className="scene"
          role="img"
          aria-label="A nave do Kixi a disparar contra temas e problemas de estudo: Subnetting, VLANs, Binário e Roteamento"
        >
          <div className="scene__hud" aria-hidden="true">
            <span>NÍV 7</span>
            <span>1.240 XP</span>
            <span>SEQ 12</span>
          </div>
          <div className="scene__formation" aria-hidden="true">
            {TARGETS.map((t, i) => (
              <div key={t.label} className={`scene__col scene__col--${t.hue}`} style={{ ['--i' as string]: i }}>
                <Bug className="scene__bug" width={52} />
                <span className="scene__label">{t.label}</span>
                <span className="scene__shot" />
              </div>
            ))}
          </div>
          <div className="scene__ship" aria-hidden="true">
            <Logo size={64} />
          </div>
        </div>
      </div>
    </section>
  );
}
