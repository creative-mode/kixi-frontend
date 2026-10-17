'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Bookmark, CheckCircle2, Dumbbell, EyeOff, Flame, Lock, MessageCircle, Send, Share2, ThumbsUp, TrendingUp, BookOpen, HelpCircle, TriangleAlert, Activity, type LucideIcon } from 'lucide-react';
import { Page } from '@/components/page';
import { UserAvatar } from '@/components/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { KIND_LABEL, followed, goal, handle, me, posts as seed, type Comment, type FeedPost, type PostKind } from '@/lib/data';

const TABS = ['Para ti', 'A seguir', `Turma ${me.turma}`] as const;
type Tab = (typeof TABS)[number];

const KIND_ICON: Record<PostKind, LucideIcon> = { resultado: Activity, duvida: MessageCircle, dica: BookOpen, treino: Dumbbell };
const COMPOSE: { kind: PostKind; label: string; icon: LucideIcon; lead: string }[] = [
  { kind: 'resultado', label: 'Partilhar resultado', icon: TrendingUp, lead: 'Resultado: ' },
  { kind: 'duvida', label: 'Fazer uma pergunta', icon: HelpCircle, lead: '' },
  { kind: 'dica', label: 'Dica de estudo', icon: BookOpen, lead: 'Dica: ' },
];

/** Cartão incorporado na publicação: resultado, treino, tema ou excerto de uma questão. */
function Attach({ p }: { p: FeedPost }) {
  const a = p.attach;
  if (!a) return null;
  const box = 'mt-3 block rounded-2xl border px-4 py-3';
  if (a.type === 'questao') {
    return <blockquote className={cn(box, 'text-[15px] text-foreground/80')}><b className="mb-0.5 block text-[13px] font-semibold text-muted-foreground">{a.title}</b>{a.excerpt}</blockquote>;
  }
  if (a.type === 'treino') {
    return (
      <Link href={a.href} className={cn(box, 'hover:bg-secondary/60')}>
        <span className="flex items-baseline justify-between gap-3 text-[13px] text-muted-foreground"><span>{a.title}</span><b className="font-semibold tabular-nums text-foreground">{a.done} / {a.total}</b></span>
        <Progress className="mt-2 h-1" value={(a.done / a.total) * 100} aria-label="Respostas certas" />
      </Link>
    );
  }
  return (
    <Link href={a.href} className={cn(box, 'flex items-center justify-between gap-4 hover:bg-secondary/60')}>
      <span className="min-w-0"><span className="block font-bold">{a.title}</span><span className="text-[13px] text-muted-foreground">{a.meta}</span></span>
      {a.type === 'resultado' && a.hidden ? (
        <span className="flex shrink-0 items-center gap-1.5 text-right text-xs leading-tight font-semibold text-muted-foreground"><EyeOff className="size-4" />Nota escondida<br />pela autora</span>
      ) : a.type === 'resultado' ? (
        <span className="shrink-0 text-right leading-tight"><b className="block text-2xl font-bold tracking-tight tabular-nums">{a.score}<span className="text-sm font-semibold text-muted-foreground"> /20</span></b>{a.delta && <span className="text-xs font-semibold text-success">{a.delta}</span>}</span>
      ) : null}
    </Link>
  );
}

/** Frases que costumam magoar quem perguntou. Só um aviso, quem escreve decide. */
const HARSH = /estudas pouco|é fácil|burr[oa]|est[úu]pid|idiota|não percebes nada|nunca vais/i;

function CommentRow({ c }: { c: Comment }) {
  const [helped, setHelped] = useState(false);
  const n = (c.helpful ?? 0) + (helped ? 1 : 0);
  return (
    <div className="flex gap-3 border-t px-4 py-3">
      <UserAvatar name={c.name} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 leading-tight"><b>{c.name}</b><span className="text-[13px] text-muted-foreground">{handle(c.name)} · {c.time}</span>{c.hand && <Badge variant="success">Mão amiga</Badge>}</div>
        <p className="mt-0.5 leading-snug">{c.text}</p>
        <button type="button" aria-pressed={helped} onClick={() => setHelped((v) => !v)} className="mt-1 -ml-2 inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-[13px] font-semibold text-muted-foreground hover:bg-secondary aria-pressed:text-primary">
          <CheckCircle2 className="size-4" />Ajudou{n > 0 && <span className="tabular-nums">{n}</span>}
        </button>
      </div>
    </div>
  );
}

