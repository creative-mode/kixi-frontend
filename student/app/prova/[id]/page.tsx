'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/ui';
import { question, questionCells } from '@/lib/data';

export default function SalaProva() {
  const [sel, setSel] = useState<number | undefined>();
  const [flag, setFlag] = useState(false);
  const cells = questionCells.map((c, i) => (i === question.number - 1 ? (flag ? 'flag' : sel !== undefined ? 'done' : c) : c));

  return (
    <div className="room">
      <header className="room__bar">
        <Link href="/provas" className="iconbtn" aria-label="Sair da prova"><Icon name="left" /></Link>
        <div className="room__title">P1 · Redes de Computadores<small>ITEL 2024 · simulação</small></div>
        <div className="room__timer" role="timer" aria-label="Tempo restante"><Icon name="clock" size={18} /><span className="num">42:10</span><small>+25% de tempo</small></div>
        <Link href="/resultado" className="btn btn--ghost btn--sm">Entregar</Link>
      </header>

      <div className="room__grid">
        <main className="card q" aria-labelledby="q-text">
          <div className="q__meta"><span>Questão {question.number} de {question.total}</span><span>{question.points} valores</span></div>
          <p id="q-text" className="q__text">{question.text}</p>
          <fieldset className="opts" aria-label="Respostas">
            {question.options.map((text, i) => (
              <label key={text} className="opt">
                <input type="radio" name="resp" checked={sel === i} onChange={() => setSel(i)} />
                <span className="opt__key">{'ABCD'[i]}</span><span className="num">{text}</span>
              </label>
            ))}
          </fieldset>
          {sel !== undefined && <p className="muted" style={{ fontSize: 14 }} role="status">Resposta guardada. Podes mudá-la até entregares a prova.</p>}
          <div className="q__foot">
            <button type="button" className="btn btn--ghost"><Icon name="left" size={18} />Anterior</button>
            <button type="button" className="btn btn--quiet" aria-pressed={flag} onClick={() => setFlag((f) => !f)}><Icon name="flag" size={18} />{flag ? 'Marcada para rever' : 'Marcar para rever'}</button>
            <span className="grow" />
            <button type="button" className="btn">Seguinte<Icon name="right" size={18} /></button>
          </div>
        </main>

        <aside className="card nav-q" aria-label="Questões">
          <h2 className="card__title">Questões</h2>
          <div className="nav-q__grid">
            {cells.map((s, i) => <button key={i} type="button" className="cell" data-s={s} aria-current={i === question.number - 1} aria-label={`Questão ${i + 1}${s === 'done' ? ', respondida' : s === 'flag' ? ', marcada' : ''}`}>{i + 1}</button>)}
          </div>
          <div className="legend"><span><i data-s="done" />Respondida</span><span><i data-s="flag" />Para rever</span><span><i />Por responder</span></div>
          <p className="muted" style={{ fontSize: 13 }}>{cells.filter((c) => c === 'done').length} de {question.total} respondidas</p>
        </aside>
      </div>
    </div>
  );
}
