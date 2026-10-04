import { Icon } from '@/components/kixi';
import { MODULES } from '@/lib/content';

export function Modules() {
  return (
    <section className="modules-sec" data-theme="dark" id="solucao" aria-labelledby="modules-title">
      <div className="wrap modules-sec__head">
        <p className="eyebrow">A solução</p>
        <h2 id="modules-title" className="h2">Cinco módulos que trabalham juntos.</h2>
        <p className="lead lead--narrow">
          O Kixi centraliza enunciados, permite simulá-los e analisa o desempenho, com um módulo de IA que automatiza o trabalho manual e torna o estudo mais motivador.
        </p>
        </div>
      <ol className="bands">
        {MODULES.map((m, i) => (
          <li key={m.n} className={`band band--${i + 1}`} style={{ ['--i' as string]: i }}>
            <div className="wrap band__in">
              <span className="band__n" aria-hidden="true">{m.n}</span>
              <div className="band__main">
                <p className="band__tag"><Icon name={m.icon} size={18} />{m.title}</p>
                <h3 className="band__title">{m.headline}</h3>
              </div>
              <p className="band__text">{m.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
