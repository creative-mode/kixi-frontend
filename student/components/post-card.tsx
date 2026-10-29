'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Lightbulb } from 'lucide-react';
import { Ico } from '@/components/ui/ico';
import { SimulationCard } from '@/components/simulation-card';
import Link from 'next/link';
import { PostBlocksView } from '@/components/post-blocks-view';
import { UserAvatar } from '@/components/user-avatar';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/states';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { sinceLabel } from '@/lib/attempt-history';
import { VerifiedBadge } from '@/components/verified-badge';
import { CLASSMATE_LABEL, REFLECTION_LABEL, authorView, commentAuthorLabel, postTypeLabel, type FeedAuthor } from '@/lib/feed-rules';
import { addCommentAction, getCommentsAction, reportPostAction, setReactionAction } from '@/lib/feed-actions';
import type { FeedPost, PostComment } from '@/lib/feed';
import { IDLE, requestRead, settled, withComment, type Conversation } from '@/lib/feed-conversation';
import { FeedReaction, type ReactionSnapshot } from '@/lib/feed-reaction';

/** Quantas conversas se leem em segundo plano numa página: as ações do servidor correm uma de cada vez, e uma fila de leituras
 *  em segundo plano faria esperar o «aplaudir» de quem tocou entretanto. As restantes leem-se ao tocar, ou ao aproximar o dedo. */
const BACKGROUND_READS = 6;
let backgroundReads = 0;

