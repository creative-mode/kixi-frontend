'use client';

import { useState } from 'react';
import { Leaderboard } from '@/components/kixi';
import { ranking } from '@/lib/data';

const SCOPES = ['Turma', 'Escola', 'Amigos'] as const;

export default function Ranking() {
  const [scope, setScope] = useState<(typeof SCOPES)[number]>('Turma');
  const data = ranking[scope];
  return (
    <>
      <header className="screen__head" style={{ flexDirection: 'column', alignItems: 'stretch', paddingBottom: 8 }}>
        <h1 className="h1">Ranking</h1>
        <div className="seg" role="group" aria-label="Âmbito">
          {SCOPES.map((s) => <button key={s} type="button" aria-pressed={s === scope} onClick={() => setScope(s)}>{s}</button>)}
        </div>
      </header>
      <main className="screen__main" style={{ paddingTop: 8 }}>
        <Leaderboard title={data.title} scope="Redes · esta semana" resets="Reinicia em 3 dias" gap="Faltam 0,4 para o 4.º lugar" rows={data.rows as unknown as object[]} />
        <p className="muted" style={{ margin: 0, font: '400 13px/20px var(--font-sans)' }}>Mostra o topo e quem está perto de ti. Ninguém vê os últimos lugares.</p>
      </main>
    </>
  );
}
