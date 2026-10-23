'use client';

import { useOptimistic } from 'react';
import { Alert } from '@/components/ui/alert';
import { Page, PageHeader } from '@/components/page';
import { PostCard } from '@/components/post-card';
import { PostComposer } from '@/components/post-composer';
import { SalasDeProva } from '@/components/salas-de-prova';
import { EmptyState } from '@/components/states';
import Link from 'next/link';
import { phaseOf } from '@/lib/exam-room-rules';
import { useMe } from '@/lib/me-context';
import { fullName, photoUrl } from '@/lib/profile';
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
  // A publicação nova aparece no instante em que se carrega em Publicar e é substituída pela do servidor quando chega.
  const [shown, addOptimistic] = useOptimistic(posts, (current: FeedPost[], post: FeedPost) => [post, ...current]);
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
        <div className="p-4"><Alert variant="destructive">{feedError}</Alert></div>
      ) : !classId ? (
        <EmptyState title="Matricula-te para veres o feed" message="As publicações da tua turma aparecem aqui depois da matrícula." />
      ) : shown.length === 0 ? (
        <EmptyState title="Ainda não há nada por aqui" message="Sê o primeiro a partilhar uma dúvida ou um tema com a turma." />
      ) : (
        shown.map((p) => <PostCard key={p.id} post={p} author={authors[p.authorAccountId]} initialComments={conversations[p.id]} myClassId={classId} myAccountId={myAccountId} myName={fullName(me)} myPhoto={photoUrl(me)} />)
      )}
    </Page>
  );
}
