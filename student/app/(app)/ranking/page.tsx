'use client';

import { useState } from 'react';
import { BellRing, Check, Flame, Info } from 'lucide-react';
import { Page, PageHeader, Section } from '@/components/page';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { handle, league, me, type LeagueGroup } from '@/lib/data';
import { cn } from '@/lib/utils';

const SCOPES = ['Turma', 'Escola', 'Amigos'] as const;

const TONE: Record<LeagueGroup['tone'], string> = {
  up: 'bg-accent text-accent-foreground',
  stay: 'bg-secondary text-muted-foreground',
  down: 'bg-danger-soft text-destructive',
  plain: 'bg-secondary text-muted-foreground',
};

export default function Liga() {
  const [scope, setScope] = useState<(typeof SCOPES)[number]>('Turma');
  const [nudged, setNudged] = useState(false);
  const groups = league.scopes[scope];
  const pair = league.pair;
  const first = pair.name.split(' ')[0];

  return (
    <Page>
      <PageHeader title={league.name} subtitle={`Termina em ${league.ends}. Os ${league.upCount} primeiros sobem para a Liga Prata.`} />

      <Section>
        <p className="text-[32px] leading-tight font-bold tracking-tight">Estás em {league.rank}.º <span className="text-lg font-semibold text-muted-foreground">de {league.size}</span></p>
        <Progress className="my-3" value={((league.size - league.rank) / (league.size - league.upCount)) * 100} aria-label="Caminho até à zona de subida" />
        <p className="text-[15px] text-muted-foreground">Faltam {league.toGo} pontos para entrares na zona de subida.</p>
        <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" />Contam treino, dúvidas respondidas e ajuda aos colegas. As notas não entram.</p>
      </Section>

      <Tabs value={scope} onValueChange={(v) => setScope(v as (typeof SCOPES)[number])}>
        <TabsList aria-label="Comparar com">{SCOPES.map((s) => <TabsTrigger key={s} value={s}>{s}</TabsTrigger>)}</TabsList>
      </Tabs>

      {groups.map((g) => (
        <section key={g.label}>
          <div className={cn('flex items-center justify-between border-b px-4 py-2 text-xs font-bold', TONE[g.tone])}><span>{g.label}</span>{g.tone === 'up' && <span>pontos de esforço</span>}</div>
          <ol>
            {g.rows.map((r) => (
              <li key={r.name} className={cn('flex min-h-[60px] items-center gap-3 border-b px-4 py-2', r.you && 'bg-accent/60 font-bold')}>
                <span className="w-7 text-[15px] font-bold text-muted-foreground tabular-nums">{r.rank}</span>
                <UserAvatar name={r.name} size={40} />
                <span className="min-w-0 flex-1 leading-tight"><span className="block truncate font-bold">{r.you ? 'Tu' : r.name}</span><span className="block truncate text-[13px] font-normal text-muted-foreground">{handle(r.name)}</span></span>
                <span className="text-[15px] font-semibold tabular-nums">{r.points}</span>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <section aria-label="Dupla de estudo" className="m-4 grid gap-4 rounded-2xl bg-secondary px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight">Dupla de estudo</h2>
          <span className="flex items-center gap-1.5 text-sm font-bold"><Flame className="size-4 text-warning" />{pair.streak} dias</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3"><span className="relative"><UserAvatar name={me.name} size={44} /><span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full border-2 border-secondary bg-primary text-primary-foreground"><Check className="size-3" strokeWidth={3} /></span></span><span className="text-[13px] leading-tight text-muted-foreground">Tu<br />já treinaste</span></div>
          <div className="flex items-center gap-3"><UserAvatar name={pair.name} size={44} className="opacity-60" /><span className="text-[13px] leading-tight text-muted-foreground">{first}<br />ainda não</span></div>
        </div>
        <Button disabled={nudged} onClick={() => setNudged(true)} size="lg">
          <BellRing />{nudged ? `Toque enviado ao ${first}` : `Dar um toque ao ${first}`}
        </Button>
        <p className="text-center text-xs text-muted-foreground">{nudged ? 'Amanhã podes dar outro.' : '1 toque por dia, para ninguém se sentir pressionado.'}</p>
      </section>
    </Page>
  );
}
