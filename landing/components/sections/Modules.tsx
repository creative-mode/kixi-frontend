import { MODULES } from '@/lib/content';

export function Modules() {
  return (
    <section className="sec sec--paper" id="modulos" aria-labelledby="mod-title">
      <div className="wrap">
        <header className="sec__head">
          <h2 id="mod-title" className="h2">Cinco módulos, um só sítio.</h2>
        </header>
        <ol className="mod">
          {MODULES.map((m) => (
            <li key={m.n} className="mod__item">
              <p className="mod__tag"><span aria-hidden="true">{m.n}</span><span className="sr-only">Módulo {m.n}:</span> {m.title}</p>
              <h3 className="mod__head">{m.headline}</h3>
              <p className="mod__text">{m.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
