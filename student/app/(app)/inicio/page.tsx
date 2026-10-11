'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Bookmark, ChevronRight, MessageCircle, Send, ThumbsUp, TrendingUp, BookOpen } from 'lucide-react';
import { Column, Page, PageHeader, Rail } from '@/components/page';
import { Mastery } from '@/components/mastery';
import { UserAvatar } from '@/components/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { KIND_LABEL, posts as seed, ranking, topicsToReview, upcoming, type FeedPost } from '@/lib/data';
import { useMe } from '@/lib/me-context';
import { contextLine, fullName } from '@/lib/profile';

const TABS = ['Turma', 'Escola', 'A seguir'] as const;
const SHORTCUTS = [
  { label: 'Partilhar resultado', icon: TrendingUp },
  { label: 'Fazer uma pergunta', icon: MessageCircle },
  { label: 'Dica de estudo', icon: BookOpen },
];

function Attach({ p }: { p: FeedPost }) {
  const a = p.attach;
  if (!a) return null;
  if (a.type === 'questao') {
    return (
      <blockquote className="rounded-r-md border-l-[3px] border-input bg-secondary px-3.5 py-2.5 text-sm text-foreground/80">
        <b className="mb-0.5 block text-[13px] font-semibold text-muted-foreground">{a.title}</b>{a.excerpt}
      </blockquote>
    );
  }
  return (
    <Link href={a.href} className="flex items-center justify-between gap-4 rounded-md border bg-secondary/60 px-3.5 py-3 transition-colors hover:border-input hover:bg-secondary">
      <span className="min-w-0"><span className="block text-sm font-semibold">{a.title}</span><span className="text-[13px] text-muted-foreground">{a.meta}</span></span>
      {a.type === 'resultado' ? (
        <span className="shrink-0 text-right leading-tight"><b className="block text-2xl font-bold tracking-tight tabular-nums">{a.score}</b>{a.delta && <span className="text-xs font-semibold text-success">{a.delta}</span>}</span>
      ) : <ChevronRight className="size-5 shrink-0 text-muted-foreground" />}
    </Link>
  );
}

function Post({ p }: { p: FeedPost }) {
  const me = useMe();
  const [useful, setUseful] = useState(false);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(p.comments);
  const [draft, setDraft] = useState('');

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    setList((l) => [...l, { name: fullName(me), text: t, time: 'agora' }]);
    setDraft('');
  };
  const act = 'h-10 gap-2 px-3 text-muted-foreground aria-pressed:text-primary aria-expanded:text-foreground';

  return (
    <Card className="gap-3 pt-4 pb-0">
      <CardContent className="grid gap-3">
        <header className="flex items-center gap-3">
          <UserAvatar name={p.name} size={44} />
          <div className="min-w-0 flex-1 leading-tight"><div className="font-bold">{p.name}</div><div className="text-[13px] text-muted-foreground">{p.meta}</div></div>
          <Badge variant="secondary">{KIND_LABEL[p.kind]}</Badge>
        </header>
        <p className="max-w-[62ch] leading-relaxed">{p.text}</p>
        <Attach p={p} />
      </CardContent>

      <div className="flex flex-wrap items-center gap-0.5 border-t px-2 py-1">
        <Button variant="ghost" className={act} aria-pressed={useful} onClick={() => setUseful((v) => !v)}>
          <ThumbsUp className={cn(useful && 'fill-primary/15')} />Útil<span className="tabular-nums">{p.useful + (useful ? 1 : 0)}</span>
        </Button>
        <Button variant="ghost" className={act} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <MessageCircle />Comentar<span className="tabular-nums">{list.length}</span>
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground aria-pressed:text-primary" aria-pressed={saved} aria-label={saved ? 'Remover dos guardados' : 'Guardar'} onClick={() => setSaved((v) => !v)}>
          <Bookmark className={cn(saved && 'fill-primary/15')} />
        </Button>
        {p.cta && <Button asChild variant="ghost" size="sm" className="ml-auto max-w-full text-primary"><Link href={p.cta.href}>{p.cta.label}</Link></Button>}
      </div>

      {open && (
        <div className="grid gap-3 border-t px-5 py-4">
          {list.map((c, i) => (
            <div className="flex gap-2.5" key={i}>
              <UserAvatar name={c.name} size={32} />
              <div>
                <div className="rounded-xl bg-secondary px-3 py-2 text-sm leading-snug"><b className="mr-1.5 font-bold">{c.name}</b>{c.text}</div>
                <div className="mt-0.5 ml-3 text-xs text-muted-foreground">{c.time}</div>
              </div>
            </div>
          ))}
          <form className="flex items-center gap-2.5" onSubmit={send}>
            <UserAvatar name={fullName(me)} size={32} />
            <Input className="h-9 rounded-full bg-secondary" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escreve um comentário" aria-label="Escrever um comentário" />
            <Button type="submit" variant="ghost" size="icon" aria-label="Enviar comentário"><Send /></Button>
          </form>
        </div>
      )}
    </Card>
  );
}

