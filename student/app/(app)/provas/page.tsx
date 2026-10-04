'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ExamCard, Field, Icon } from '@/components/kixi';
import { exams, subjects } from '@/lib/data';

export default function Provas() {
  const [filter, setFilter] = useState<(typeof subjects)[number]>('Todas');
  const [q, setQ] = useState('');
  const list = exams.filter((e) => (filter === 'Todas' || e.subject === filter) && (e.title + e.school + e.year).toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <header className="screen__head" style={{ paddingBottom: 8 }}>
        <h1 className="h1">Provas</h1>
        <span className="kx-btn-wrap kx-scope">
          <Link href="/provas" className="kx-btn kx-btn--secondary kx-btn--sm" style={{ textDecoration: 'none', font: '600 13px/1 var(--font-sans)' }}>
            <span className="kx-btn__label"><Icon name="camera" size={16} />Carregar prova</span>
          </Link>
        </span>
      </header>
      <main className="screen__main" style={{ paddingTop: 8 }}>
        <Field label="Procurar" type="search" placeholder="Disciplina, escola ou ano" value={q} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="group" aria-label="Filtrar">
          {subjects.map((s) => <button key={s} type="button" className="chip" aria-pressed={s === filter} onClick={() => setFilter(s)}>{s}</button>)}
        </div>
        {list.map((e) => (
          <Link key={e.id} href={`/prova/${e.id}`} className="linkbtn" aria-label={`Abrir ${e.title}`}>
            <ExamCard kind={e.kind} title={e.title} subject={e.subject} school={e.school} year={e.year} status={e.status} statusTone={e.tone} mastery={e.mastery} />
          </Link>
        ))}
        {list.length === 0 && <p className="muted" style={{ margin: 0 }}>Nenhuma prova encontrada. Carrega uma foto da prova e o Kixi lê as questões.</p>}
      </main>
    </>
  );
}
