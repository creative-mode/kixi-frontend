import { FLOW } from '@/lib/content';

/* Ilustrações do percurso, em HTML e CSS com os tokens do DS. São desenhos (aria-hidden):
   folhas, linhas e formas, sem números nem nomes inventados. */
function Illustration({ id }: { id: (typeof FLOW)[number]['id'] }) {
  if (id === 'foto') {
    return (
      <div className="ill ill--foto" aria-hidden="true">
        <div className="ill__paper">
          <i className="ill__line ill__line--head" /><i className="ill__line" /><i className="ill__line ill__line--short" />
          <i className="ill__line" /><i className="ill__line ill__line--short" /><i className="ill__line" />
        </div>
        <i className="ill__corner ill__corner--tl" /><i className="ill__corner ill__corner--tr" />
        <i className="ill__corner ill__corner--bl" /><i className="ill__corner ill__corner--br" />
        <i className="ill__scan" />
      </div>
    );
  }
  if (id === 'leitura') {
    return (
      <div className="ill ill--leitura" aria-hidden="true">
        <div className="ill__block"><i className="ill__line ill__line--dark" /><i className="ill__line ill__line--short" /></div>
        <div className="ill__opts">
          {['A', 'B', 'C', 'D'].map((k) => <span key={k} className="ill__opt"><b>{k}</b><i className="ill__line" /></span>)}
        </div>
      </div>
    );
  }
  if (id === 'simulacao') {
    return (
      <div className="ill ill--simulacao" aria-hidden="true">
        <svg className="ill__clock" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" />
          <circle className="ill__clock-run" cx="24" cy="24" r="20" pathLength="100" />
        </svg>
        <div className="ill__map">
          {Array.from({ length: 12 }, (_, i) => <i key={i} className={i < 7 ? 'is-on' : i === 7 ? 'is-now' : ''} />)}
        </div>
      </div>
    );
  }
  return (
    <div className="ill ill--tutor" aria-hidden="true">
      <span className="ill__bubble ill__bubble--me"><i className="ill__line" /><i className="ill__line ill__line--short" /></span>
      <span className="ill__bubble"><i className="ill__line ill__line--dark" /><i className="ill__line" /><i className="ill__line ill__line--short" /></span>
    </div>
  );
}

/** Do papel à simulação: o percurso de uma prova no Kixi. É o destino de «Solução». */
export function Flow() {
  return (
    <section className="sec sec--paper" id="solucao" aria-labelledby="flow-title">
      <div className="wrap">
        <header className="sec__head">
          <p className="sec__kicker">Do papel à simulação</p>
          <h2 id="flow-title" className="h2">A prova do teu professor, pronta para treinares.</h2>
        </header>
        <ol className="flow">
          {FLOW.map((s, i) => (
            <li key={s.id} className="flow__item">
              <Illustration id={s.id} />
              <p className="flow__n">Passo {i + 1}</p>
              <h3 className="flow__head">{s.head}</h3>
              <p className="flow__line">{s.line}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
