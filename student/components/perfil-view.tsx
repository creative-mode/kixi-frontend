'use client';

import { useCallback, useState } from 'react';
import { Award, Check, Flame, LogOut } from 'lucide-react';
import { sairAction } from '@/lib/auth-actions';
import { Column, Page } from '@/components/page';
import { Mastery } from '@/components/mastery';
import { UserAvatar } from '@/components/user-avatar';
import { ProfileEditor } from '@/components/profile-editor';
import { Button } from '@/components/ui/button';
import { Badge as Pill } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { contextLine, fullName, photoUrl } from '@/lib/profile';
import { setTheme, useNightTheme } from '@/lib/theme';
import { setReduceMotion, useReduceMotion } from '@/lib/motion';
import { levelProgress } from '@/lib/gamification-rules';
import { sinceLabel } from '@/lib/attempt-history';
import { formatAverage } from '@/lib/ranking-rules';
import type { Performance } from '@/lib/performance-rules';
import type { CatalogItem } from '@/lib/catalog';
import type { Badge, Stats } from '@/lib/stats';
import type { Me } from '@/lib/types';

const TABS = ['Atividade', 'Desempenho', 'Medalhas', 'Histórico'] as const;

export function PerfilView({
  me,
  stats,
  badges,
  history,
  performance,
}: {
  me: Me | null;
  stats: Stats | null;
  badges: Badge[];
  history: CatalogItem[];
  performance: Performance;
}) {
  const [editing, setEditing] = useState(false);
  const night = useNightTheme();
  const reduceMotion = useReduceMotion();

  const close = useCallback(() => setEditing(false), []);

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

        {stats && (
          <Card>
            <CardContent className="grid gap-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                    <Award className="size-[18px]" />
                  </span>
                  <div className="leading-snug">
                    <b className="block text-sm">Nível {stats.level}</b>
                    <span className="text-[13px] text-muted-foreground">{stats.xp} XP</span>
                  </div>
                </div>
                <Pill variant="outline">
                  <Flame className="size-3" />
                  {stats.streak} {stats.streak === 1 ? 'dia' : 'dias'} seguidos
                </Pill>
              </div>
              <Progress value={levelProgress(stats.xp, stats.level)} aria-label={`Progresso para o nível ${stats.level + 1}`} />
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="Atividade">
          <TabsList aria-label="Perfil">{TABS.map((t) => <TabsTrigger key={t} value={t}>{t}</TabsTrigger>)}</TabsList>
          <TabsContent value="Atividade">
            <Card className="gap-0 divide-y py-0">
              {performance.activity.length === 0 && (
                <div className="grid justify-items-center gap-1 px-5 py-10 text-center text-sm text-muted-foreground">
                  <b className="text-foreground">Ainda não há atividade</b>
                  <span>As provas que entregares aparecem aqui.</span>
                </div>
              )}
              {performance.activity.slice(0, 10).map((a) => (
                <div key={a.id} className="flex items-center gap-3.5 px-5 py-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Check className="size-[18px]" /></span>
                  <div className="leading-snug"><b className="block text-sm">Concluíste {a.title}</b><span className="text-[13px] text-muted-foreground">Nota {formatAverage(a.score)}{sinceLabel(a.finishedAt) ? ` · ${sinceLabel(a.finishedAt)}` : ''}</span></div>
                </div>
              ))}
            </Card>
          </TabsContent>
          <TabsContent value="Desempenho">
            <Card><CardHeader><CardTitle>Domínio por prova</CardTitle></CardHeader>
              <CardContent className="grid gap-3.5">
                {performance.mastery.length === 0
                  ? <p className="text-sm text-muted-foreground">Entrega uma prova para veres aqui o teu domínio.</p>
                  : performance.mastery.map((t) => <Mastery key={t.id} label={t.label} value={t.value} />)}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="Medalhas">
            {badges.length === 0 ? (
              <Card className="grid justify-items-center gap-1 px-5 py-10 text-center text-sm text-muted-foreground">
                <b className="text-foreground">Ainda não desbloqueaste medalhas</b>
                <span>Termina a primeira simulação para ganhar a primeira.</span>
              </Card>
            ) : (
              <div className="grid gap-3.5 sm:grid-cols-2">
                {badges.map((b) => (
                  <Card key={b.code} className="flex-row items-center gap-3.5 px-5 py-3.5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                      <Award className="size-5" />
                    </span>
                    <div className="leading-snug">
                      <b className="block text-sm">{b.name}</b>
                      <span className="text-[13px] text-muted-foreground">{b.description}</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="Desempenho">
            <Card><CardHeader><CardTitle>Domínio por prova</CardTitle></CardHeader>
              <CardContent className="grid gap-3.5">
                {performance.mastery.length === 0
                  ? <p className="text-sm text-muted-foreground">Entrega uma prova para veres aqui o teu domínio.</p>
                  : performance.mastery.map((t) => <Mastery key={t.id} label={t.label} value={t.value} />)}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="Histórico">
            {history.length === 0 ? (
              <Card className="grid justify-items-center gap-1 px-5 py-10 text-center text-sm text-muted-foreground">
                <b className="text-foreground">Ainda não terminaste nenhuma prova</b>
                <span>As provas concluídas aparecem aqui, com a nota.</span>
              </Card>
            ) : (
              <Card className="gap-0 divide-y py-0">
                {history.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3.5 px-5 py-3.5">
                    <div className="leading-snug">
                      <b className="block text-sm">{item.title}</b>
                      <span className="text-[13px] text-muted-foreground">{[item.kind, item.subject, item.school].filter(Boolean).join(' · ')}</span>
                    </div>
                    <Pill variant="success">{item.score}</Pill>
                  </div>
                ))}
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <Card><CardHeader><CardTitle>Definições</CardTitle></CardHeader>
          <CardContent className="divide-y">
            <div className="flex items-center justify-between gap-4 py-3.5 first:pt-0">
              <Label htmlFor="def-night" className="grid cursor-pointer gap-0.5 leading-snug"><span className="text-[15px]">Tema escuro</span><span className="text-[13px] font-normal text-muted-foreground">Fundo escuro, para estudar à noite.</span></Label>
              <Switch id="def-night" checked={night} onCheckedChange={setTheme} />
            </div>
            <div className="flex items-center justify-between gap-4 py-3.5">
              <Label htmlFor="def-motion" className="grid cursor-pointer gap-0.5 leading-snug"><span className="text-[15px]">Reduzir movimento</span><span className="text-[13px] font-normal text-muted-foreground">Menos animações na interface.</span></Label>
              <Switch id="def-motion" checked={reduceMotion} onCheckedChange={setReduceMotion} />
            </div>
            {/* Issue #107: o tempo extra é do aluno, mas só um administrador o liga —
                é uma decisão da escola, não uma preferência de interface, por isso
                aparece aqui como estado e não como interruptor. */}
            <div className="flex items-center justify-between gap-4 py-3.5 last:pb-0">
              <div className="grid gap-0.5 leading-snug">
                <span className="text-[15px]">+25% de tempo nas provas</span>
                <span className="text-[13px] font-normal text-muted-foreground">Definido pela escola, não por ti.</span>
              </div>
              <Pill variant={me?.accessibility_extra_time ? 'success' : 'secondary'}>
                {me?.accessibility_extra_time ? 'Ativo' : 'Inativo'}
              </Pill>
            </div>
          </CardContent>
        </Card>

        <form action={sairAction}><Button type="submit" variant="outline"><LogOut />Terminar sessão</Button></form>
      </Column>
    </Page>
  );
}
