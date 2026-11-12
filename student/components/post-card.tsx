'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ico } from '@/components/ui/ico';
import Link from 'next/link';
import { UserAvatar } from '@/components/user-avatar';
import { PostBody, PostHeader } from '@/components/post-parts';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/states';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { PostActionsMenu } from '@/components/post-actions-menu';
import { sinceLabel } from '@/lib/attempt-history';
import { authorView, commentAuthorLabel, postTypeLabel, type FeedAuthor } from '@/lib/feed-rules';
import { addCommentAction, deleteCommentAction, deletePostAction, getCommentsAction, reportPostAction, setReactionAction, updateCommentAction } from '@/lib/feed-actions';
import type { FeedPost, PostComment } from '@/lib/feed';
import { IDLE, requestRead, settled, withComment, type Conversation } from '@/lib/feed-conversation';
import { FeedReaction, type ReactionSnapshot } from '@/lib/feed-reaction';

/** Quantas conversas se leem em segundo plano numa página: as ações do servidor correm uma de cada vez, e uma fila de leituras
 *  em segundo plano faria esperar o «aplaudir» de quem tocou entretanto. As restantes leem-se ao tocar, ou ao aproximar o dedo. */
const BACKGROUND_READS = 6;
let backgroundReads = 0;

/** Uma publicação da turma: autor, hora, texto, cartão de simulação e as ações (aplaudir, comentar, denunciar). */
export function PostCard({ post, myAccountId, myName, myPhoto, author: authorProfile, myClassId = null, initialComments }: { post: FeedPost; initialComments?: PostComment[]; myAccountId: number | null; myName: string; myPhoto?: string | null; author?: FeedAuthor; myClassId?: number | null }) {
  const router = useRouter();
  const toast = useToast();
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
  const [reportContext, setReportContext] = useState('');
  const [reportError, setReportError] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const [pending, startTransition] = useTransition();
  const card = useRef<HTMLElement>(null);
  const isPublishing = post.id < 0;
  const studyTip = post.type === 'topic';

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

  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [savingComment, setSavingComment] = useState(false);

  /** Editar o comentário no próprio sítio (#753): guardar troca a linha pelo texto novo sem recarregar a conversa. */
  const saveComment = (comment: PostComment) => {
    const text = commentDraft.trim();
    if (!text) return;
    if (text === comment.content) { setEditingComment(null); return; }
    setSavingComment(true);
    setCommentError(null);
    startTransition(async () => {
      const result = await updateCommentAction(post.id, comment.id, text);
      setSavingComment(false);
      if (!result.ok) { setCommentError(result.message); return; }
      const comments = conversationRef.current.comments?.map((c) => (c.id === comment.id
        ? { ...c, content: result.comment.content, edited: result.comment.edited ?? true }
        : c)) ?? null;
      apply({ ...conversationRef.current, comments });
      setEditingComment(null);
      toast('Comentário editado.');
    });
  };

  /** Eliminar o comentário: o servidor confirma e a linha sai já da conversa, com a contagem a descer. */
  const removeComment = async (comment: PostComment) => {
    const result = await deleteCommentAction(post.id, comment.id);
    if (result.ok) {
      setCount((c) => Math.max(0, c - 1));
      const comments = conversationRef.current.comments?.filter((c) => c.id !== comment.id) ?? null;
      apply({ ...conversationRef.current, comments });
    }
    return result;
  };

  const removePost = async () => {
    const result = await deletePostAction(post.id);
    // O cartão não é uma lista local: recarregar o servidor tira-o do feed sem perder a posição do resto.
    if (result.ok) router.refresh();
    return result;
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

  const author = authorView(post, myAccountId, authorProfile, myClassId, { name: myName, photo: myPhoto ?? null });
  const typeLabel = studyTip ? 'Dica de estudo' : postTypeLabel(post.type);

  return (
    <article ref={card} className="post rise">
      <div className="min-w-0">
        <PostHeader
          author={{ name: author.name, photo: author.photo, verified: author.verified, classmate: author.classmate, href: author.mine ? undefined : `/u/${post.authorAccountId}` }}
          typeLabel={typeLabel}
          when={sinceLabel(post.createdAt) ?? ''}
          publishing={isPublishing}
          edited={post.edited}
        />
        <PostBody
          post={post}
          // O `/resultado?prova={id}` lê a simulação de quem está a ver: só o
          // dono recebe o link, para um colega não aterrar num 403 (#602).
          correctionHref={post.authorAccountId === myAccountId && post.simulation?.simulationId != null ? `/resultado?prova=${post.simulation.simulationId}` : null}
        />

        <span className="acoes">
          <button type="button" className="acao" aria-expanded={open} aria-label={`Comentar, ${count} ${count === 1 ? 'comentário' : 'comentários'}`} title="Comentar" disabled={isPublishing} onClick={togglePanel} onPointerEnter={prefetch} onTouchStart={prefetch} onFocus={prefetch}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 1 4 7.5L3 21l1.6-4.3A8.96 8.96 0 0 1 3 12Z" /></svg>{count}</button>
          <button type="button" className="acao" aria-pressed={reaction.reacted} aria-label={reaction.reacted ? 'Aplaudido, tocar para retirar' : 'Aplaudir'} title="Aplaudir" disabled={isPublishing || pending || reaction.pending} aria-busy={reaction.pending} onClick={toggleReaction}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 11v9H4v-9zm0 0 4-7a2 2 0 0 1 3.6 1.7L13 10h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H9a2 2 0 0 1-2-2" /></svg>{reaction.reacted ? 1 : ''}</button>
          {/* Denunciar não aparece na própria publicação (#753), e o menu «⋯» só no que é do autor. */}
          {post.authorAccountId !== myAccountId && (
            <button type="button" className="acao ml-auto" aria-pressed={reporting || reported} aria-label="Denunciar publicação" title="Denunciar" disabled={isPublishing || reported} onClick={() => setReporting((v) => !v)}>
              <Ico name="flag" filled={reporting || reported} size={15} />
            </button>
          )}
          {post.authorAccountId === myAccountId && !isPublishing && (
            <PostActionsMenu
              what="publicação"
              className="ml-auto"
              canEdit={!post.isAutoGenerated && post.type !== 'simulation'}
              onEdit={() => router.push(`/publicar?editar=${post.id}`)}
              onDelete={removePost}
              deletedMessage="Publicação eliminada."
            />
          )}
        </span>

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

      {conversation.comments && conversation.comments.length > 0 && (
        <div className="mt-1 flex gap-3">
          <div className="flex w-[38px] shrink-0 justify-center"><span className="w-0.5 self-stretch bg-[#dbe0da]" aria-hidden="true" /></div>
          <ol className="flex min-w-0 flex-1 flex-col gap-[18px]">
            {conversation.comments.map((c) => {
              const who = commentAuthorLabel(c.displayName, c.mine);
              return (
                <li key={c.id} className="flex flex-col gap-2.5">
                  <div className="flex items-start gap-3">
                    <UserAvatar name={who} src={c.mine ? myPhoto : c.photo} size={38} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      {c.mine ? <strong className="text-sm">{who}</strong> : <Link prefetch={false} href={`/u/${c.authorAccountId}`} className="inline-flex min-h-6 items-center text-sm font-bold hover:underline">{who}<span className="sr-only">, ver perfil</span></Link>}
                      <span className="lbl">{sinceLabel(c.createdAt) ?? ''}{c.edited ? ' · editado' : ''}</span>
                    </span>
                    {c.mine && editingComment !== c.id && (
                      <PostActionsMenu
                        what="comentário"
                        disabled={savingComment}
                        onEdit={() => { setEditingComment(c.id); setCommentDraft(c.content); setCommentError(null); }}
                        onDelete={() => removeComment(c)}
                        deletedMessage="Comentário eliminado."
                      />
                    )}
                  </div>
                  {editingComment === c.id ? (
                    <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); saveComment(c); }}>
                      <Input
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        aria-label="Editar comentário"
                        maxLength={500}
                        autoFocus
                        disabled={savingComment}
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" disabled={savingComment} onClick={() => { setEditingComment(null); setCommentError(null); }}>Cancelar</Button>
                        <Button type="submit" size="sm" disabled={savingComment || !commentDraft.trim()}>{savingComment ? 'A guardar…' : 'Guardar'}</Button>
                      </div>
                      {commentError && <Alert variant="destructive">{commentError}</Alert>}
                    </form>
                  ) : (
                    <p className="ttl">{c.content}</p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {open && (
        <div className="grid gap-3 pt-3">
          {conversation.error && (
            <Alert variant="destructive">
              <span className="flex-1">{conversation.error}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => readComments(true)}>Tentar de novo</Button>
            </Alert>
          )}
          {reading && conversation.comments === null && <LoadingState label="A carregar os comentários…" lines={3} />}
          <form className="flex items-center gap-2.5" onSubmit={sendComment}>
            <UserAvatar name={myName} src={myPhoto} size={38} />
            <Input className="h-11 rounded-full bg-secondary" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escreve uma resposta" aria-label="Escrever um comentário" maxLength={500} />
            <Button type="submit" variant="ghost" size="icon" aria-label="Enviar comentário" disabled={pending}><Ico name="send" size={22} /></Button>
          </form>
          {commentError && <Alert variant="destructive">{commentError}</Alert>}
        </div>
      )}
      </div>
    </article>
  );
}