export default function Inicio() {
  const me = useMe();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Turma');
  const [text, setText] = useState('');
  const [mine, setMine] = useState<FeedPost[]>([]);

  const publish = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setMine((m) => [{ id: 'm' + m.length, kind: 'duvida', name: fullName(me), meta: `${contextLine(me)} · agora`, text: t, useful: 0, comments: [] }, ...m]);
    setText('');
  };
  const top = ranking.Turma.rows.slice(0, 3);

  return (
    <Page variant="feed">
      <Column>
        <PageHeader title="Início" />

        <Card className="flex-row items-center gap-4 px-5 py-4" aria-label="Simulação em curso">
          <div className="grid min-w-0 flex-1 gap-2">
            <div><div className="font-bold">P1 · Redes de Computadores</div><div className="text-[13px] text-muted-foreground">Em curso · questão 5 de 12 · 42 min restantes</div></div>
            <Progress value={(5 / 12) * 100} aria-label="Progresso da simulação" />
          </div>
          <Button asChild><Link href="/prova/redes-p1">Continuar</Link></Button>
        </Card>

        <Card className="gap-3 py-4">
          <form className="grid gap-3 px-4" onSubmit={publish}>
            <div className="flex items-center gap-3">
              <UserAvatar name={fullName(me)} size={40} />
              <Input className="h-11 rounded-full bg-secondary px-4" value={text} onChange={(e) => setText(e.target.value)} placeholder="Partilha um resultado ou pergunta à turma" aria-label="Nova publicação" />
              <Button type="submit" size="sm" disabled={!text.trim()}>Publicar</Button>
            </div>
            <div className="flex flex-wrap gap-1.5 md:pl-[52px]">
              {SHORTCUTS.map((a) => (
                <Button key={a.label} type="button" variant="ghost" size="sm" className="shrink-0 text-primary" onClick={() => setText((t) => t || a.label + ': ')}><a.icon />{a.label}</Button>
              ))}
            </div>
          </form>
        </Card>

        <Tabs value={tab} onValueChange={(v) => setTab(v as (typeof TABS)[number])}>
          <TabsList aria-label="Mostrar publicações de">{TABS.map((t) => <TabsTrigger key={t} value={t}>{t}</TabsTrigger>)}</TabsList>
        </Tabs>

        {[...mine, ...seed].map((p) => <Post key={p.id} p={p} />)}
      </Column>

      <Rail>
        <Card className="gap-4"><CardHeader><CardTitle>Para rever</CardTitle></CardHeader>
          <CardContent className="grid gap-3.5">
            {topicsToReview.map((t) => <Mastery key={t.label} label={t.label} value={t.value} />)}
            <Button asChild variant="outline" size="sm"><Link href="/tutor">Rever com o tutor</Link></Button>
          </CardContent>
        </Card>

        <Card className="gap-4"><CardHeader><CardTitle>Na tua turma</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <ol className="grid gap-2.5">
              {top.map((r) => (
                <li key={r.name} className="flex items-center gap-2.5 text-sm">
                  <span className="w-5 text-center font-semibold text-muted-foreground tabular-nums">{r.rank}</span>
                  <UserAvatar name={r.name} size={28} /><span className="min-w-0 flex-1 truncate">{r.name}</span><span className="text-muted-foreground tabular-nums">{r.score}</span>
                </li>
              ))}
            </ol>
            <Button asChild variant="link" size="sm" className="justify-start px-0"><Link href="/ranking">Ver a turma toda</Link></Button>
          </CardContent>
        </Card>

        <Card className="gap-4 md:col-span-2 xl:col-span-1"><CardHeader><CardTitle>Próximas provas</CardTitle></CardHeader>
          <CardContent className="grid gap-3.5">
            {upcoming.map((u) => (
              <div className="flex items-center gap-3" key={u.title}>
                <div className="grid size-11 shrink-0 place-items-center rounded-md bg-accent text-center text-[15px] leading-none font-bold text-accent-foreground"><span>{u.day}<small className="mt-0.5 block text-[10px] font-semibold opacity-80">{u.month}</small></span></div>
                <div className="leading-tight"><div className="text-sm font-semibold">{u.title}</div><div className="text-[13px] text-muted-foreground">{u.meta}</div></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </Rail>
    </Page>
  );
}
