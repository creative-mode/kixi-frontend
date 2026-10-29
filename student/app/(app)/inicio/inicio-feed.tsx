'use client';

import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Page, PageHeader } from '@/components/page';
import { RefreshError } from '@/components/refresh-error';
import { PostCard } from '@/components/post-card';
import { PostComposer } from '@/components/post-composer';
import { SalasDeProva } from '@/components/salas-de-prova';
import { EmptyState } from '@/components/states';
import Link from 'next/link';
import { phaseOf } from '@/lib/exam-room-rules';
import { useMe } from '@/lib/me-context';
import { fullName, photoUrl } from '@/lib/profile';
import { loadFeedPageAction } from '@/lib/feed-actions';
import { isLastFeedPage, mergeFeedPages } from '@/lib/feed-pagination';
import type { Invitation } from '@/lib/exam-room-rules';
import type { FeedPost, PostComment } from '@/lib/feed';
import type { FeedAuthor } from '@/lib/feed-rules';

/** O centro do início: as salas de prova, o compositor e o feed da turma. Os dados vêm por props:
 *  este ficheiro é cliente e tudo se lê no servidor, com o cookie da sessão (ver ./page.tsx). */
export function InicioFeed({
  invitations = [],
  invitationsError,
  myAccountId,
  classId,
  posts,
  authors = {},
  conversations = {},
  feedError,
}: {
  invitations?: Invitation[];
  invitationsError?: { message: string; status: number | null } | null;
  myAccountId: number | null;
  classId: number | null;
  posts: FeedPost[];
  authors?: Record<number, FeedAuthor>;
  /** As conversas das primeiras publicações, já lidas no servidor: o painel abre sem ir à rede. */
  conversations?: Record<number, PostComment[]>;
  feedError?: string | null;
}) {
  const me = useMe();
  // As páginas seguintes ficam ao lado da primeira: a lista do servidor continua a ser a
  // página 1, e o «Ver mais» só acrescenta o que ainda não está no ecrã.
  const [extra, setExtra] = useState<FeedPost[]>([]);
  const [moreAuthors, setMoreAuthors] = useState<Record<number, FeedAuthor>>({});
  const [page, setPage] = useState(1);
  const [end, setEnd] = useState(() => isLastFeedPage(posts.length));
  const [moreError, setMoreError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const loaded = mergeFeedPages(posts, extra);
  // A publicação nova aparece no instante em que se carrega em Publicar e é substituída pela do servidor quando chega.
  const [shown, addOptimistic] = useOptimistic(loaded, (current: FeedPost[], post: FeedPost) => [post, ...current]);

  // Depois de publicar, o servidor devolve uma página 1 nova. As páginas seguintes já não
  // encaixam nela (a mais recente empurrou as outras), por isso voltam a ser pedidas.
  const firstPageIds = posts.map((p) => p.id).join(',');
  const seenFirstPage = useRef(firstPageIds);
  useEffect(() => {
    if (seenFirstPage.current === firstPageIds) return;
    seenFirstPage.current = firstPageIds;
    setExtra([]);
    setPage(1);
    setEnd(isLastFeedPage(posts.length));
    setMoreError(null);
  }, [firstPageIds, posts.length]);

  /** Pede a página seguinte. Um erro deixa as publicações que já estão no ecrã e oferece
   *  «Tentar de novo»; o fim só se sabe quando o servidor devolve menos do que uma página. */
  const loadMore = () => {
    if (!classId || loading || end) return;
    setMoreError(null);
    startLoading(async () => {
      const result = await loadFeedPageAction(classId, page + 1, myAccountId).catch(() => ({
        ok: false as const,
        message: 'Não foi possível carregar mais publicações. Verifica a ligação e tenta de novo.',
      }));
      if (!result.ok) {
        setMoreError(result.message);
        return;
      }
      setExtra((current) => mergeFeedPages(current, result.posts));
      setMoreAuthors((current) => ({ ...current, ...result.authors }));
      setPage((current) => current + 1);
      if (isLastFeedPage(result.posts.length)) setEnd(true);
    });
  };
  // O início só mostra as salas que pedem ação (a decorrer, abertas, por abrir); as já entregues ou
  // terminadas ficam em Provas, para o feed não ficar enterrado debaixo do histórico.
  const pending = invitations.filter((inv) => ['live', 'lobby', 'scheduled'].includes(phaseOf(inv)));
  const hidden = invitations.length - pending.length;

  return (
    <Page className="gap-0 p-0 pb-24 md:pb-10">
      <PageHeader title="Início" className="m-0" />

      <div className="grid gap-3 px-4 pt-3 empty:hidden">
      <SalasDeProva invitations={pending} invitationsError={invitationsError} />
      {hidden > 0 && (
        <p className="text-[13px] text-muted-foreground">
          {hidden === 1 ? '1 sala já entregue ou terminada' : `${hidden} salas já entregues ou terminadas`} · <Link href="/provas" className="font-semibold text-primary hover:underline">ver em Provas</Link>
        </p>
      )}
      </div>

      {classId && <PostComposer classId={classId} onOptimistic={addOptimistic} />}

      {feedError ? (
        <div className="p-4"><RefreshError title="Não foi possível carregar as publicações" message={feedError} /></div>
      ) : !classId ? (
        <EmptyState title="Matricula-te para veres o feed" message="As publicações da tua turma aparecem aqui depois da matrícula." />
      ) : shown.length === 0 ? (
        <EmptyState title="Ainda não há nada por aqui" message="Sê o primeiro a partilhar uma dúvida ou um tema com a turma." />
      ) : (
        <>
          {shown.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              author={moreAuthors[p.authorAccountId] ?? authors[p.authorAccountId]}
              initialComments={conversations[p.id]}
              myClassId={classId}
              myAccountId={myAccountId}
              myName={fullName(me)}
              myPhoto={photoUrl(me)}
            />
          ))}
          <div className="px-4 py-6">
            {moreError ? (
              <Alert variant="destructive" className="flex flex-wrap items-center justify-between gap-3">
                <span className="min-w-0 flex-1">{moreError}</span>
                <Button type="button" variant="outline" size="sm" onClick={loadMore} disabled={loading}>
                  Tentar de novo
                </Button>
              </Alert>
            ) : end ? (
              <p role="status" className="text-center text-sm text-muted-foreground">Não há mais publicações.</p>
            ) : (
              <Button type="button" variant="outline" className="w-full" onClick={loadMore} disabled={loading} aria-busy={loading}>
                {loading ? <><Spinner />A carregar…</> : 'Ver mais'}
              </Button>
            )}
          </div>
        </>
      )}
    </Page>
  );
}
