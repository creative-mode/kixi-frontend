'use client';

import { useState } from 'react';
import { Button, ChatBubble, Field } from '@/components/kixi';
import { tutorChat, tutorChips } from '@/lib/data';

type Msg = { from: 'student' | 'tutor'; text: string; source?: string };

export default function Tutor() {
  const [msgs, setMsgs] = useState<Msg[]>([...tutorChat] as Msg[]);
  const [text, setText] = useState('');

  const send = (value: string) => {
    const v = value.trim();
    if (!v) return;
    setMsgs((m) => [...m, { from: 'student', text: v }, { from: 'tutor', source: 'P1 · ITEL 2024 · Q3', text: 'Vamos por passos: a sub-rede seguinte começa onde a anterior termina. Qual é o último endereço do bloco de 64?' }]);
    setText('');
  };

  return (
    <>
      <header className="screen__head screen__head--line" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <h1 className="h1">Tutor</h1>
        <p className="muted" style={{ margin: 0, font: '400 13px/20px var(--font-sans)' }}>A estudar: P1 Redes · ITEL 2024 · questão 3</p>
      </header>
      <main className="screen__main" style={{ gap: 14 }}>
        {msgs.map((m, i) => <ChatBubble key={i} from={m.from} source={m.source}>{m.text}</ChatBubble>)}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {tutorChips.map((c) => <button key={c} type="button" className="chip" onClick={() => send(c)}>{c}</button>)}
        </div>
      </main>
      <form className="screen__foot" style={{ alignItems: 'flex-end', gap: 10, padding: '12px 20px', borderTop: '1px solid var(--line)' }} onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <div style={{ flexGrow: 1 }}><Field label="Mensagem" placeholder="Escreve a tua resposta" value={text} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value)} /></div>
        <Button type="submit" icon="shot" aria-label="Enviar">Enviar</Button>
      </form>
    </>
  );
}
