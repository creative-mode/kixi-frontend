'use client';

import { useState, useTransition } from 'react';
import { Flag, MessageCircle, Send, ThumbsUp } from 'lucide-react';
import { SimulationCard } from '@/components/simulation-card';
import { UserAvatar } from '@/components/user-avatar';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { sinceLabel } from '@/lib/attempt-history';
import { REFLECTION_LABEL, authorLabel, postTypeLabel } from '@/lib/feed-rules';
import { addCommentAction, reportPostAction, toggleReactionAction } from '@/lib/feed-actions';
import type { FeedPost } from '@/lib/feed';

/** Uma publicação da turma: autor, hora, texto, cartão de simulação e as ações (aplaudir, comentar, denunciar). */
export function PostCard({ post, myAccountId, myName, myPhoto }: { post: FeedPost; myAccountId: number | null; myName: string; myPhoto?: string | null }) {
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
          <UserAvatar name={author === 'Tu' ? myName : 'Colega'} src={author === 'Tu' ? myPhoto : null} size={44} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="font-bold">{author}</div>
            <div className="text-[13px] text-muted-foreground">{sinceLabel(post.createdAt) ?? ''}</div>
          </div>
          <Badge variant="secondary">{postTypeLabel(post.type)}</Badge>
        </header>
        {post.title && <h3 className="font-semibold">{post.title}</h3>}
        {post.simulation && <SimulationCard card={post.simulation} />}
        {post.simulation && post.content && (
          <p className="-mb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">{REFLECTION_LABEL}</p>
        )}
        {post.content && <p className="max-w-[62ch] leading-relaxed">{post.content}</p>}
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
