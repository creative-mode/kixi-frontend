'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Flame, Search } from 'lucide-react';
import { UserAvatar } from './user-avatar';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { goal, league, suggestions, topicsToReview, upcoming } from '@/lib/data';

/** Módulo da coluna direita: fundo cinza-verde claro, título grande e linhas clicáveis. */
export function Module({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn('shrink-0 overflow-hidden rounded-2xl bg-secondary', className)}>
      <h2 className="px-4 pt-3 pb-1 text-xl font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Follow({ name, meta }: { name: string; meta: string }) {
  const [on, setOn] = useState(false);
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <UserAvatar name={name} size={40} />
      <div className="min-w-0 flex-1 leading-tight"><div className="truncate font-bold">{name}</div><div className="truncate text-[13px] text-muted-foreground">{meta}</div></div>
      <Button size="sm" variant={on ? 'outline' : 'default'} className={cn(!on && 'bg-foreground text-background hover:bg-foreground/85')} aria-pressed={on} onClick={() => setOn((v) => !v)}>{on ? 'A seguir' : 'Seguir'}</Button>
    </div>
  );
}

export function RightRail() {
  return (
    <aside aria-label="Atalhos" className="sticky top-0 hidden h-dvh w-[340px] flex-none flex-col gap-4 overflow-y-auto py-3 pl-7 [scrollbar-width:none] lg:flex">
      <Link href="/provas" className="flex h-11 items-center gap-3 rounded-full bg-secondary px-4 text-muted-foreground hover:bg-muted"><Search className="size-[18px]" />Procurar provas</Link>

      <Module title="A tua meta">
        <div className="grid gap-2 px-4 pt-1 pb-4">
          <div className="flex items-baseline justify-between gap-3"><b className="flex items-center gap-1.5 text-lg"><Flame className="size-5 text-warning" />{goal.streak} dias seguidos</b><span className="text-[13px] text-muted-foreground tabular-nums">{goal.done} de {goal.target}</span></div>
          <Progress value={(goal.done / goal.target) * 100} aria-label="Meta diária" />
          <div className="flex items-center justify-between gap-3"><span className="text-[13px] text-muted-foreground">Faltam {goal.target - goal.done} questões hoje.</span><Button asChild size="sm" variant="outline"><Link href="/provas">Treinar</Link></Button></div>
        </div>
      </Module>

      <Module title="Em curso">
        <Link href="/prova/redes-p1" className="block px-4 pt-1 pb-4 hover:bg-muted">
          <div className="font-bold">P1 · Redes de Computadores</div>
          <div className="mb-2 text-[13px] text-muted-foreground">Questão 5 de 12 · 42 min restantes</div>
          <Progress value={(5 / 12) * 100} aria-label="Progresso da simulação" />
        </Link>
      </Module>

      <Module title={league.name}>
        <Link href="/ranking" className="block px-4 pt-1 pb-4 hover:bg-muted">
          <div className="flex items-baseline justify-between"><span className="text-[28px] leading-tight font-bold tracking-tight">{league.rank}.º<span className="ml-1 text-sm font-semibold text-muted-foreground">de {league.size}</span></span><span className="text-[13px] text-muted-foreground">termina em {league.ends}</span></div>
          <p className="mt-1 text-[13px] text-muted-foreground">Faltam {league.toGo} pontos para subir. Contam treino e ajuda, não notas.</p>
        </Link>
      </Module>

      <Module title="Para rever">
        {topicsToReview.map((t) => (
          <Link key={t.label} href="/tutor" className="block px-4 py-2.5 hover:bg-muted">
            <div className="text-[13px] text-muted-foreground">Domínio {t.value}%</div>
            <div className="font-bold">#{t.label}</div>
          </Link>
        ))}
        <Link href="/tutor" className="block px-4 py-3 text-primary hover:bg-muted">Rever com o tutor</Link>
      </Module>

      <Module title="Próximas provas">
        {upcoming.map((u) => (
          <div key={u.title} className="px-4 py-2.5">
            <div className="text-[13px] text-muted-foreground">{u.day} {u.month} · {u.meta}</div>
            <div className="font-bold">{u.title}</div>
          </div>
        ))}
        <div className="h-2" />
      </Module>

      <Module title="A quem seguir">
        {suggestions.map((s) => <Follow key={s.name} name={s.name} meta={s.meta} />)}
        <div className="h-2" />
      </Module>

      <p className="px-3 pb-4 text-[13px] text-muted-foreground">Termos · Privacidade · Ajuda · © 2026 Kixi</p>
    </aside>
  );
}
