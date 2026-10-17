'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Send } from 'lucide-react';
import { Page, PageHeader } from '@/components/page';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
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
    <Page className="flex min-h-dvh flex-col pb-0 md:pb-0">
      <PageHeader title="Tutor" subtitle="P1 de Redes (ITEL 2024), questão 3. As respostas citam a prova." />
      <div className="flex flex-1 flex-col gap-4 px-4 py-4 pb-4" role="log" aria-live="polite" aria-label="Conversa com o tutor">
        {msgs.map((m, i) => (
          <div key={i} className={cn('flex max-w-[92%] gap-2.5', m.from === 'student' && 'flex-row-reverse self-end')}>
            {m.from === 'tutor'
              ? <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">K</span>
              : <UserAvatar name={me.name} size={36} className="max-md:hidden" />}
            <div className={cn('rounded-2xl px-4 py-2.5 leading-relaxed', m.from === 'student' ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-secondary')}>
              {m.text}
              {m.source && <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><FileText className="size-3.5" />Fonte: {m.source}</div>}
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="sticky bottom-[53px] grid gap-2.5 border-t bg-background/95 p-3 backdrop-blur md:bottom-0 md:px-4">
        <div className="flex flex-wrap gap-2">{tutorChips.map((c) => <Button key={c} type="button" variant="outline" size="sm" className="text-muted-foreground" onClick={() => send(c)}>{c}</Button>)}</div>
        <form className="flex gap-2.5" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreve a tua resposta ou dúvida" aria-label="Mensagem para o tutor" className="h-11 rounded-full bg-secondary px-4" />
          <Button type="submit" size="lg" aria-label="Enviar" className="max-sm:px-4" disabled={!text.trim()}><Send /><span className="max-sm:hidden">Enviar</span></Button>
        </form>
      </div>
    </Page>
  );
}
