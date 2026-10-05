'use client';

import { useState } from 'react';
import { Avatar } from '@/components/ui';
import { ranking } from '@/lib/data';

const SCOPES = ['Turma', 'Escola', 'Amigos'] as const;

export default function Turma() {
  const [scope, setScope] = useState<(typeof SCOPES)[number]>('Turma');
  const data = ranking[scope];
  return (
    <div className="page page--wide">
      <div className="col">
        <div className="pagehead"><div><h1>{data.title}</h1><p>Média das simulações deste período. Vês o topo e quem está perto de ti.</p></div></div>
        <div className="tabs" role="tablist" aria-label="Comparar com">
          {SCOPES.map((s) => <button key={s} type="button" role="tab" className="tab" aria-selected={s === scope} onClick={() => setScope(s)}>{s}</button>)}
        </div>
        <section className="card" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead><tr><th scope="col">#</th><th scope="col">Aluno</th><th scope="col" className="r hide-s">Provas</th><th scope="col" className="r">Média</th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.name} className={'you' in r && r.you ? 'is-you' : undefined}>
                  <td className="pos num">{r.rank}</td>
                  <td><span className="who"><Avatar name={r.name} size={32} />{r.name}{'you' in r && r.you ? ' (tu)' : ''}<span className="school hide-s">{r.school}</span></span></td>
                  <td className="r num hide-s">{r.exams}</td>
                  <td className="r num">{r.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
