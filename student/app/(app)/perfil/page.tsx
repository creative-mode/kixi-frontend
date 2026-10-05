'use client';

import { useEffect, useState } from 'react';
import { Check, LogOut, MessageCircle } from 'lucide-react';
import { sairAction } from '@/lib/auth-actions';
import { Column, Page } from '@/components/page';
import { Mastery } from '@/components/mastery';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { me, result, topicsToReview } from '@/lib/data';

const TABS = ['Atividade', 'Desempenho', 'Guardados'] as const;
const DEFS = [
  { key: 'night', label: 'Tema escuro', hint: 'Fundo escuro, para estudar à noite.', def: false },
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

  useEffect(() => {
    setOn((s) => ({ ...s, night: document.documentElement.getAttribute('data-theme') === 'dark' }));
  }, []);

  const toggle = (key: string, next: boolean) => {
    setOn((s) => ({ ...s, [key]: next }));
    if (key === 'night') {
      const t = next ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', t);
      try { localStorage.setItem('kixi-theme', t); } catch {}
    }
  };

  return (
    <Page>
      <Column className="gap-5">
        <Card className="gap-0 overflow-hidden py-0">
          <div className="h-24 border-b bg-gradient-to-br from-accent to-secondary" />
          <div className="grid gap-3.5 px-5 pb-5">
            <div className="-mt-9 flex flex-wrap items-end justify-between gap-3">
              <UserAvatar name={me.name} size={84} className="border-4 border-card" />
              <Button variant="outline" size="sm">Editar perfil</Button>
            </div>
            <div><h1 className="text-[22px] font-bold tracking-tight">{me.name}</h1><p className="text-sm text-muted-foreground">{me.escola} · {me.curso} · Turma {me.turma}</p></div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[['8', 'provas feitas'], ['15,0', 'média das simulações'], ['5.º', 'na turma']].map(([v, l]) => (
                <div key={l} className="rounded-lg border px-4 py-3"><b className="block text-[22px] tracking-tight tabular-nums">{v}</b><span className="text-[13px] text-muted-foreground">{l}</span></div>
              ))}
            </div>
          </div>
        </Card>

        <Tabs defaultValue="Atividade">
          <TabsList aria-label="Perfil">{TABS.map((t) => <TabsTrigger key={t} value={t}>{t}</TabsTrigger>)}</TabsList>
          <TabsContent value="Atividade">
            <Card className="gap-0 divide-y py-0">
              {ACTIVITY.map((a) => (
                <div key={a.t} className="flex items-center gap-3.5 px-5 py-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><a.icon className="size-[18px]" /></span>
                  <div className="leading-snug"><b className="block text-sm">{a.t}</b><span className="text-[13px] text-muted-foreground">{a.m}</span></div>
                </div>
              ))}
            </Card>
          </TabsContent>
          <TabsContent value="Desempenho">
            <Card><CardHeader><CardTitle>Domínio por tema</CardTitle></CardHeader>
              <CardContent className="grid gap-3.5">{[...result.topics, ...topicsToReview.filter((t) => !result.topics.some((r) => r.label === t.label))].map((t) => <Mastery key={t.label} label={t.label} value={t.value} />)}</CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="Guardados">
            <Card className="grid justify-items-center gap-1 px-5 py-10 text-center text-sm text-muted-foreground"><b className="text-foreground">Ainda não guardaste nada</b><span>Guarda publicações do início para as encontrares aqui.</span></Card>
          </TabsContent>
        </Tabs>

        <Card><CardHeader><CardTitle>Definições</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {DEFS.map((d) => (
              <div key={d.key} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                <Label htmlFor={`def-${d.key}`} className="grid cursor-pointer gap-0.5 leading-snug"><span className="text-[15px]">{d.label}</span><span className="text-[13px] font-normal text-muted-foreground">{d.hint}</span></Label>
                <Switch id={`def-${d.key}`} checked={on[d.key]} onCheckedChange={(v) => toggle(d.key, v)} />
              </div>
            ))}
          </CardContent>
        </Card>

        <form action={sairAction}><Button type="submit" variant="outline"><LogOut />Terminar sessão</Button></form>
      </Column>
    </Page>
  );
}
