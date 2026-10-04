import { MODULES } from '@/lib/content';

export function Modules() {
  return (
    <section className="sec sec--deep" id="solucao" aria-labelledby="modules-title">
      <div className="wrap">
        <header className="sec__head">
          <p className="eyebrow">A solução</p>
          <h2 id="modules-title" className="h2">Cinco módulos. Um só objetivo.</h2>
        </header>
        <ol className="levels">
          {MODULES.map((m) => (
            <li key={m.n} className="level">
              <span className="level__tag">{m.n} · {m.title}</span>
              <span className="level__line">{m.line}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
