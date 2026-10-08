'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Camera, Search } from 'lucide-react';
import { Column, Page, PageHeader } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { exams, subjects, type Exam } from '@/lib/data';

function State({ e }: { e: Exam }) {
  if (e.state === 'progress') {
    return (
      <div className="grid gap-1.5">
        <Badge variant="warning" className="justify-self-start">Em curso · {e.done}/{e.total}</Badge>
        <Progress value={((e.done ?? 0) / (e.total ?? 1)) * 100} indicatorClassName="bg-chart-2" aria-label="Progresso" />
      </div>
    );
  }
  if (e.state === 'done') {
    return (
      <div className="grid gap-1.5">
        <Badge variant="success" className="justify-self-start">Concluída · {e.score}</Badge>
        <Progress value={e.mastery ?? 0} aria-label="Domínio" />
      </div>
    );
  }
  return (
    <div className="grid gap-1.5">
      <Badge variant="info" className="justify-self-start">{e.mastery ? `Nova · domínio ${e.mastery}%` : 'Nova'}</Badge>
      {e.mastery ? <Progress value={e.mastery} indicatorClassName="bg-destructive" aria-label="Domínio" /> : null}
    </div>
  );
}

export default function Provas() {
  const [filter, setFilter] = useState<(typeof subjects)[number]>('Todas');
  const [q, setQ] = useState('');
  const list = exams.filter((e) => (filter === 'Todas' || e.subject === filter) && (e.title + e.school + e.year + e.subject).toLowerCase().includes(q.toLowerCase()));
  const action = (e: Exam) => (e.state === 'progress' ? 'Continuar' : e.state === 'done' ? 'Ver resultado' : 'Começar');

  return (
    <Page variant="wide">
      <Column className="gap-5">
        <PageHeader title="Provas" description="Simula provas anteriores e vê onde precisas de reforçar." />

        <div className="flex flex-wrap items-center gap-4 rounded-xl border-[1.5px] border-dashed border-input bg-card px-5 py-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Camera className="size-5" /></span>
          <p className="min-w-[200px] flex-1 text-sm text-muted-foreground"><b className="block text-[15px] text-foreground">Carregar uma prova</b>Tira uma foto ou envia o PDF. O Kixi lê as questões e cria a simulação.</p>
          <Button variant="outline">Escolher ficheiro</Button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-muted-foreground" />
          <Input type="search" aria-label="Procurar provas" className="pl-10" placeholder="Procurar por disciplina, escola ou ano" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por disciplina">
          {subjects.map((s) => (
            <Button key={s} type="button" variant="outline" size="sm" className="rounded-full text-muted-foreground aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-accent-foreground" aria-pressed={s === filter} onClick={() => setFilter(s)}>{s}</Button>
          ))}
        </div>

        <Card className="gap-0 divide-y overflow-hidden py-0" aria-label="Provas disponíveis">
          {list.map((e) => (
            <Link key={e.id} href={`/prova/${e.id}`} aria-label={`${action(e)}: ${e.kind} ${e.title}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-5 py-3.5 transition-colors hover:bg-secondary/60 sm:grid-cols-[minmax(0,1fr)_170px_120px]">
              <div className="min-w-0"><div className="leading-snug font-bold">{e.kind} · {e.title}</div><div className="mt-0.5 text-[13px] text-muted-foreground">{e.school} · {e.year} · {e.subject}</div></div>
              <div className="order-3 col-span-2 sm:order-none sm:col-span-1"><State e={e} /></div>
              <span className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-card px-3 text-sm font-semibold shadow-xs">{action(e)}</span>
            </Link>
          ))}
          {list.length === 0 && (
            <div className="grid justify-items-center gap-1 px-5 py-10 text-center text-sm text-muted-foreground"><b className="text-foreground">Nenhuma prova encontrada</b><span>Muda o filtro ou carrega a prova que procuras.</span></div>
          )}
        </Card>
      </Column>
    </Page>
  );
}