/** Uma publicação da turma: autor, hora, texto, cartão de simulação e as ações (aplaudir, comentar, denunciar). */
export function PostCard({ post, myAccountId, myName, myPhoto, author: authorProfile, myClassId = null, initialComments }: { post: FeedPost; initialComments?: PostComment[]; myAccountId: number | null; myName: string; myPhoto?: string | null; author?: FeedAuthor; myClassId?: number | null }) {
  const [reactionController] = useState(() => new FeedReaction(post.hasReacted, (target) => setReactionAction(post.id, target)));
  const [reaction, setReaction] = useState<ReactionSnapshot>(reactionController.snapshot);
  const [count, setCount] = useState(post.commentCount);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  // A conversa só é lida quando se abre o painel, e as regras dessa leitura - uma vez
  // só, sem perder um pedido a meio de outro - estão em lib/feed-conversation.ts, onde
  // são testáveis sem DOM. Aqui fica o espelho em `ref` para o `apply` poder ler o
  // estado novo antes de o React o voltar a pintar.
  // Se o servidor já trouxe a conversa (as primeiras publicações do início), o painel abre com ela: nada a ler.
  const start = initialComments ? { ...IDLE, comments: initialComments } : IDLE;
  const [conversation, setConversation] = useState(start);
  const conversationRef = useRef(start);
  const [reading, startReading] = useTransition();
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reported, setReported] = useState(false);
  const [pending, startTransition] = useTransition();
  const card = useRef<HTMLElement>(null);
  const isPublishing = post.id < 0;
  const studyTip = post.type === 'topic' && post.content.startsWith('Dica de estudo: ');

  useEffect(() => reactionController.subscribe(setReaction), [reactionController]);
  useEffect(() => reactionController.syncConfirmed(post.hasReacted), [post.hasReacted, reactionController]);

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
    startTransition(() => reactionController.toggle());
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

  // A conversa lê-se antes de ser pedida: ao aproximar o dedo ou o rato do botão (a intenção), e, para as primeiras
  // publicações com comentários, quando entram no ecrã. Abrir o painel depois é instantâneo: a lista já lá está.
  const prefetch = () => readComments();
  useEffect(() => {
    const el = card.current;
    if (!el || post.commentCount === 0 || initialComments || typeof IntersectionObserver === 'undefined') return;
    const watcher = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting) || backgroundReads >= BACKGROUND_READS) return;
      watcher.disconnect();
      backgroundReads += 1;
      // Quando o browser estiver livre, mas no máximo daqui a 1,5 s: com imagens a descarregar, «livre» pode demorar.
      const run = () => readComments();
      if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 1500 });
      else window.setTimeout(run, 400);
    }, { rootMargin: '300px 0px' });
    watcher.observe(el);
    return () => watcher.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  const act = 'h-11 min-w-11 gap-1.5 px-3 text-muted-foreground aria-expanded:text-primary';
  const author = authorView(post, myAccountId, authorProfile, myClassId, { name: myName, photo: myPhoto ?? null });
  const typeLabel = studyTip ? 'Dica de estudo' : postTypeLabel(post.type);

  return (
    <article ref={card} className="rise flex gap-3 border-b px-4 pt-3 transition-colors hover:bg-secondary/40">
      <UserAvatar name={author.name} src={author.photo} size={44} />
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-baseline gap-x-2 leading-tight">
          {author.mine ? (
            <span className="font-bold">{author.name}</span>
          ) : (
            <Link prefetch={false} href={`/u/${post.authorAccountId}`} className="inline-flex min-h-6 items-center font-bold hover:underline focus-visible:underline">{author.name}<span className="sr-only">, ver perfil</span></Link>
          )}
          {author.verified && <VerifiedBadge label="Perfil verificado" className="self-center" />}
          {author.classmate && <span title={CLASSMATE_LABEL} role="img" aria-label={CLASSMATE_LABEL} className="self-center text-muted-foreground"><Ico name="users" size={16} /></span>}
          {isPublishing
            ? <span role="status" aria-live="polite" className="text-[14px] text-muted-foreground">· A publicar…</span>
            : <span className="text-[14px] text-muted-foreground">· {sinceLabel(post.createdAt) ?? ''}</span>}
          <span title={typeLabel} role="img" aria-label={typeLabel} className="ml-auto grid size-7 place-items-center rounded-full bg-secondary text-muted-foreground">{studyTip ? <Lightbulb size={16} aria-hidden /> : <Ico name={post.type === 'doubt' ? 'chat' : post.type === 'simulation' || post.type === 'milestone' ? 'award' : post.type === 'challenge' ? 'flame' : 'file'} size={16} />}</span>
        </header>
        <div className="mt-1 grid gap-2.5">
          {post.title && <h3 className="font-semibold">{post.title}</h3>}
          {post.simulation && <SimulationCard card={post.simulation} />}
          {post.simulation && post.content && (
            <p className="-mb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">{REFLECTION_LABEL}</p>
          )}
          {post.blocks && post.blocks.length > 0
            ? <PostBlocksView blocks={post.blocks} />
            : post.content && <p className="max-w-[62ch] leading-relaxed break-words">{post.content}</p>}
        </div>

        <div className="-ml-3 mt-1 flex items-center gap-1 py-0.5">
          <Button variant="ghost" className={cn(act, reaction.reacted && 'text-destructive')} aria-pressed={reaction.reacted} aria-label={reaction.reacted ? 'Aplaudido, tocar para retirar' : 'Aplaudir'} title="Aplaudir" disabled={isPublishing || pending || reaction.pending} aria-busy={reaction.pending} onClick={toggleReaction}>
            <Ico key={String(reaction.reacted)} name="heart" filled={reaction.reacted} size={24} className={cn(reaction.reacted && 'pop')} />
          </Button>
          <Button variant="ghost" className={act} aria-expanded={open} aria-label={`Comentar, ${count} ${count === 1 ? 'comentário' : 'comentários'}`} title="Comentar" disabled={isPublishing} onClick={togglePanel} onPointerEnter={prefetch} onTouchStart={prefetch} onFocus={prefetch}>
            <Ico name="chat" filled={open} size={24} /><span className="min-w-3 text-[14px] tabular-nums">{count}</span>
          </Button>
          <Button
            variant="ghost" size="icon" className="ml-auto text-muted-foreground aria-pressed:text-destructive"
            aria-pressed={reporting || reported} aria-label="Denunciar publicação" title="Denunciar" disabled={isPublishing || reported}
            onClick={() => setReporting((v) => !v)}
          >
            <Ico name="flag" filled={reporting || reported} size={22} />
          </Button>
        </div>

        {reaction.pending && <p className="sr-only" role="status" aria-live="polite">A guardar o aplauso…</p>}
        {reaction.error && (
          <Alert variant="destructive" className="mb-3 flex items-center justify-between gap-3">
            <span>{reaction.error}</span>
            <Button type="button" variant="outline" size="sm" disabled={reaction.pending || pending} onClick={() => startTransition(() => reactionController.retry())}>
              Tentar de novo
            </Button>
          </Alert>
        )}

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
                      src={c.mine ? myPhoto : c.photo}
                      size={32}
                    />
                    <div className="min-w-0 flex-1 rounded-2xl bg-secondary px-3 py-2">
                      <div className="flex items-baseline gap-2">
                        {c.mine ? (
                          <span className="text-sm font-semibold">{commentAuthorLabel(c.displayName, c.mine)}</span>
                        ) : (
                          <Link prefetch={false} href={`/u/${c.authorAccountId}`} className="text-sm font-semibold hover:underline focus-visible:underline">{commentAuthorLabel(c.displayName, c.mine)}<span className="sr-only">, ver perfil</span></Link>
                        )}
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
            <UserAvatar name={myName} src={myPhoto} size={32} />
            <Input className="h-9 rounded-full bg-secondary" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escreve um comentário" aria-label="Escrever um comentário" maxLength={500} />
            <Button type="submit" variant="ghost" size="icon" aria-label="Enviar comentário" disabled={pending}><Ico name="send" size={22} /></Button>
          </form>
          {commentError && <Alert variant="destructive">{commentError}</Alert>}
        </div>
      )}
      </div>
    </article>
  );
}
