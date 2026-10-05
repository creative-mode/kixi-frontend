'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon, Avatar } from '@/components/ui';
import { me, tutorChat, tutorChips } from '@/lib/data';

type Msg = { from: 'student' | 'tutor'; text: string; source?: string };

export default function Tutor() {
  const [msgs, setMsgs] = useState<Msg[]>([...tutorChat] as Msg[]);
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs]);

  const send = (value: string) => {
    const v = value.trim();
    if (!v) return;
    setMsgs((m) => [...m, { from: 'student', text: v }, { from: 'tutor', source: 'P1 · ITEL 2024 · Q3', text: 'Vamos por passos: a sub-rede seguinte começa onde a anterior termina. Qual é o último endereço do bloco de 64?' }]);
    setText('');
  };

  return (
    <div className="page page--single">
      <div className="col">
        <div className="pagehead"><div><h1>Tutor</h1><p>A estudar a P1 de Redes (ITEL 2024), questão 3. As respostas citam a prova.</p></div></div>
        <section className="card chat" aria-label="Conversa com o tutor">
          <div className="chat__log" role="log" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={`msg${m.from === 'student' ? ' msg--me' : ''}`}>
                {m.from === 'tutor' ? <span className="tutor-badge" aria-hidden="true">K</span> : <Avatar name={me.name} size={32} />}
                <div className="msg__bubble">
                  {m.text}
                  {m.source && <div className="msg__src"><Icon name="file" size={14} />Fonte: {m.source}</div>}
                </div>
              </div>
            ))}
            <div ref={end} />
          </div>
          <div className="chat__foot">
            <div className="chips">{tutorChips.map((c) => <button key={c} type="button" className="chip" onClick={() => send(c)}>{c}</button>)}</div>
            <form className="chat__form" onSubmit={(e) => { e.preventDefault(); send(text); }}>
              <input className="composer__input" style={{ borderRadius: 8 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreve a tua resposta ou dúvida" aria-label="Mensagem para o tutor" />
              <button type="submit" className="btn" disabled={!text.trim()}><Icon name="send" size={18} />Enviar</button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
