import Link from 'next/link';
import { MessageCircle, Send } from 'lucide-react';
import { Column, Page, PageHeader } from '@/components/page';
import { Mastery } from '@/components/mastery';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { result } from '@/lib/data';

export const metadata = { title: 'Resultado · Kixi' };

export default function Resultado() {
  return (
    <Page>
      <Column className="gap-5">
        <PageHeader kicker="Resultado" title={result.title} />

        <div className="flex flex-wrap items-end gap-x-3.5 gap-y-2">
          <span className="text-[52px] leading-[.95] font-bold tracking-tighter tabular-nums md:text-[64px]">{result.score}</span>
          <span className="pb-1.5 text-lg font-semibold text-muted-foreground">de 20 valores</span>
          <Badge variant="success" className="mb-2">{result.delta}</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[[result.correct, 'respostas certas'], [result.time, 'tempo gasto'], [result.place, 'posição na turma']].map(([v, l]) => (
            <Card key={l} className="gap-0.5 px-4 py-3.5"><b className="text-[22px] tracking-tight tabular-nums">{v}</b><span className="text-[13px] text-muted-foreground">{l}</span></Card>
          ))}
        </div>

        <Card><CardHeader><CardTitle>Domínio por tema</CardTitle></CardHeader>
          <CardContent className="grid gap-3.5">{result.topics.map((t) => <Mastery key={t.label} label={t.label} value={t.value} />)}</CardContent>
        </Card>

        <Card className="gap-0 py-0" aria-label="Questões a rever">
          <CardHeader className="pt-5 pb-3"><CardTitle>Questões a rever</CardTitle></CardHeader>
          <div className="divide-y border-t">
            {result.wrong.map((w) => (
              <div className="flex items-center gap-3.5 px-5 py-3.5" key={w.q}>
                <span className="grid size-[34px] shrink-0 place-items-center rounded-md bg-danger-soft text-[13px] font-bold text-destructive">{w.q}</span>
                <div className="min-w-0 flex-1 leading-snug"><b className="block text-sm">{w.text}</b><span className="text-[13px] text-muted-foreground">{w.topic}</span></div>
                <Button asChild variant="ghost" size="sm" className="text-primary"><Link href="/tutor">Ver explicação</Link></Button>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex flex-wrap gap-2.5">
          <Button asChild><Link href="/tutor"><MessageCircle />Rever erros com o tutor</Link></Button>
          <Button asChild variant="outline"><Link href="/inicio"><Send />Partilhar com a turma</Link></Button>
          <Button asChild variant="ghost" className="text-primary"><Link href="/provas">Voltar às provas</Link></Button>
        </div>
      </Column>
    </Page>
  );
}
