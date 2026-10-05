'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/ui';
import { exams, subjects, type Exam } from '@/lib/data';

function State({ e }: { e: Exam }) {
  if (e.state === 'progress') {
    return (
      <div className="row__state">
        <span className="tag tag--warn"><span className="tag__dot" />Em curso · {e.done}/{e.total}</span>
        <div className="bar bar--warn"><span style={{ width: `${((e.done ?? 0) / (e.total ?? 1)) * 100}%` }} /></div>
      </div>
    );
  }
  if (e.state === 'done') {
    return (
      <div className="row__state">
        <span className="tag tag--good"><span className="tag__dot" />Concluída · {e.score}</span>
        <div className="bar"><span style={{ width: `${e.mastery}%` }} /></div>
      </div>
    );
  }
  return (
    <div className="row__state">
      <span className="tag tag--info"><span className="tag__dot" />{e.mastery ? `Nova · domínio ${e.mastery}%` : 'Nova'}</span>
      {e.mastery ? <div className="bar bar--bad"><span style={{ width: `${e.mastery}%` }} /></div> : null}
    </div>
  );
}

export default function Provas() {
  const [filter, setFilter] = useState<(typeof subjects)[number]>('Todas');
  const [q, setQ] = useState('');
  const list = exams.filter((e) => (filter === 'Todas' || e.subject === filter) && (e.title + e.school + e.year + e.subject).toLowerCase().includes(q.toLowerCase()));
  const action = (e: Exam) => (e.state === 'progress' ? 'Continuar' : e.state === 'done' ? 'Ver resultado' : 'Começar');

  return (
    <div className="page page--wide">
      <div className="col">
        <div className="pagehead">
          <div><h1>Provas</h1><p>Simula provas anteriores e vê onde precisas de reforçar.</p></div>
        </div>

        <div className="upload">
          <span className="upload__icon"><Icon name="camera" size={22} /></span>
          <p style={{ flex: 1, minWidth: 200 }}><b>Carregar uma prova</b>Tira uma foto ou envia o PDF. O Kixi lê as questões e cria a simulação.</p>
          <button type="button" className="btn btn--ghost">Escolher ficheiro</button>
        </div>

        <label className="search">
          <Icon name="search" size={18} />
          <span className="sr-only">Procurar provas</span>
          <input className="field__input" type="search" placeholder="Procurar por disciplina, escola ou ano" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="chips" role="group" aria-label="Filtrar por disciplina">
          {subjects.map((s) => <button key={s} type="button" className="chip" aria-pressed={s === filter} onClick={() => setFilter(s)}>{s}</button>)}
        </div>

        <section className="card list" aria-label="Provas disponíveis">
          {list.map((e) => (
            <Link key={e.id} href={`/prova/${e.id}`} className="row" aria-label={`${action(e)}: ${e.kind} ${e.title}`}>
              <div><div className="row__title">{e.kind} · {e.title}</div><div className="row__meta">{e.school} · {e.year} · {e.subject}</div></div>
              <State e={e} />
              <span className="btn btn--ghost btn--sm">{action(e)}</span>
            </Link>
          ))}
          {list.length === 0 && (
            <div className="empty"><b>Nenhuma prova encontrada</b><span>Muda o filtro ou carrega a prova que procuras.</span></div>
          )}
        </section>
      </div>
    </div>
  );
}
