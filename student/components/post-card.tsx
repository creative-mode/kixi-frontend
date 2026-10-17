'use client';

import { useRef, useState, useTransition } from 'react';
import { Flag, MessageCircle, Send, ThumbsUp } from 'lucide-react';
import { SimulationCard } from '@/components/simulation-card';
import { UserAvatar } from '@/components/user-avatar';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/states';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { sinceLabel } from '@/lib/attempt-history';
import { REFLECTION_LABEL, authorLabel, commentAuthorLabel, postTypeLabel } from '@/lib/feed-rules';
import { addCommentAction, getCommentsAction, reportPostAction, toggleReactionAction } from '@/lib/feed-actions';
import type { FeedPost } from '@/lib/feed';
import { IDLE, requestRead, settled, withComment, type Conversation } from '@/lib/feed-conversation';

/** Uma publicação da turma: autor, hora, texto, cartão de simulação e as ações (aplaudir, comentar, denunciar). */
export function PostCard({ post, myAccountId, myName, myPhoto }: { post: FeedPost; myAccountId: number | null; myName: string; myPhoto?: string | null }) {
  const [reacted, setReacted] = useState(post.hasReacted);
  const [count, setCount] = useState(post.commentCount);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  // A conversa só é lida quando se abre o painel, e as regras dessa leitura - uma vez
  // só, sem perder um pedido a meio de outro - estão em lib/feed-conversation.ts, onde
  // são testáveis sem DOM. Aqui fica o espelho em `ref` para o `apply` poder ler o
  // estado novo antes de o React o voltar a pintar.
  const [conversation, setConversation] = useState(IDLE);
  const conversationRef = useRef(IDLE);
  const [reading, startReading] = useTransition();
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reported, setReported] = useState(false);
  const [pending, startTransition] = useTransition();

  /** Escreve o estado nos dois sítios: o `ref` é lido no mesmo instante, antes de o
   *  React voltar a pintar, que é de onde vem a coordenação com a leitura em curso. */
  const apply = (next: Conversation) => {
    conversationRef.current = next;
    setConversation(next);
  };

  /**
   * Lê a conversa.
   *
   * <p>Um pedido que chegue a meio de outro não se perde: `requestRead` marca-o e o
   * resultado da leitura em curso, já velho, é descartado em vez de pintar a lista por
   * cima. Sem isso, escrever durante a leitura inicial tirava o comentário da lista e
   * não o trazia de volta.</p>
   */
  const readComments = (force = false) => {
    const asked = requestRead(conversationRef.current, force);
    if (asked.state !== conversationRef.current) apply(asked.state);
    if (!asked.start) return;

    startReading(async () => {
      const result = await getCommentsAction(post.id);
      const done = settled(
        conversationRef.current,
        result.ok ? result.comments : null,
        result.ok ? null : result.message,
      );
      apply(done.state);
      if (done.chained) readComments(true);
    });
  };

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
    setCommentError(null);
    startTransition(async () => {
      const result = await addCommentAction(post.id, text);
      // A contagem só sobe depois de o servidor dizer que aceitou. Antes subia na
      // mesma hora e ficava um número a mais quando a escrita falhava; o texto também
      // voltava, porque o aluno não escreve outra vez o que já escreveu.
      if (!result.ok) {
        setDraft(text);
        setCommentError(result.message);
        return;
      }
      setCount((c) => c + 1);
      // A linha que o servidor acabou de criar entra já na lista - a issue pede o
      // comentário de imediato, não depois de uma ida ao servidor - e a leitura
      // seguinte serve para confirmar a ordem e o que mais apareceu entretanto.
      apply(withComment(conversationRef.current, result.comment));
      readComments(true);
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

  // Abrir e fechar é uma decisão do clique, não do updater: um efeito dentro de
  // `setOpen(v => ...)` corre duas vezes em modo estrito e pediria a lista duas vezes.
  const togglePanel = () => {
    const next = !open;
    setOpen(next);
    if (next) readComments();
  };

  const act = 'h-11 gap-2 px-3 text-muted-foreground aria-pressed:text-primary aria-expanded:text-foreground';
  const author = authorLabel(post.authorAccountId, myAccountId);

  return (
    <article className="flex gap-3 border-b px-4 pt-3 transition-colors hover:bg-secondary/40">
      <UserAvatar name={author === 'Tu' ? myName : 'Colega'} src={author === 'Tu' ? myPhoto : null} size={44} />
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-baseline gap-x-2 leading-tight">
          <span className="font-bold">{author}</span>
          <span className="text-[14px] text-muted-foreground">· {sinceLabel(post.createdAt) ?? ''}</span>
          <Badge variant="secondary" className="ml-auto">{postTypeLabel(post.type)}</Badge>
        </header>
        <div className="mt-1 grid gap-2.5">
          {post.title && <h3 className="font-semibold">{post.title}</h3>}
          {post.simulation && <SimulationCard card={post.simulation} />}
          {post.simulation && post.content && (
            <p className="-mb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">{REFLECTION_LABEL}</p>
          )}
          {post.content && <p className="max-w-[62ch] leading-relaxed break-words">{post.content}</p>}
        </div>

        <div className="-ml-3 mt-1 flex flex-wrap items-center gap-0.5 py-0.5">
          <Button variant="ghost" className={act} aria-pressed={reacted} disabled={pending} onClick={toggleReaction}>
            <ThumbsUp className={cn(reacted && 'fill-primary/15')} />Aplaudir
          </Button>
          <Button variant="ghost" className={act} aria-expanded={open} onClick={togglePanel}>
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
        <div className="pb-3">
          <Alert variant="success">Denúncia enviada. A equipa da escola vai rever.</Alert>
        </div>
      )}

      {reporting && !reported && (
        <form className="grid gap-2 pb-3" onSubmit={sendReport}>
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
        <div className="grid gap-3 border-t py-3">
          <div className="grid gap-3">
            {conversation.error ? (
              <Alert variant="destructive">
                <span className="flex-1">{conversation.error}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => readComments(true)}>Tentar de novo</Button>
              </Alert>
            ) : reading && conversation.comments === null ? (
              <LoadingState label="A carregar os comentários…" lines={3} />
            ) : conversation.comments === null || conversation.comments.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">Ainda não há comentários nesta publicação.</p>
            ) : (
              <ol className="grid gap-3">
                {conversation.comments.map((c) => (
                  <li key={c.id} className="flex items-start gap-2.5">
                    <UserAvatar
                      name={commentAuthorLabel(c.displayName, c.mine)}
                      src={c.mine ? myPhoto : null}
                      size={32}
                    />
                    <div className="min-w-0 flex-1 rounded-2xl bg-secondary px-3 py-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold">{commentAuthorLabel(c.displayName, c.mine)}</span>
                        <span className="text-xs text-muted-foreground">{sinceLabel(c.createdAt) ?? ''}</span>
                      </div>
                      <p className="text-sm leading-relaxed break-words">{c.content}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <form className="flex items-center gap-2.5" onSubmit={sendComment}>
            <UserAvatar name={myName} size={32} />
            <Input className="h-9 rounded-full bg-secondary" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escreve um comentário" aria-label="Escrever um comentário" maxLength={500} />
            <Button type="submit" variant="ghost" size="icon" aria-label="Enviar comentário" disabled={pending}><Send /></Button>
          </form>
          {commentError && <Alert variant="destructive">{commentError}</Alert>}
        </div>
      )}
      </div>
    </article>
  );
}
