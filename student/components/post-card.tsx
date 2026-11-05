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
import { CLASSMATE_LABEL, CROSS_SCHOOL_LABEL, REFLECTION_LABEL, authorView, commentAuthorLabel, doubtStatusOf, postTypeLabel, type FeedAuthor } from '@/lib/feed-rules';
import { acceptAnswerAction, addCommentAction, getCommentsAction, reportPostAction, setReactionAction } from '@/lib/feed-actions';
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
  const [reportContext, setReportContext] = useState('');
  const [reportError, setReportError] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const [pending, startTransition] = useTransition();
  const [accepting, startAccepting] = useTransition();
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const card = useRef<HTMLElement>(null);
  const replyInput = useRef<HTMLInputElement>(null);
  const isPublishing = post.id < 0;
  const studyTip = post.type === 'topic';
  /** Quem pergunta pode marcar a resposta certa; só faz sentido numa dúvida (#728). */
  const canAccept = post.type === 'doubt' && myAccountId != null && post.authorAccountId === myAccountId;

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
    const labels: Record<string, string> = {
      spam: 'Spam ou publicidade',
      offensive: 'Conteúdo ofensivo',
      other: 'Outro motivo',
    };
    const reason = reportReason === 'other' && reportContext.trim()
      ? `${labels.other}: ${reportContext.trim()}`
      : labels[reportReason];
    if (!reason) return;
    setReportError(null);
    startTransition(async () => {
      const result = await reportPostAction(post.id, reason);
      if (result.ok) {
        setReported(true);
        setReporting(false);
      } else {
        setReportError(result.message);
      }
    });
  };

  /** O autor da dúvida marca a resposta certa; as outras linhas perdem a marca sozinhas,
   *  porque só uma pode ser a aceite (#728). */
  const acceptAnswer = (commentId: number) => {
    setAcceptError(null);
    startAccepting(async () => {
      const result = await acceptAnswerAction(post.id, commentId);
      if (!result.ok) {
        setAcceptError(result.message);
        return;
      }
      const current = conversationRef.current.comments ?? [];
      apply({ ...conversationRef.current, comments: current.map((c) => ({ ...c, isAccepted: c.id === commentId })) });
    });
  };

  /** A conversa lê-se antes de ser pedida: ao aproximar o dedo ou o rato do botão "Responder"
   *  (a intenção), e, para as primeiras publicações com comentários, quando entram no ecrã. */
  const prefetch = () => readComments();
  const focusReply = () => {
    readComments();
    replyInput.current?.focus();
  };
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
  const acceptedComment = conversation.comments?.find((c) => c.isAccepted) ?? null;
  const doubtStatus = doubtStatusOf(post.type, count, acceptedComment);

  return (
    <article ref={card} className={cn('rise flex gap-3 border-b px-4 pt-3 transition-colors hover:bg-secondary/40', doubtStatus?.kind === 'unanswered' && '-mx-px border-l-[3px] border-l-destructive bg-destructive/5 pl-[13px]')}>
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
          {post.simulation && (
            <SimulationCard
              card={post.simulation}
              // O `/resultado?prova={id}` lê a simulação de quem está a ver: só o
              // dono recebe o link, para um colega não aterrar num 403 (#602).
              correctionHref={
                post.authorAccountId === myAccountId && post.simulation.simulationId != null
                  ? `/resultado?prova=${post.simulation.simulationId}`
                  : null
              }
            />
          )}
          {post.simulation && post.content && (
            <p className="-mb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">{REFLECTION_LABEL}</p>
          )}
          {post.blocks && post.blocks.length > 0
            ? <PostBlocksView blocks={post.blocks} />
            : post.content && <p className="max-w-[62ch] leading-relaxed break-words">{post.content}</p>}
        </div>

        {doubtStatus?.kind === 'resolved' && (
          <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-primary"><Ico name="check" size={14} />Resolvido · resposta aceite de {doubtStatus.acceptedByName}</p>
        )}
        {doubtStatus?.kind === 'unanswered' && (
          <p className="mt-1 text-[13px] font-semibold text-destructive">Sem resposta ainda — podes ser o primeiro a ajudar</p>
        )}

        <div className="-ml-3 mt-1 flex items-center gap-1 py-0.5">
          <Button variant="ghost" className={cn(act, reaction.reacted && 'text-destructive')} aria-pressed={reaction.reacted} aria-label={reaction.reacted ? 'Aplaudido, tocar para retirar' : 'Aplaudir'} title="Aplaudir" disabled={isPublishing || pending || reaction.pending} aria-busy={reaction.pending} onClick={toggleReaction}>
            <Ico key={String(reaction.reacted)} name="heart" filled={reaction.reacted} size={24} className={cn(reaction.reacted && 'pop')} />
          </Button>
          <Button variant="ghost" className={act} aria-label={doubtStatus?.kind === 'unanswered' ? 'Responder' : `${count} ${count === 1 ? 'comentário' : 'comentários'}`} title={doubtStatus?.kind === 'unanswered' ? 'Responder' : 'Comentários'} disabled={isPublishing} onClick={focusReply} onPointerEnter={prefetch} onTouchStart={prefetch} onFocus={prefetch}>
            <Ico name="chat" size={24} />
            {doubtStatus?.kind === 'unanswered' ? <span className="text-[14px] font-bold">Responder</span> : <span className="min-w-3 text-[14px] tabular-nums">{count}</span>}
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
        <form className="grid gap-3 pb-3" onSubmit={sendReport}>
          <fieldset className="grid gap-2" disabled={pending}>
            <legend className="text-sm font-semibold">Porque queres denunciar esta publicação?</legend>
            {[
              ['spam', 'Spam ou publicidade'],
              ['offensive', 'Conteúdo ofensivo'],
              ['other', 'Outro motivo'],
            ].map(([value, label]) => (
              <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm hover:bg-secondary">
                <input
                  type="radio"
                  name={`report-reason-${post.id}`}
                  value={value}
                  checked={reportReason === value}
                  onChange={() => { setReportReason(value); setReportError(null); }}
                />
                {label}
              </label>
            ))}
          </fieldset>
          {reportReason === 'other' && (
            <Input
              value={reportContext}
              onChange={(e) => { setReportContext(e.target.value); setReportError(null); }}
              placeholder="Acrescenta um contexto (opcional)"
              aria-label="Contexto da denúncia (opcional)"
              maxLength={500}
              disabled={pending}
            />
          )}
          {reportError && (
            <div className="grid gap-2">
              <Alert variant="destructive">{reportError}</Alert>
              <Button type="submit" variant="outline" size="sm" className="justify-self-start" disabled={pending || !reportReason}>
                {pending ? 'A enviar…' : 'Tentar de novo'}
              </Button>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setReporting(false)} disabled={pending}>Cancelar</Button>
            {!reportError && <Button type="submit" size="sm" variant="destructive" disabled={!reportReason || pending}>{pending ? 'A enviar…' : 'Denunciar'}</Button>}
          </div>
        </form>
      )}

      {/* As respostas ficam sempre visíveis, indentadas, com a linha de conexão (#728):
          o painel que se abria e fechava desapareceu, não só o seu gatilho. */}
      {count > 0 && (
        <div className="mt-2 flex gap-2.5">
          <div className="flex w-[34px] shrink-0 justify-center" aria-hidden="true"><span className="w-px flex-1 bg-border" /></div>
          <div className="min-w-0 flex-1">
            {conversation.error ? (
              <Alert variant="destructive" className="mb-3">
                <span className="flex-1">{conversation.error}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => readComments(true)}>Tentar de novo</Button>
              </Alert>
            ) : reading && conversation.comments === null ? (
              <LoadingState label="A carregar as respostas…" lines={2} />
            ) : conversation.comments === null || conversation.comments.length === 0 ? null : (
              <ol className="grid gap-4 pb-3">
                {conversation.comments.map((c) => (
                  <li key={c.id} className="flex items-start gap-2.5">
                    <UserAvatar name={commentAuthorLabel(c.displayName, c.mine)} src={c.mine ? myPhoto : c.photo} size={32} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        {c.mine ? (
                          <span className="text-[13px] font-bold">{commentAuthorLabel(c.displayName, c.mine)}</span>
                        ) : (
                          <Link prefetch={false} href={`/u/${c.authorAccountId}`} className="text-[13px] font-bold hover:underline focus-visible:underline">{commentAuthorLabel(c.displayName, c.mine)}<span className="sr-only">, ver perfil</span></Link>
                        )}
                        {c.crossSchool && <span className="rounded-full border px-2 py-0.5 text-[11px] font-bold text-muted-foreground">{CROSS_SCHOOL_LABEL}</span>}
                        <span className="text-[12px] text-muted-foreground">{sinceLabel(c.createdAt) ?? ''}</span>
                      </div>
                      <p className="text-[14px] leading-relaxed break-words">{c.content}</p>
                      {c.isAccepted ? (
                        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-primary"><Ico name="check" size={13} />Resposta aceite</p>
                      ) : canAccept && !acceptedComment ? (
                        <button type="button" className="w-fit text-[12.5px] font-bold text-muted-foreground hover:text-primary disabled:opacity-50" disabled={accepting} onClick={() => acceptAnswer(c.id)}>
                          {accepting ? 'A aceitar…' : 'Aceitar como resposta'}
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {acceptError && <Alert variant="destructive" className="mb-3">{acceptError}</Alert>}
          </div>
        </div>
      )}

      <form className={cn('flex items-center gap-2.5 py-3', count > 0 && 'border-t')} onSubmit={sendComment}>
        <UserAvatar name={myName} src={myPhoto} size={32} />
        <Input ref={replyInput} className="h-11 rounded-full bg-secondary" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escreve uma resposta" aria-label="Escrever uma resposta" maxLength={500} />
        <Button type="submit" variant="ghost" size="icon" aria-label="Enviar resposta" disabled={pending}><Ico name="send" size={22} /></Button>
      </form>
      {commentError && <Alert variant="destructive" className="mb-3">{commentError}</Alert>}
      </div>
    </article>
  );
}
