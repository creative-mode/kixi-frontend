'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Flag, MessageCircle, Send, ThumbsUp, BookOpen } from 'lucide-react';
import { Column, Page, PageHeader, Rail } from '@/components/page';
import { Mastery } from '@/components/mastery';
import { UserAvatar } from '@/components/user-avatar';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/states';
import { cn } from '@/lib/utils';
import { useMe } from '@/lib/me-context';
import { contextLine, fullName } from '@/lib/profile';
import { sinceLabel } from '@/lib/attempt-history';
import { authorLabel, canPublish, postTypeLabel } from '@/lib/feed-rules';
import { addCommentAction, publishPostAction, reportPostAction, toggleReactionAction } from '@/lib/feed-actions';
import { SalasDeProva } from '@/components/salas-de-prova';
import { phaseOf, sortInvitations, type Invitation } from '@/lib/exam-room-rules';
import { parseServerTime } from '@/lib/exam-rules';
import { formatAverage } from '@/lib/ranking-rules';
import type { Mastery as MasteryItem } from '@/lib/performance-rules';
import type { RankingEntry } from '@/lib/ranking';
import type { FeedPost } from '@/lib/feed';

const SHORTCUTS = [
  { label: 'Fazer uma pergunta', icon: MessageCircle },
  { label: 'Dica de estudo', icon: BookOpen },
];

function Post({ post, myAccountId, myName }: { post: FeedPost; myAccountId: number | null; myName: string }) {
  const [reacted, setReacted] = useState(post.hasReacted);
  const [count, setCount] = useState(post.commentCount);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reported, setReported] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggleReaction = () => {
    setReacted((v) => !v); // optimista: um "aplaudir" não devia esperar pelo servidor
    startTransition(async () => {
      const result = await toggleReactionAction(post.id);
      if (result.ok && result.reacted !== undefined) setReacted(result.reacted);
    });
  };

  const sendComment = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setCount((c) => c + 1); // sem GET para listar comentários, só a contagem sobe
    startTransition(async () => {
      await addCommentAction(post.id, text);
    });
  };

  const sendReport = (e: React.FormEvent) => {
    e.preventDefault();
    const reason = reportReason.trim();
    if (!reason) return;
    startTransition(async () => {
      const result = await reportPostAction(post.id, reason);
      if (result.ok) {
        setReported(true);
        setReporting(false);
      }
    });
  };

  const act = 'h-10 gap-2 px-3 text-muted-foreground aria-pressed:text-primary aria-expanded:text-foreground';
  const author = authorLabel(post.authorAccountId, myAccountId);

  return (
    <Card className="gap-3 pt-4 pb-0">
      <CardContent className="grid gap-3">
        <header className="flex items-center gap-3">
          <UserAvatar name={author === 'Tu' ? myName : 'Colega'} size={44} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="font-bold">{author}</div>
            <div className="text-[13px] text-muted-foreground">{sinceLabel(post.createdAt) ?? ''}</div>
          </div>
          <Badge variant="secondary">{postTypeLabel(post.type)}</Badge>
        </header>
        {post.title && <h3 className="font-semibold">{post.title}</h3>}
        <p className="max-w-[62ch] leading-relaxed">{post.content}</p>
      </CardContent>

      <div className="flex flex-wrap items-center gap-0.5 border-t px-2 py-1">
        <Button variant="ghost" className={act} aria-pressed={reacted} disabled={pending} onClick={toggleReaction}>
          <ThumbsUp className={cn(reacted && 'fill-primary/15')} />Aplaudir
        </Button>
        <Button variant="ghost" className={act} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <MessageCircle />Comentar<span className="tabular-nums">{count}</span>
        </Button>
        <Button
          variant="ghost" size="icon" className="ml-auto text-muted-foreground aria-pressed:text-destructive"
          aria-pressed={reporting || reported} aria-label="Denunciar publicação" disabled={reported}
          onClick={() => setReporting((v) => !v)}
        >
          <Flag className={cn((reporting || reported) && 'fill-destructive/15')} />
        </Button>
      </div>

      {reported && (
        <div className="border-t px-5 py-3">
          <Alert variant="success">Denúncia enviada. A equipa da escola vai rever.</Alert>
        </div>
      )}

      {reporting && !reported && (
        <form className="grid gap-2 border-t px-5 py-4" onSubmit={sendReport}>
          <Input
            value={reportReason} onChange={(e) => setReportReason(e.target.value)}
            placeholder="Porque estás a denunciar esta publicação?" aria-label="Motivo da denúncia" autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setReporting(false)}>Cancelar</Button>
            <Button type="submit" size="sm" variant="destructive" disabled={!reportReason.trim()}>Denunciar</Button>
          </div>
        </form>
      )}

      {open && (
        <div className="grid gap-3 border-t px-5 py-4">
          <form className="flex items-center gap-2.5" onSubmit={sendComment}>
            <UserAvatar name={myName} size={32} />
            <Input className="h-9 rounded-full bg-secondary" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escreve um comentário" aria-label="Escrever um comentário" />
            <Button type="submit" variant="ghost" size="icon" aria-label="Enviar comentário"><Send /></Button>
          </form>
        </div>
      )}
    </Card>
  );
}

