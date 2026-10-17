'use client';

import { useCallback, useState } from 'react';
import { Award, BookOpen, Building2, CalendarDays, Check, Flame, Users } from 'lucide-react';
import { Mastery } from '@/components/mastery';
import { Page, PageHeader } from '@/components/page';
import { UserAvatar } from '@/components/user-avatar';
import { PostCard } from '@/components/post-card';
import { PostComposer } from '@/components/post-composer';
import { VisibilityPicker } from '@/components/visibility-picker';
import type { Visibility } from '@/lib/profiles';
import { ProfileEditor } from '@/components/profile-editor';
import { EmptyState } from '@/components/states';
import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge as Pill } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { contextLine, fullName, photoUrl } from '@/lib/profile';
import { setReduceMotion, useReduceMotion } from '@/lib/motion';
import { sinceLabel } from '@/lib/attempt-history';
import { formatAverage } from '@/lib/ranking-rules';
import { PROFILE_TABS, shortTitle, type ProfileTab } from '@/lib/social-rules';
import type { Performance } from '@/lib/performance-rules';
import type { CatalogItem } from '@/lib/catalog';
import type { FeedPost } from '@/lib/feed';
import type { Badge, Stats } from '@/lib/stats';
import type { Me } from '@/lib/types';

function Fact({ icon: Icon, children }: { icon: typeof Building2; children: React.ReactNode }) {
  return <li className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground"><Icon className="size-4 shrink-0" aria-hidden /><span className="min-w-0 truncate">{children}</span></li>;
}

