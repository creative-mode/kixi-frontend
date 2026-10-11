'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FileText, Send } from 'lucide-react';
import { Column, Page, PageHeader } from '@/components/page';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { tutorChat, tutorChips } from '@/lib/data';
import { useMe } from '@/lib/me-context';
import { fullName } from '@/lib/profile';

type Msg = { from: 'student' | 'tutor'; text: string; source?: string };

/**
 * The conversation, which stays a client component: the input and the optimistic
 * answer are state. What the server owns is the paper, and that arrives as props.
 *
 * `paperTitle` is what makes "estudo assistido" mean something — the tutor is opened
 * from the detail screen with `?statementId=X`, and the header says which paper it is
 * about. Null when the student came straight to /tutor: the chat still works, it just
 * does not claim to be about a particular paper.
 *
 * The messages are still `lib/data.ts`. The real tutor is #28: this only fixes the
 * context, not the conversation.
 */
export function TutorChat({ statementId, paperTitle }: { statementId?: number; paperTitle?: string | null }) {
  const me = useMe();
  const [msgs, setMsgs] = useState<Msg[]>([...tutorChat] as Msg[]);
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs]);

  // Sem `source` de propósito: a conversa é a simulada de `lib/data.ts`, que responde
  // sobre uma sub-rede fixa. Citar «enunciado 1» por cima dela apagaria que a resposta
  // é deitada à mão. As fontes verdadeiras chegam com o tutor de streaming, na #28.

  const send = (value: string) => {
    const v = value.trim();
    if (!v) return;
    setMsgs((m) => [...m, { from: 'student', text: v }, { from: 'tutor', text: 'Vamos por passos: a sub-rede seguinte começa onde a anterior termina. Qual é o último endereço do bloco de 64?' }]);
    setText('');
  };

  const description = paperTitle
    ? `Sobre ${paperTitle}.`
    : 'Pergunta o que quiseres estudar.';

  return (
    <Page>
      <Column className="gap-5">
        <PageHeader
          kicker={paperTitle ? 'Estudo assistido' : undefined}
          title="Tutor"
          description={description}
        />
        {statementId != null && paperTitle && (
          <div className="-mt-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/prova/${statementId}/detalhe`}><FileText aria-hidden />Voltar à prova</Link>
            </Button>
          </div>
        )}
        <Card className="min-h-[calc(100dvh-230px)] gap-0 py-0" aria-label="Conversa com o tutor">
          <div className="flex flex-1 flex-col gap-4 p-4 md:p-5" role="log" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={cn('flex max-w-[94%] gap-2.5 md:max-w-[86%]', m.from === 'student' && 'flex-row-reverse self-end')}>
                {m.from === 'tutor'
                  ? <span className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-[13px] font-bold text-background" aria-hidden="true">K</span>
                  : <UserAvatar name={fullName(me)} size={32} className="max-md:hidden" />}
                <div className={cn('rounded-xl border px-3.5 py-2.5 leading-relaxed', m.from === 'student' ? 'border-primary bg-primary text-primary-foreground' : 'bg-secondary')}>
                  {m.text}
                  {m.source && <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><FileText className="size-3.5" />Fonte: {m.source}</div>}
                </div>
              </div>
            ))}
            <div ref={end} />
          </div>
          <div className="grid gap-2.5 border-t p-3.5 md:px-5">
            <div className="flex flex-wrap gap-2">{tutorChips.map((c) => <Button key={c} type="button" variant="outline" size="sm" className="rounded-full text-muted-foreground" onClick={() => send(c)}>{c}</Button>)}</div>
            <form className="flex gap-2.5" onSubmit={(e) => { e.preventDefault(); send(text); }}>
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreve a tua resposta ou dúvida" aria-label="Mensagem para o tutor" />
              <Button type="submit" disabled={!text.trim()}><Send />Enviar</Button>
            </form>
          </div>
        </Card>
      </Column>
    </Page>
  );
}