/** O feed, com as salas de prova e as publicações da turma por props: este ficheiro é
 *  cliente e os dois lêem-se no servidor, com o cookie da sessão (ver ./page.tsx). */
export function InicioFeed({
  invitations = [],
  myAccountId,
  classId,
  posts,
  feedError,
  reviewTopics = [],
  classTop = [],
}: {
  invitations?: Invitation[];
  myAccountId: number | null;
  classId: number | null;
  posts: FeedPost[];
  feedError?: string | null;
  /** As provas com pior nota do aluno, para rever (GET /simulations). */
  reviewTopics?: MasteryItem[];
  /** O topo da turma (GET /leaderboard?scope=class): já mascarado e já decidido pelo backend. */
  classTop?: RankingEntry[];
}) {
  const me = useMe();
  const [text, setText] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const publish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId || !canPublish(text)) return;
    setPublishing(true);
    setPublishError(null);
    startTransition(async () => {
      const result = await publishPostAction(classId, 'doubt', text);
      setPublishing(false);
      if (result.ok) setText('');
      else setPublishError(result.message);
    });
  };

  const upcoming = sortInvitations(invitations)
    .filter((inv) => ['scheduled', 'lobby', 'live'].includes(phaseOf(inv)))
    .slice(0, 3)
    .map((inv) => {
      const when = new Date(parseServerTime(inv.startsAt));
      return {
        key: inv.roomId,
        day: String(when.getDate()),
        month: when.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', ''),
        title: inv.statementTitle ?? 'Sala de prova',
        meta: `${when.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} · ${inv.durationMinutes} min`,
      };
    });

  return (
    <Page variant="feed">
      <Column>
        <PageHeader title="Início" />

        <SalasDeProva invitations={invitations} />

        {classId && (
          <Card className="gap-3 py-4">
            <form className="grid gap-3 px-4" onSubmit={publish}>
              <div className="flex items-center gap-3">
                <UserAvatar name={fullName(me)} size={40} />
                <Input className="h-11 rounded-full bg-secondary px-4" value={text} onChange={(e) => setText(e.target.value)} placeholder="Partilha uma dúvida ou um tema com a turma" aria-label="Nova publicação" />
                <Button type="submit" size="sm" disabled={!canPublish(text) || publishing}>Publicar</Button>
              </div>
              <div className="flex flex-wrap gap-1.5 md:pl-[52px]">
                {SHORTCUTS.map((a) => (
                  <Button key={a.label} type="button" variant="ghost" size="sm" className="shrink-0 text-primary" onClick={() => setText((t) => t || a.label + ': ')}><a.icon />{a.label}</Button>
                ))}
              </div>
              {publishError && <Alert variant="destructive">{publishError}</Alert>}
            </form>
          </Card>
        )}

        {feedError ? (
          <Alert variant="destructive">{feedError}</Alert>
        ) : !classId ? (
          <EmptyState title="Matricula-te para veres o feed" message="As publicações da tua turma aparecem aqui depois da matrícula." />
        ) : posts.length === 0 ? (
          <EmptyState title="Ainda não há nada por aqui" message="Sê o primeiro a partilhar uma dúvida ou um tema com a turma." />
        ) : (
          posts.map((p) => <Post key={p.id} post={p} myAccountId={myAccountId} myName={fullName(me)} />)
        )}
      </Column>

      <Rail>
        <Card className="gap-4"><CardHeader><CardTitle>Para rever</CardTitle></CardHeader>
          <CardContent className="grid gap-3.5">
            {reviewTopics.length === 0 ? (
              <p className="text-sm text-muted-foreground">Quando terminares uma prova, as que correram pior aparecem aqui.</p>
            ) : (
              reviewTopics.map((t) => <Mastery key={t.id} label={t.label} value={t.value} />)
            )}
            <Button asChild variant="outline" size="sm"><Link href="/tutor">Rever com o tutor</Link></Button>
          </CardContent>
        </Card>

        <Card className="gap-4"><CardHeader><CardTitle>Na tua turma</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {classTop.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda não há provas corrigidas na turma.</p>
            ) : (
              <ol className="grid gap-2.5">
                {classTop.map((r) => (
                  <li key={r.position} className="flex items-center gap-2.5 text-sm">
                    <span className="w-5 text-center font-semibold text-muted-foreground tabular-nums">{r.position}</span>
                    <UserAvatar name={r.displayName} size={28} /><span className="min-w-0 flex-1 truncate">{r.me ? 'Tu' : r.displayName}</span><span className="text-muted-foreground tabular-nums">{formatAverage(r.average)}%</span>
                  </li>
                ))}
              </ol>
            )}
            <Button asChild variant="link" size="sm" className="justify-start px-0"><Link href="/ranking">Ver a turma toda</Link></Button>
          </CardContent>
        </Card>

        <Card className="gap-4 md:col-span-2 xl:col-span-1"><CardHeader><CardTitle>Próximas provas</CardTitle></CardHeader>
          <CardContent className="grid gap-3.5">
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Sem salas de prova marcadas para ti.</p>}
            {upcoming.map((u) => (
              <div className="flex items-center gap-3" key={u.key}>
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
