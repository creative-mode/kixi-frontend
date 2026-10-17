'use client';

import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/page';
import { PostCard } from '@/components/post-card';
import { PostComposer } from '@/components/post-composer';
import { SalasDeProva } from '@/components/salas-de-prova';
import { EmptyState } from '@/components/states';
import Link from 'next/link';
import { phaseOf } from '@/lib/exam-room-rules';
import { useMe } from '@/lib/me-context';
import { fullName, photoUrl } from '@/lib/profile';
import type { Invitation } from '@/lib/exam-room-rules';
import type { FeedPost } from '@/lib/feed';

/** O centro do início: as salas de prova, o compositor e o feed da turma. Os dados vêm por props:
 *  este ficheiro é cliente e tudo se lê no servidor, com o cookie da sessão (ver ./page.tsx). */
export function InicioFeed({
  invitations = [],
  invitationsError,
  myAccountId,
  classId,
  posts,
  feedError,
}: {
  invitations?: Invitation[];
  invitationsError?: { message: string; status: number | null } | null;
  myAccountId: number | null;
  classId: number | null;
  posts: FeedPost[];
  feedError?: string | null;
}) {
  const me = useMe();
  // O início só mostra as salas que pedem ação (a decorrer, abertas, por abrir); as já entregues ou
  // terminadas ficam em Provas, para o feed não ficar enterrado debaixo do histórico.
  const pending = invitations.filter((inv) => ['live', 'lobby', 'scheduled'].includes(phaseOf(inv)));
  const hidden = invitations.length - pending.length;

  return (
    <>
      <PageHeader title="Início" />

      <SalasDeProva invitations={pending} invitationsError={invitationsError} />
      {hidden > 0 && (
        <p className="text-[13px] text-muted-foreground">
          {hidden === 1 ? '1 sala já entregue ou terminada' : `${hidden} salas já entregues ou terminadas`} · <Link href="/provas" className="font-semibold text-primary hover:underline">ver em Provas</Link>
        </p>
      )}

      {classId && <PostComposer classId={classId} />}

      {feedError ? (
        <Alert variant="destructive">{feedError}</Alert>
      ) : !classId ? (
        <EmptyState title="Matricula-te para veres o feed" message="As publicações da tua turma aparecem aqui depois da matrícula." />
      ) : posts.length === 0 ? (
        <EmptyState title="Ainda não há nada por aqui" message="Sê o primeiro a partilhar uma dúvida ou um tema com a turma." />
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} myAccountId={myAccountId} myName={fullName(me)} myPhoto={photoUrl(me)} />)
      )}
    </>
  );
}
