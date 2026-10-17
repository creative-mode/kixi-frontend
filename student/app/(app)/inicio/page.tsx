'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Bookmark, CheckCircle2, ChevronRight, Dumbbell, Flame, MessageCircle, Send, ThumbsUp, TrendingUp, BookOpen, TriangleAlert, EyeOff } from 'lucide-react';
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
import { KIND_LABEL, goal, league, me, posts as seed, topicsToReview, upcoming, type Comment, type FeedPost } from '@/lib/data';

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
      <span className="flex min-w-0 items-center gap-3">
        {a.type === 'treino' && <span className="grid size-10 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground"><Dumbbell className="size-5" /></span>}
        <span className="min-w-0"><span className="block text-sm font-semibold">{a.title}</span><span className="text-[13px] text-muted-foreground">{a.meta}</span></span>
      </span>
      {a.type === 'resultado' && a.hidden ? (
        <span className="flex shrink-0 items-center gap-1.5 text-right text-xs font-semibold leading-tight text-muted-foreground"><EyeOff className="size-4" />Nota escondida<br />pela autora</span>
      ) : a.type === 'resultado' ? (
        <span className="shrink-0 text-right leading-tight"><b className="block text-2xl font-bold tracking-tight tabular-nums">{a.score}</b>{a.delta && <span className="text-xs font-semibold text-success">{a.delta}</span>}</span>
      ) : <ChevronRight className="size-5 shrink-0 text-muted-foreground" />}
    </Link>
  );
}

/** Frases que costumam magoar quem perguntou. Só um aviso, quem escreve decide. */
const HARSH = /estudas pouco|é fácil|burr[oa]|est[úu]pid|idiota|não percebes nada|nunca vais/i;

function CommentRow({ c, onHelp }: { c: Comment; onHelp: () => void }) {
  const [helped, setHelped] = useState(false);
  return (
    <div className="flex gap-2.5">
      <UserAvatar name={c.name} size={32} />
      <div className="min-w-0">
        <div className="rounded-xl bg-secondary px-3 py-2 text-sm leading-snug">
          <b className="mr-1.5 font-bold">{c.name}</b>
          {c.hand && <Badge variant="success" className="mr-1.5 align-middle">Mão amiga</Badge>}
          {c.text}
        </div>
        <div className="mt-0.5 ml-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{c.time}</span>
          <button type="button" aria-pressed={helped} onClick={() => { setHelped((v) => !v); onHelp(); }} className="inline-flex min-h-8 items-center gap-1 font-semibold aria-pressed:text-primary">
            <CheckCircle2 className="size-3.5" />Ajudou{(c.helpful ?? 0) + (helped ? 1 : 0) > 0 && <span className="tabular-nums">{(c.helpful ?? 0) + (helped ? 1 : 0)}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

function Post({ p }: { p: FeedPost }) {
  const [useful, setUseful] = useState(false);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(p.comments);
  const [draft, setDraft] = useState('');
  const [warn, setWarn] = useState(false);

  const post = () => {
    const t = draft.trim();
    if (!t) return;
    setList((l) => [...l, { name: me.name, text: t, time: 'agora' }]);
    setDraft('');
    setWarn(false);
  };
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    if (HARSH.test(draft) && !warn) { setWarn(true); return; }
    post();
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
          {list.map((c, i) => <CommentRow key={i} c={c} onHelp={() => {}} />)}
          {warn && (
            <div role="alert" className="grid gap-2 rounded-xl border-2 border-foreground/80 bg-warning-soft p-3.5 text-sm">
              <b className="flex items-center gap-2"><TriangleAlert className="size-4" />Antes de enviares</b>
              <p>Esta resposta pode magoar {p.name.split(' ')[0]}. Queres reformular para ajudares mesmo?</p>
              <div className="flex items-center gap-2"><Button type="button" size="sm" onClick={() => setWarn(false)}>Reformular</Button><Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={post}>Enviar assim</Button></div>
            </div>
          )}
          <form className="flex items-center gap-2.5" onSubmit={send}>
            <UserAvatar name={me.name} size={32} />
            <Input className="h-9 rounded-full bg-secondary" value={draft} onChange={(e) => { setDraft(e.target.value); setWarn(false); }} placeholder="Escreve um comentário" aria-label="Escrever um comentário" />
            <Button type="submit" variant="ghost" size="icon" aria-label="Enviar comentário"><Send /></Button>
          </form>
        </div>
      )}
    </Card>
  );
}

export default function Inicio() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Turma');
  const [text, setText] = useState('');
  const [mine, setMine] = useState<FeedPost[]>([]);

  const publish = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setMine((m) => [{ id: 'm' + m.length, kind: 'duvida', name: me.name, meta: `${me.turma} · ${me.escola} · agora`, text: t, useful: 0, comments: [] }, ...m]);
    setText('');
  };

  return (
    <Page variant="feed">
      <Column>
        <PageHeader title="Início" />

        <Card className="flex-row items-center gap-4 px-5 py-4" aria-label="Meta de hoje">
          <div className="grid size-12 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground"><Flame className="size-6" /></div>
          <div className="grid min-w-0 flex-1 gap-2">
            <div className="flex items-baseline justify-between gap-3"><b className="text-lg leading-none">{goal.streak} dias seguidos</b><span className="text-[13px] text-muted-foreground tabular-nums">{goal.done} de {goal.target} questões hoje</span></div>
            <Progress value={(goal.done / goal.target) * 100} aria-label="Meta diária" />
            <span className="text-[13px] text-muted-foreground">Faltam {goal.target - goal.done} para a meta de hoje.</span>
          </div>
          <Button asChild variant="outline"><Link href="/provas">Treinar</Link></Button>
        </Card>

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
              <UserAvatar name={me.name} size={40} />
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

        <Card className="items-center gap-3 border-2 border-foreground/80 bg-accent px-5 py-6 text-center shadow-[4px_4px_0_0_var(--foreground)]" aria-label="Fim do feed">
          <span className="text-[11px] font-bold tracking-widest text-accent-foreground">ESTÁS EM DIA</span>
          <p className="max-w-[40ch] text-sm leading-relaxed text-foreground/80">Já viste tudo o que a tua turma partilhou. Que tal treinar 5 minutos ou ajudar um colega com uma dúvida?</p>
          <div className="flex flex-wrap justify-center gap-2"><Button asChild><Link href="/provas">Treinar agora</Link></Button><Button asChild variant="outline"><Link href="/tutor">Abrir o tutor</Link></Button></div>
        </Card>
      </Column>

      <Rail>
        <Card className="gap-4"><CardHeader><CardTitle>Para rever</CardTitle></CardHeader>
          <CardContent className="grid gap-3.5">
            {topicsToReview.map((t) => <Mastery key={t.label} label={t.label} value={t.value} />)}
            <Button asChild variant="outline" size="sm"><Link href="/tutor">Rever com o tutor</Link></Button>
          </CardContent>
        </Card>

        <Card className="gap-4"><CardHeader><CardTitle>{league.name}</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-2xl leading-tight font-bold tracking-tight">{league.rank}.º de {league.size}</p>
            <p className="text-sm text-muted-foreground">Faltam {league.toGo} pontos para entrares na zona de subida. Contam treino e ajuda, não notas.</p>
            <Button asChild variant="link" size="sm" className="justify-start px-0"><Link href="/ranking">Ver a liga</Link></Button>
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
