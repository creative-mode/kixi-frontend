'use client';

import { useCallback, useState } from 'react';
import { Check, LogOut, MessageCircle } from 'lucide-react';
import { sairAction } from '@/lib/auth-actions';
import { Column, Page } from '@/components/page';
import { Mastery } from '@/components/mastery';
import { UserAvatar } from '@/components/user-avatar';
import { ProfileEditor } from '@/components/profile-editor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { contextLine, fullName, photoUrl } from '@/lib/profile';
import { setTheme, useNightTheme } from '@/lib/theme';
import { result, topicsToReview } from '@/lib/data';
import type { Me } from '@/lib/types';

const TABS = ['Atividade', 'Desempenho', 'Guardados'] as const;
const DEFS = [
  { key: 'time', label: '+25% de tempo nas provas', hint: 'Ajuste de tempo para quem precisa.', def: true },
  { key: 'motion', label: 'Reduzir movimento', hint: 'Menos animações na interface.', def: false },
];
// A activity feed still comes from lib/data.ts; it needs the student's own simulations
// to be real, which arrives with the statements and results work.
const ACTIVITY = [
  { t: 'Concluíste a P1 · Redes de Computadores', m: 'Nota 15,0 · há 2 dias', icon: Check },
  { t: 'Perguntaste na turma sobre subnetting', m: '3 respostas · há 4 dias', icon: MessageCircle },
  { t: 'Concluíste a P2 · Sistemas Operativos', m: 'Nota 16,4 · há 1 semana', icon: Check },
];

export function PerfilView({ me }: { me: Me | null }) {
  const [editing, setEditing] = useState(false);
  const night = useNightTheme();
  const [on, setOn] = useState<Record<string, boolean>>(Object.fromEntries(DEFS.map((d) => [d.key, d.def])));

  const close = useCallback(() => setEditing(false), []);

  const toggle = (key: string, next: boolean) => setOn((s) => ({ ...s, [key]: next }));

  const name = fullName(me) || 'Aluno';
  const context = contextLine(me);

  // Facts the backend actually knows about the student right now. The performance
  // figures this card used to show were placeholders; they arrive with the real
  // simulations data rather than being invented here.
  const facts: [string, string][] = me
    ? [
        [me.currentClass?.code ?? '—', 'turma'],
        [me.currentClass?.school_year ?? '—', 'ano letivo'],
        [me.course?.code ?? '—', 'curso'],
      ]
    : [];

  return (
    <Page>
      <Column className="gap-5">
        <Card className="gap-0 overflow-hidden py-0">
          <div className="h-24 border-b bg-gradient-to-br from-accent to-secondary" />
          <div className="grid gap-3.5 px-5 pb-5">
            <div className="-mt-9 flex flex-wrap items-end justify-between gap-3">
              <UserAvatar name={name} src={photoUrl(me)} size={84} className="border-4 border-card" />
              {me && !editing && (
                <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
                  Editar perfil
                </Button>
              )}
            </div>
            <div>
              <h1 className="text-[22px] font-bold tracking-tight">{name}</h1>
              <p className="text-sm text-muted-foreground">
                {context || 'Sem afiliação académica — matricula-te para veres o teu feed.'}
              </p>
            </div>
            {facts.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-3">
                {facts.map(([value, label]) => (
                  <div key={label} className="rounded-lg border px-4 py-3">
                    <b className="block text-[22px] tracking-tight tabular-nums">{value}</b>
                    <span className="text-[13px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {editing && me && <ProfileEditor me={me} onDone={close} />}
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
            <div className="flex items-center justify-between gap-4 py-3.5 first:pt-0">
              <Label htmlFor="def-night" className="grid cursor-pointer gap-0.5 leading-snug"><span className="text-[15px]">Tema escuro</span><span className="text-[13px] font-normal text-muted-foreground">Fundo escuro, para estudar à noite.</span></Label>
              <Switch id="def-night" checked={night} onCheckedChange={setTheme} />
            </div>
            {DEFS.map((d) => (
              <div key={d.key} className="flex items-center justify-between gap-4 py-3.5 last:pb-0">
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
