import { ENEMIES } from '@/lib/content';
import { Sprite } from './Bug';

export function Problem() {
  return (
    <section className="sec sec--paper" id="problema" aria-labelledby="problem-title">
      <div className="wrap">
        <header className="sec__head">
          <h2 id="problem-title" className="h2">Estudar para provas sempre foi difícil.</h2>
          <p className="sec__sub">O Kixi aponta a nave a cada obstáculo.</p>
        </header>
        <ul className="enemies">
          {ENEMIES.map((e, i) => (
            <li key={e.label} className="enemy">
              <Sprite kind={i % 2 ? 'fly' : 'moth'} width={i % 2 ? 48 : 56} className="enemy__bug" />
              <span className="enemy__label">{e.label}</span>
              <span className="enemy__fix">{e.fix}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
