'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AnswerOption, Button, QuestionMap, Timer } from '@/components/kixi';
import { question, questionCells } from '@/lib/data';

export default function SalaProva() {
  const [sel, setSel] = useState<number | undefined>();

  return (
    <div className="screen kx-lcd" data-theme="dark">
      <header className="screen__head screen__head--line">
        <Link href="/provas" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, font: '600 14px/1 var(--font-sans)', color: 'var(--alvo-ink)' }}>Sair da sala</Link>
        <span className="eyebrow">P1 · Redes</span>
      </header>
      <main className="screen__main page--wide">
        <div className="room">
        <div className="room__side stack" style={{ gap: 16 }}>
        <Timer time="42:10" progress={0.7} extra="+25% tempo" />
        <QuestionMap cells={questionCells} legend={false} />
        </div>
        <div className="room__main stack" style={{ gap: 16 }}>
        <div className="stack" style={{ gap: 8 }}>
          <span className="eyebrow">Questão {question.number} de {question.total} · {question.points} valores</span>
          <p style={{ margin: 0, font: '400 17px/28px var(--font-sans)' }}>{question.text}</p>
        </div>
        <div className="stack" style={{ gap: 10 }} role="group" aria-label="Respostas">
          {question.options.map((text, i) => (
            <AnswerOption key={text} letter={'ABCD'[i]} state={sel === i ? 'selected' : 'idle'} onClick={() => setSel(i)}>{text}</AnswerOption>
          ))}
        </div>
        {sel !== undefined && <p className="muted" style={{ margin: 0, font: '400 14px/22px var(--font-sans)' }} role="status">Resposta guardada. Podes mudar até entregares a prova.</p>}
        </div>
        </div>
      </main>
      <footer className="screen__foot">
        <Button variant="secondary">Saltar</Button>
        <span className="kx-btn-wrap kx-scope" style={{ flexGrow: 1 }}>
          <Link href="/resultado" className="kx-btn btnlink"><span className="kx-btn__label">Confirmar resposta</span></Link>
        </span>
      </footer>
    </div>
  );
}
