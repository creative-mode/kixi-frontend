import { listInvitations } from '@/lib/exam-room';
import { getMe } from '@/lib/me';
import { getFeed } from '@/lib/feed';
import { InicioFeed } from './inicio-feed';

/**
 * O início, com as salas de prova do aluno por cima do feed.
 *
 * Os convites leem-se aqui, no servidor, porque `GET /exam-rooms/mine` precisa do
 * cookie da sessão. O resto do feed é estado do cliente. Uma falha a ler as salas
 * não leva o feed com ela: a secção simplesmente não aparece.
 *
 * Trazido do #125 (Cxdy008), sobre a secção do #128.
 *
 * O feed social (#120/#30) só se pede quando há turma: sem matrícula não há
 * `classId` para o `GET /feed/posts` exigir, e pedir sem ele dava 400 em vez de um
 * feed vazio - que é o que quem ainda não se matriculou deve ver.
 */
export default async function InicioPage() {
  const me = await getMe();
  const classId = me?.currentClass?.id ?? null;

  const [invitations, feed] = await Promise.all([
    listInvitations(),
    classId ? getFeed(classId) : Promise.resolve(null),
  ]);

  return (
    <InicioFeed
      invitations={invitations}
      myAccountId={me?.accountId ?? null}
      classId={classId}
      posts={feed?.ok ? feed.data : []}
      feedError={feed && !feed.ok ? feed.message : null}
    />
  );
}
