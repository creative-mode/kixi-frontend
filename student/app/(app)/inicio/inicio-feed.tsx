'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { RefreshError } from '@/components/refresh-error';
import { PostCard } from '@/components/post-card';
import { UserAvatar } from '@/components/user-avatar';
import { EmptyState } from '@/components/states';
import Link from 'next/link';
import { useMe } from '@/lib/me-context';
import { fullName, photoUrl } from '@/lib/profile';
import { loadFeedPageAction } from '@/lib/feed-actions';
import { isLastFeedPage, mergeFeedPages } from '@/lib/feed-pagination';
import type { FeedPost, PostComment } from '@/lib/feed';
import type { FeedAuthor } from '@/lib/feed-rules';

/** O centro do início: as salas de prova, o compositor e o feed da turma. Os dados vêm por props:
 *  este ficheiro é cliente e tudo se lê no servidor, com o cookie da sessão (ver ./page.tsx). */
export function InicioFeed({
  myAccountId,
  classId,
  posts,
  authors = {},
  conversations = {},
  feedError,
  topo,
}: {
  myAccountId: number | null;
  classId: number | null;
  posts: FeedPost[];
  authors?: Record<number, FeedAuthor>;
  /** As conversas das primeiras publicações, já lidas no servidor: o painel abre sem ir à rede. */
  conversations?: Record<number, PostComment[]>;
  feedError?: string | null;
  /** O cartão da próxima prova, entregue pelo servidor. */
  topo?: React.ReactNode;
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
  const shown = loaded;

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
  return (
    <div className="flex min-w-0 flex-col gap-3.5 px-4 pt-3 pb-24 md:gap-5 md:px-0 md:pt-7 md:pb-10">
      <div className="md:hidden">{topo}</div>
      {classId && (
        <Link href="/publicar" className="flex items-center gap-3 rounded-full border border-[#e9ebe7] bg-white px-3.5 py-3 text-[#121c15] no-underline">
          <UserAvatar name={fullName(me) || 'Aluno'} src={photoUrl(me)} size={44} />
          <span className="min-w-0 flex-1 truncate text-[15px] text-[#617066]">Partilha uma dúvida ou uma dica…</span>
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#1f5a2c] text-white"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg></span>
        </Link>
      )}

      {feedError ? (
        <div><RefreshError title="Não foi possível carregar as publicações" message={feedError} /></div>
      ) : !classId ? (
        <EmptyState title="Matricula-te para veres o feed" message="As publicações da tua turma aparecem aqui depois da matrícula." />
      ) : shown.length === 0 ? (
        <EmptyState title="Ainda não há nada por aqui" message="Sê o primeiro a partilhar uma dúvida ou um tema com a turma." />
      ) : (
        <>
          <section className="flex flex-col md:sheet md:px-6 md:py-1">
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
          </section>
          <div className="pb-2">
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
    </div>
  );
}
