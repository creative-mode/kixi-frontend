import Link from 'next/link';
import { MessageCircle, Send } from 'lucide-react';
import { Page, PageHeader, Section } from '@/components/page';
import { Mastery } from '@/components/mastery';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { result } from '@/lib/data';

export const metadata = { title: 'Resultado · Kixi' };

export default function Resultado() {
  return (
    <Page>
      <PageHeader title="Resultado" subtitle={result.title} back="/provas" />

      <Section>
        <div className="flex flex-wrap items-end gap-x-3.5 gap-y-2">
          <span className="text-[56px] leading-[.95] font-bold tracking-tighter tabular-nums">{result.score}</span>
          <span className="pb-1.5 text-lg font-semibold text-muted-foreground">de 20 valores</span>
          <Badge variant="success" className="mb-2">{result.delta}</Badge>
        </div>
      </Section>

      <div className="grid grid-cols-3 divide-x border-b">
        {[[result.correct, 'certas'], [result.time, 'tempo'], [result.place, 'na turma']].map(([v, l]) => (
          <div key={l} className="px-4 py-3.5"><b className="block text-xl tracking-tight tabular-nums">{v}</b><span className="text-[13px] text-muted-foreground">{l}</span></div>
        ))}
      </div>

      <Section title="Domínio por tema"><div className="grid gap-3.5">{result.topics.map((t) => <Mastery key={t.label} label={t.label} value={t.value} />)}</div></Section>

      <section aria-label="Questões a rever">
        <h2 className="px-4 pt-4 pb-2 text-xl font-bold tracking-tight">Questões a rever</h2>
        {result.wrong.map((w) => (
          <div className="flex items-center gap-3 border-t px-4 py-3.5" key={w.q}>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-danger-soft text-[13px] font-bold text-destructive">{w.q}</span>
            <div className="min-w-0 flex-1 leading-snug"><b className="block">{w.text}</b><span className="text-[13px] text-muted-foreground">{w.topic}</span></div>
            <Button asChild variant="outline" size="sm"><Link href="/tutor">Ver explicação</Link></Button>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap gap-2.5 border-t px-4 py-4">
        <Button asChild><Link href="/tutor"><MessageCircle />Rever erros com o tutor</Link></Button>
        <Button asChild variant="outline"><Link href="/inicio"><Send />Partilhar com a turma</Link></Button>
        <Button asChild variant="ghost" className="text-primary"><Link href="/provas">Voltar às provas</Link></Button>
      </div>
    </Page>
  );
}