function Action({ label, icon: Icon, count, on, className, ...props }: { label: string; icon: LucideIcon; count?: number; on?: boolean } & React.ComponentProps<'button'>) {
  return (
    <button type="button" aria-label={label} className={cn('group -ml-2 inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-primary aria-[pressed=true]:text-primary aria-expanded:text-primary', className)} {...props}>
      <Icon className={cn('size-[18px]', on && 'fill-primary/15')} strokeWidth={on ? 2.2 : 1.8} />
      {count !== undefined && count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
  );
}

function Post({ p }: { p: FeedPost }) {
  const [useful, setUseful] = useState(false);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(p.comments);
  const [draft, setDraft] = useState('');
  const [warn, setWarn] = useState(false);
  const Ctx = KIND_ICON[p.kind];

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

  return (
    <article className="border-b transition-colors hover:bg-secondary/25">
      <div className="px-4 pt-2.5 pb-1">
        <p className="mb-0.5 flex items-center gap-2 pl-[52px] text-[13px] font-semibold text-muted-foreground"><Ctx className="size-3.5" />{KIND_LABEL[p.kind]}{p.attach?.type === 'questao' || p.kind === 'duvida' ? <span className="font-normal">· {p.group}</span> : null}</p>
        <div className="flex gap-3">
          <UserAvatar name={p.name} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 leading-tight"><b className="truncate">{p.name}</b><span className="truncate text-[15px] text-muted-foreground">{handle(p.name)} · {p.when}</span></div>
            <p className="mt-0.5 leading-snug">{p.text}</p>
            <Attach p={p} />
            <div className="mt-1.5 flex max-w-[420px] items-center justify-between pb-1">
              <Action label={`Comentar, ${list.length} comentários`} icon={MessageCircle} count={list.length} aria-expanded={open} onClick={() => setOpen((v) => !v)} />
              <Action label={`Útil, ${p.useful + (useful ? 1 : 0)}`} icon={ThumbsUp} count={p.useful + (useful ? 1 : 0)} on={useful} aria-pressed={useful} onClick={() => setUseful((v) => !v)} />
              <Action label={saved ? 'Remover dos guardados' : 'Guardar'} icon={Bookmark} on={saved} aria-pressed={saved} onClick={() => setSaved((v) => !v)} />
              <Action label="Partilhar" icon={Share2} />
              {p.cta && <Button asChild variant="ghost" size="sm" className="-mr-2 hidden text-primary sm:inline-flex"><Link href={p.cta.href}>{p.cta.label}</Link></Button>}
            </div>
          </div>
        </div>
      </div>

      {open && (
        <div>
          {list.map((c, i) => <CommentRow key={i} c={c} />)}
          {warn && (
            <div role="alert" className="mx-4 mb-3 grid gap-2 rounded-2xl border-l-4 border-warning bg-warning-soft p-3.5 text-sm">
              <b className="flex items-center gap-2"><TriangleAlert className="size-4" />Antes de enviares</b>
              <p>Esta resposta pode magoar {p.name.split(' ')[0]}. Queres reformular para ajudares mesmo?</p>
              <div className="flex items-center gap-2"><Button type="button" size="sm" onClick={() => setWarn(false)}>Reformular</Button><Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={post}>Enviar assim</Button></div>
            </div>
          )}
          <form className="flex items-center gap-3 border-t px-4 py-3" onSubmit={send}>
            <UserAvatar name={me.name} size={36} />
            <Input className="h-10 rounded-full border-transparent bg-secondary px-4" value={draft} onChange={(e) => { setDraft(e.target.value); setWarn(false); }} placeholder="Escreve a tua resposta" aria-label="Escrever uma resposta" />
            <Button type="submit" size="icon" variant="ghost" aria-label="Enviar resposta" disabled={!draft.trim()}><Send /></Button>
          </form>
        </div>
      )}
    </article>
  );
}

/** Atalhos para o telemóvel: a coluna da direita só aparece em ecrãs largos. */
function Strip() {
  return (
    <div className="grid gap-px border-b bg-border lg:hidden">
      <div className="flex items-center gap-3 bg-background px-4 py-3">
        <Flame className="size-5 shrink-0 text-warning" />
        <div className="grid min-w-0 flex-1 gap-1.5"><div className="flex justify-between text-sm"><b>{goal.streak} dias seguidos</b><span className="text-muted-foreground tabular-nums">{goal.done} de {goal.target} hoje</span></div><Progress value={(goal.done / goal.target) * 100} aria-label="Meta diária" /></div>
        <Button asChild size="sm" variant="outline"><Link href="/provas">Treinar</Link></Button>
      </div>
      <Link href="/prova/redes-p1" className="flex items-center justify-between gap-3 bg-background px-4 py-3 text-sm"><span><b>P1 · Redes de Computadores</b><span className="block text-[13px] text-muted-foreground">Em curso · questão 5 de 12</span></span><span className="font-semibold text-primary">Continuar</span></Link>
    </div>
  );
}

export default function Inicio() {
  const [tab, setTab] = useState<Tab>('Para ti');
  const [text, setText] = useState('');
  const [kind, setKind] = useState<PostKind>('duvida');
  const [mine, setMine] = useState<FeedPost[]>([]);
  const box = useRef<HTMLTextAreaElement>(null);

  // "Publicar" na barra lateral e o botão flutuante apontam para #publicar.
  useEffect(() => {
    if (window.location.hash === '#publicar') box.current?.focus();
  }, []);

  const publish = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setMine((m) => [{ id: 'm' + m.length, kind, name: me.name, group: `${me.turma} · ${me.escola}`, when: 'agora', text: t, useful: 0, comments: [] }, ...m]);
    setText('');
  };

  const all = [...mine, ...seed];
  const shown = tab === 'A seguir' ? all.filter((p) => followed.includes(p.name) || p.name === me.name) : tab.startsWith('Turma') ? all.filter((p) => p.group.startsWith(me.turma)) : all;

  return (
    <Page>
      <div className="sticky top-14 z-10 bg-background/85 backdrop-blur md:top-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList aria-label="Mostrar publicações de">{TABS.map((t) => <TabsTrigger key={t} value={t}>{t}</TabsTrigger>)}</TabsList>
        </Tabs>
      </div>

      <Strip />

      <form id="publicar" className="flex gap-3 border-b px-4 py-3" onSubmit={publish}>
        <UserAvatar name={me.name} size={40} />
        <div className="min-w-0 flex-1">
          <Textarea ref={box} rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="O que estudaste hoje?" aria-label="Nova publicação" className="min-h-0 resize-none border-0 bg-transparent px-0 py-2 text-xl shadow-none [field-sizing:content] focus-visible:ring-0" />
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {COMPOSE.map((c) => (
              <Button key={c.kind} type="button" variant="ghost" size="icon" title={c.label} aria-label={c.label} aria-pressed={kind === c.kind} className="-ml-1 size-9 text-primary aria-pressed:bg-accent" onClick={() => { setKind(c.kind); setText((t) => t || c.lead); box.current?.focus(); }}><c.icon className="size-5" /></Button>
            ))}
            <span className="ml-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground max-sm:hidden"><Lock className="size-3.5" />Só a tua turma</span>
            <Button type="submit" className="ml-auto" disabled={!text.trim()}>Publicar</Button>
          </div>
        </div>
      </form>

      {shown.map((p) => <Post key={p.id} p={p} />)}
      {shown.length === 0 && <p className="px-4 py-12 text-center text-[15px] text-muted-foreground">Ainda não há publicações aqui.</p>}

      <section aria-label="Fim do feed" className="m-4 grid justify-items-center gap-3 rounded-2xl bg-accent px-5 py-6 text-center">
        <span className="text-[11px] font-bold tracking-widest text-accent-foreground">ESTÁS EM DIA</span>
        <p className="max-w-[40ch] text-[15px] leading-relaxed text-foreground/80">Já viste tudo o que a tua turma partilhou. Que tal treinar 5 minutos ou ajudar um colega com uma dúvida?</p>
        <div className="flex flex-wrap justify-center gap-2"><Button asChild><Link href="/provas">Treinar agora</Link></Button><Button asChild variant="outline"><Link href="/tutor">Abrir o tutor</Link></Button></div>
      </section>
    </Page>
  );
}
