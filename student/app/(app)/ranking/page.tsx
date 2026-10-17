'use client';

import { useState } from 'react';
import { BellRing, Check, Flame, Info } from 'lucide-react';
import { Column, Page, PageHeader } from '@/components/page';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { league, me, type LeagueGroup } from '@/lib/data';
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

  return (
    <Page variant="wide">
      <Column className="gap-5">
        <PageHeader title={league.name} description={`Termina em ${league.ends}. Os ${league.upCount} primeiros sobem para a Liga Prata.`} />

        <Card className="gap-1 bg-primary px-5 py-5 text-primary-foreground">
          <p className="text-2xl leading-tight font-bold tracking-tight">Estás em {league.rank}.º de {league.size}</p>
          <p className="text-sm opacity-90">Faltam {league.toGo} pontos para entrares na zona de subida.</p>
        </Card>

        <p className="flex items-start gap-2.5 text-sm text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" />Contam treino, dúvidas respondidas e ajuda aos colegas. As notas não entram.</p>

        <Tabs value={scope} onValueChange={(v) => setScope(v as (typeof SCOPES)[number])}>
          <TabsList aria-label="Comparar com">{SCOPES.map((s) => <TabsTrigger key={s} value={s}>{s}</TabsTrigger>)}</TabsList>
        </Tabs>

        <Card className="gap-0 overflow-hidden py-0">
          {groups.map((g) => (
            <div key={g.label}>
              <div className={cn('flex items-center justify-between px-4 py-2 text-xs font-bold', TONE[g.tone])}><span>{g.label}</span>{g.tone === 'up' && <span>pontos de esforço</span>}</div>
              <ol>
                {g.rows.map((r) => (
                  <li key={r.name} className={cn('flex min-h-14 items-center gap-3 border-b px-4 py-2 last:border-b-0', r.you && 'border-y border-primary/40 bg-accent font-bold')}>
                    <span className="w-7 text-sm font-semibold text-muted-foreground tabular-nums">{r.rank}</span>
                    <UserAvatar name={r.name} size={36} />
                    <span className="min-w-0 flex-1 truncate">{r.you ? 'Tu' : r.name}</span>
                    <span className="text-sm font-semibold tabular-nums">{r.points}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </Card>

        <Card className="gap-4 border-2 border-foreground/80 px-5 py-5 shadow-[4px_4px_0_0_var(--foreground)]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold tracking-widest text-primary">DUPLA DE ESTUDO</span>
            <span className="flex items-center gap-1.5 text-sm font-bold"><Flame className="size-4" />{pair.streak} dias</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3"><span className="relative"><UserAvatar name={me.name} size={44} /><span className="absolute -right-1.5 -bottom-1.5 grid size-5 place-items-center rounded-md border-2 border-card bg-primary text-primary-foreground"><Check className="size-3" strokeWidth={3} /></span></span><span className="text-[13px] leading-tight text-muted-foreground">Tu<br />já treinaste</span></div>
            <div className="flex items-center gap-3"><UserAvatar name={pair.name} size={44} className="opacity-60" /><span className="text-[13px] leading-tight text-muted-foreground">{pair.name.split(' ')[0]}<br />ainda não</span></div>
          </div>
          <Button disabled={nudged} onClick={() => setNudged(true)} className="h-11">
            <BellRing />{nudged ? `Toque enviado ao ${pair.name.split(' ')[0]}` : `Dar um toque ao ${pair.name.split(' ')[0]}`}
          </Button>
          <p className="text-center text-xs text-muted-foreground">{nudged ? 'Amanhã podes dar outro.' : '1 toque por dia, para ninguém se sentir pressionado.'}</p>
        </Card>
      </Column>
    </Page>
  );
}