/** O centro do perfil: cabeçalho, últimas simulações, sequência de estudo e separadores. */
export function PerfilView({
  me,
  stats,
  badges,
  history,
  performance,
  classId,
  posts,
  feedError,
  initialTab = 'Publicações',
  startEditing = false,
  visibility = 'school',
}: {
  me: Me;
  visibility?: Visibility;
  stats: Stats | null;
  badges: Badge[];
  history: CatalogItem[];
  performance: Performance;
  classId: number | null;
  /** As publicações da própria conta, da turma onde está matriculado. */
  posts: FeedPost[];
  feedError?: string | null;
  initialTab?: ProfileTab;
  startEditing?: boolean;
}) {
  const [editing, setEditing] = useState(startEditing);
  const reduceMotion = useReduceMotion();
  const close = useCallback(() => setEditing(false), []);

  const name = fullName(me) || 'Aluno';
  const context = contextLine(me);
  const recent = performance.activity.slice(0, 3);

  return (
    <Page className="gap-0 p-0 pb-24 md:pb-10">
      <PageHeader title={name} kicker={`${performance.activity.length} ${performance.activity.length === 1 ? 'simulação' : 'simulações'}`} back="/inicio" className="m-0" />

      <section aria-label="Perfil" className="border-b">
        <div aria-hidden className="h-32 bg-gradient-to-br from-accent to-secondary" />
        <div className="px-4 pb-4">
          <div className="flex items-end justify-between gap-3">
            <div className="-mt-12 rounded-full border-4 border-background bg-background"><UserAvatar name={name} src={photoUrl(me)} size={88} /></div>
            {!editing && <Button type="button" variant="outline" onClick={() => setEditing(true)}>Editar perfil</Button>}
          </div>
          <h2 className="mt-2 text-xl leading-tight font-extrabold tracking-tight">{name}</h2>
          {!context && <p className="text-[15px] text-muted-foreground">Sem afiliação académica: matricula-te para veres o teu feed.</p>}
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {me.school && <Fact icon={Building2}>{me.school.name}</Fact>}
            {me.course && <Fact icon={BookOpen}>{me.course.name}</Fact>}
            {me.currentClass && <Fact icon={Users}>Turma {me.currentClass.code}</Fact>}
            {me.currentClass?.school_year && <Fact icon={CalendarDays}>Ano letivo {me.currentClass.school_year}</Fact>}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {stats && <Pill variant="secondary"><Award className="size-3" aria-hidden />Nível {stats.level}</Pill>}
            {stats && stats.streak > 0 && <Pill variant="outline"><Flame className="size-3" aria-hidden />{stats.streak} {stats.streak === 1 ? 'dia' : 'dias'} seguidos</Pill>}
            {stats && <Pill variant="outline">{stats.xp} XP</Pill>}
          </div>
          {recent.length > 0 && (
            <ul aria-label="Últimas simulações" className="mt-4 grid grid-cols-3 gap-2">
              {recent.map((a) => (
                <li key={a.id}>
                  <Link href={`/resultado?prova=${a.id}`} className="px-box grid h-full content-between gap-2 p-3 [--px-face:var(--secondary)] hover:[--px-face:var(--accent)]">
                    <b className="text-lg leading-none tabular-nums">{formatAverage(a.score)}</b>
                    <span className="line-clamp-2 text-[12px] leading-tight font-semibold">{shortTitle(a.title, 32)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        {editing && <div className="border-t"><ProfileEditor me={me} onDone={close} /></div>}
      </section>

      <Tabs defaultValue={initialTab}>
        <TabsList aria-label="Perfil">{PROFILE_TABS.map((t) => <TabsTrigger key={t} value={t}>{t}</TabsTrigger>)}</TabsList>

        <TabsContent value="Publicações" className="flex flex-col">
          {classId && <PostComposer classId={classId} />}
          {feedError ? (
            <div className="p-4"><Alert variant="destructive">{feedError}</Alert></div>
          ) : !classId ? (
            <EmptyState title="Matricula-te para publicares" message="As publicações da tua turma aparecem aqui depois da matrícula." />
          ) : posts.length === 0 ? (
            <EmptyState title="Ainda não publicaste nada" message="Partilha uma dúvida ou um tema com a turma e fica aqui." />
          ) : (
            posts.map((p) => <PostCard key={p.id} post={p} myAccountId={me.accountId} myName={name} myPhoto={me.photo} />)
          )}
        </TabsContent>

        <TabsContent value="Atividade" className="p-4">
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

        <TabsContent value="Desempenho" className="p-4">
          <Card><CardHeader><CardTitle>Domínio por prova</CardTitle></CardHeader>
            <CardContent className="grid gap-3.5">
              {performance.mastery.length === 0
                ? <p className="text-sm text-muted-foreground">Entrega uma prova para veres aqui o teu domínio.</p>
                : performance.mastery.map((t) => <Mastery key={t.id} label={t.label} value={t.value} />)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="Medalhas" className="p-4">
          {badges.length === 0 ? (
            <Card className="grid justify-items-center gap-1 px-5 py-10 text-center text-sm text-muted-foreground">
              <b className="text-foreground">Ainda não desbloqueaste medalhas</b>
              <span>Termina a primeira simulação para ganhar a primeira.</span>
            </Card>
          ) : (
            <div className="grid gap-3.5 sm:grid-cols-2">
              {badges.map((b) => (
                <Card key={b.code} className="flex-row items-center gap-3.5 px-5 py-3.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Award className="size-5" /></span>
                  <div className="leading-snug"><b className="block text-sm">{b.name}</b><span className="text-[13px] text-muted-foreground">{b.description}</span></div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="Histórico" className="p-4">
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

        <TabsContent value="Definições" className="p-4">
          <Card><CardHeader><CardTitle>Definições</CardTitle></CardHeader>
            <CardContent className="divide-y">
              <div className="flex items-center justify-between gap-4 py-3.5 first:pt-0">
                <Label htmlFor="def-motion" className="grid cursor-pointer gap-0.5 leading-snug"><span className="text-[15px]">Reduzir movimento</span><span className="text-[13px] font-normal text-muted-foreground">Menos animações na interface.</span></Label>
                <Switch id="def-motion" checked={reduceMotion} onCheckedChange={setReduceMotion} />
              </div>
              {/* Issue #107: o tempo extra é do aluno, mas só um administrador o liga: é uma decisão da
                  escola, não uma preferência de interface, por isso aparece aqui como estado e não como interruptor. */}
              <div className="flex items-center justify-between gap-4 py-3.5 last:pb-0">
                <div className="grid gap-0.5 leading-snug">
                  <span className="text-[15px]">+25% de tempo nas provas</span>
                  <span className="text-[13px] font-normal text-muted-foreground">Definido pela escola, não por ti.</span>
                </div>
                <Pill variant={me.accessibility_extra_time ? 'success' : 'secondary'}>{me.accessibility_extra_time ? 'Ativo' : 'Inativo'}</Pill>
              </div>
              <VisibilityPicker initial={visibility} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Page>
  );
}
