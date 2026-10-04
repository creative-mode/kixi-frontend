import { Icon } from '@/components/kixi';
import { ENEMIES } from '@/lib/content';
import { Bug } from './Bug';

export function Problem() {
  return (
    <section className="section" id="problema" aria-labelledby="problem-title">
      <div className="wrap">
        <p className="eyebrow">O problema</p>
        <h2 id="problem-title" className="h2">Durante anos, estudar para provas foi um desafio silencioso.</h2>
        <p className="lead lead--narrow">
          Várias gerações de estudantes do ITEL tiveram de lidar com provas antigas difíceis de aceder e de organizar. O estudo ficou fragmentado e roubou tempo, energia e confiança. O Kixi aponta a nave a cada um destes problemas.
        </p>
        <ul className="enemies">
          {ENEMIES.map((e) => (
            <li key={e.label} className={`enemy hue-${e.hue}`}>
              <div className="enemy__top">
                <Bug className="enemy__bug" width={44} />
                <span className="enemy__label">{e.label}</span>
              </div>
              <div className="enemy__fix">
                <Icon name="shot" size={16} />
                <span>{e.fix}</span>
              </div>
              <p className="enemy__hint">{e.hint}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
