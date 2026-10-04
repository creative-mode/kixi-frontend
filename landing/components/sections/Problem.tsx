import { Icon } from '@/components/kixi';
import { ENEMIES } from '@/lib/content';
import { Bug } from './Bug';

export function Problem() {
  return (
    <section className="section section--paper" id="problema" aria-labelledby="problem-title">
      <div className="wrap">
        <p className="eyebrow">O problema</p>
        <h2 id="problem-title" className="h2">Durante anos, estudar para provas foi um desafio silencioso.</h2>
        <p className="lead lead--narrow">
          Várias gerações de estudantes do ITEL tiveram de lidar com provas antigas difíceis de aceder e de organizar. O estudo ficou fragmentado e roubou tempo, energia e confiança. O Kixi aponta a nave a cada um destes problemas.
        </p>
        <ul className="enemies">
          {ENEMIES.map((e) => (
            <li key={e.label} className={`enemy hue-${e.hue}`}>
              <Bug className="enemy__bug" width={64} />
              <span className="enemy__label">{e.label}</span>
              <span className="enemy__arrow" aria-hidden="true"><Icon name="shot" size={20} /></span>
              <span className="enemy__fix">{e.fix}</span>
              <p className="enemy__hint">{e.hint}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
