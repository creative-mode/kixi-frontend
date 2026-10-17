'use client';

import { useState } from 'react';
import { Check, LogOut, MessageCircle } from 'lucide-react';
import { sairAction } from '@/lib/auth-actions';
import { Page, PageHeader, Section } from '@/components/page';
import { Mastery } from '@/components/mastery';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { handle, me, result, topicsToReview } from '@/lib/data';

const TABS = ['Atividade', 'Desempenho', 'Guardados'] as const;
const DEFS = [
  { key: 'time', label: '+25% de tempo nas provas', hint: 'Ajuste de tempo para quem precisa.', def: true },
  { key: 'motion', label: 'Reduzir movimento', hint: 'Menos animações na interface.', def: false },
];
const ACTIVITY = [
  { t: 'Concluíste a P1 · Redes de Computadores', m: 'Nota 15,0 · há 2 dias', icon: Check },
  { t: 'Perguntaste na turma sobre subnetting', m: '3 respostas · há 4 dias', icon: MessageCircle },
  { t: 'Concluíste a P2 · Sistemas Operativos', m: 'Nota 16,4 · há 1 semana', icon: Check },
];

export default function Perfil() {
  const [on, setOn] = useState<Record<string, boolean>>(Object.fromEntries(DEFS.map((d) => [d.key, d.def])));

  return (
    <Page>
      <PageHeader title={me.name} subtitle="8 provas feitas" />

      <div className="h-32 bg-gradient-to-br from-accent to-secondary" />
      <div className="px-4 pb-3">
        <div className="-mt-12 flex items-end justify-between gap-3">
          <UserAvatar name={me.name} size={96} className="border-4 border-background" />
          <Button variant="outline">Editar perfil</Button>
        </div>
        <h1 className="mt-2 text-xl leading-tight font-extrabold tracking-tight">{me.name}</h1>
        <p className="text-[15px] text-muted-foreground">{handle(me.name)} · {me.escola} · {me.curso} · Turma {me.turma}</p>
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[15px] text-muted-foreground">{[['8', 'provas feitas'], ['15,0', 'média das simulações'], ['5.º', 'na turma']].map(([v, l]) => <span key={l}><b className="text-foreground tabular-nums">{v}</b> {l}</span>)}</p>
      </div>

      <Tabs defaultValue="Atividade">
        <TabsList aria-label="Perfil">{TABS.map((t) => <TabsTrigger key={t} value={t}>{t}</TabsTrigger>)}</TabsList>
        <TabsContent value="Atividade">
          {ACTIVITY.map((a) => (
            <div key={a.t} className="flex items-center gap-3.5 border-b px-4 py-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><a.icon className="size-[18px]" /></span>
              <div className="leading-snug"><b className="block">{a.t}</b><span className="text-[13px] text-muted-foreground">{a.m}</span></div>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="Desempenho">
          <Section title="Domínio por tema"><div className="grid gap-3.5">{[...result.topics, ...topicsToReview.filter((t) => !result.topics.some((r) => r.label === t.label))].map((t) => <Mastery key={t.label} label={t.label} value={t.value} />)}</div></Section>
        </TabsContent>
        <TabsContent value="Guardados">
          <div className="grid justify-items-center gap-1 px-5 py-12 text-center text-sm text-muted-foreground"><b className="text-foreground">Ainda não guardaste nada</b><span>Guarda publicações do início para as encontrares aqui.</span></div>
        </TabsContent>
      </Tabs>

      <Section title="Definições" className="border-t">
        <div className="divide-y">
          {DEFS.map((d) => (
            <div key={d.key} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
              <Label htmlFor={`def-${d.key}`} className="grid cursor-pointer gap-0.5 leading-snug"><span className="text-[15px]">{d.label}</span><span className="text-[13px] font-normal text-muted-foreground">{d.hint}</span></Label>
              <Switch id={`def-${d.key}`} checked={on[d.key]} onCheckedChange={(v) => setOn((s) => ({ ...s, [d.key]: v }))} />
            </div>
          ))}
        </div>
      </Section>

      <form action={sairAction} className="px-4 py-4"><Button type="submit" variant="outline"><LogOut />Terminar sessão</Button></form>
    </Page>
  );
}
