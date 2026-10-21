'use client';

import { useEffect, useOptimistic, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Page, PageHeader } from '@/components/page';
import { PostCard } from '@/components/post-card';
import { PostComposer } from '@/components/post-composer';
import { EmptyState } from '@/components/states';
import { useMe } from '@/lib/me-context';
import { fullName, photoUrl } from '@/lib/profile';
import type { FeedPost } from '@/lib/feed';
import type { FeedAuthor } from '@/lib/feed-rules';
import { loadFeedAuthorsAction } from '@/lib/feed-actions';

/** O centro do início: as salas de prova, o compositor e o feed da turma. Os dados vêm por props:
 *  este ficheiro é cliente; os painéis independentes chegam em streaming (ver ./page.tsx). */
export function InicioFeed({
  myAccountId,
  classId,
  posts,
  feedError,
}: {
  myAccountId: number | null;
  classId: number | null;
  posts: FeedPost[];
  feedError?: string | null;
}) {
  const me = useMe();
  const [authors, setAuthors] = useState<Record<number, FeedAuthor>>({});
  const authorIds = [...new Set(posts.map((post) => post.authorAccountId).filter((id) => id !== myAccountId))].sort((a, b) => a - b);
  const authorKey = authorIds.join(',');
  useEffect(() => {
    if (!authorKey) return;
    let active = true;
    void loadFeedAuthorsAction(authorIds, myAccountId).then((result) => {
      if (active && result.ok) setAuthors(result.authors);
    }).catch(() => undefined);
    return () => { active = false; };
    // The sorted id key intentionally makes this one request per feed author set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorKey, myAccountId]);
  // A publicação nova aparece no instante em que se carrega em Publicar e é substituída pela do servidor quando chega.
  const [shown, addOptimistic] = useOptimistic(posts, (current: FeedPost[], post: FeedPost) => [post, ...current]);
  return (
    <Page className="gap-0 p-0 pb-24 md:pb-10">
      <PageHeader title="Início" className="m-0" />

      {classId && <PostComposer classId={classId} onOptimistic={addOptimistic} />}

      {feedError ? (
        <div className="p-4"><Alert variant="destructive">{feedError}</Alert></div>
      ) : !classId ? (
        <EmptyState title="Matricula-te para veres o feed" message="As publicações da tua turma aparecem aqui depois da matrícula." />
      ) : shown.length === 0 ? (
        <EmptyState title="Ainda não há nada por aqui" message="Sê o primeiro a partilhar uma dúvida ou um tema com a turma." />
      ) : (
        shown.map((p) => <PostCard key={p.id} post={p} author={authors[p.authorAccountId]} myClassId={classId} myAccountId={myAccountId} myName={fullName(me)} myPhoto={photoUrl(me)} />)
      )}
    </Page>
  );
}
