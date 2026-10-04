import { Icon } from '@/components/kixi';
import { MODULES } from '@/lib/content';

export function Modules() {
  return (
    <section className="section section--sunken" id="solucao" aria-labelledby="modules-title">
      <div className="wrap">
        <p className="eyebrow">A solução</p>
        <h2 id="modules-title" className="h2">Cinco módulos que trabalham juntos.</h2>
        <p className="lead lead--narrow">
          O Kixi centraliza enunciados, permite simulá-los e analisa o desempenho, com um módulo de IA que automatiza o trabalho manual e torna o estudo mais motivador.
        </p>
        <ol className="modules">
          {MODULES.map((m) => (
            <li key={m.n} className={`module hue-${m.tone}`}>
              <div className="module__head">
                <span className="module__icon"><Icon name={m.icon} size={24} /></span>
                <span className="module__n">{m.n}</span>
              </div>
              <h3 className="module__title">{m.title}</h3>
              <p className="module__headline">{m.headline}</p>
              <p className="module__text">{m.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
