'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Camera, Search } from 'lucide-react';
import { Page, PageHeader } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    <Page>
      <PageHeader title="Provas" subtitle="Simula provas anteriores e vê onde precisas de reforçar." />

      <div className="border-b px-4 py-4">
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-dashed border-input px-4 py-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Camera className="size-5" /></span>
          <p className="min-w-[200px] flex-1 text-sm text-muted-foreground"><b className="block text-[15px] text-foreground">Carregar uma prova</b>Tira uma foto ou envia o PDF. O Kixi lê as questões e cria a simulação.</p>
          <Button variant="outline">Escolher ficheiro</Button>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground" />
          <Input type="search" aria-label="Procurar provas" className="h-11 rounded-full border-transparent bg-secondary pl-11" placeholder="Procurar por disciplina, escola ou ano" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as (typeof subjects)[number])}>
        <TabsList aria-label="Filtrar por disciplina">{subjects.map((s) => <TabsTrigger key={s} value={s}>{s}</TabsTrigger>)}</TabsList>
      </Tabs>

      <section aria-label="Provas disponíveis">
        {list.map((e) => (
          <Link key={e.id} href={`/prova/${e.id}`} aria-label={`${action(e)}: ${e.kind} ${e.title}`} className="flex gap-3 border-b px-4 py-3.5 transition-colors hover:bg-secondary/40">
            <span className="grid h-10 min-w-10 shrink-0 place-items-center rounded-full bg-accent px-2 text-[13px] font-bold text-accent-foreground">{e.kind}</span>
            <div className="grid min-w-0 flex-1 gap-2">
              <div><div className="leading-snug font-bold">{e.title}</div><div className="text-[13px] text-muted-foreground">{e.school} · {e.year} · {e.subject}</div></div>
              <State e={e} />
            </div>
            <span className="inline-flex h-9 shrink-0 items-center self-center rounded-full border border-input px-4 text-sm font-semibold">{action(e)}</span>
          </Link>
        ))}
        {list.length === 0 && (
          <div className="grid justify-items-center gap-1 px-5 py-12 text-center text-sm text-muted-foreground"><b className="text-foreground">Nenhuma prova encontrada</b><span>Muda o filtro ou carrega a prova que procuras.</span></div>
        )}
      </section>
    </Page>
  );
}
