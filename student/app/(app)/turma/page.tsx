import { RefreshError } from '@/components/refresh-error';
import { EmptyState } from '@/components/states';
import { Page, PageHeader } from '@/components/page';
import { getFeed, loadAuthors } from '@/lib/feed';
import { getLeaderboard } from '@/lib/ranking';
import { getProfile } from '@/lib/me';
import { fullName } from '@/lib/profile';
import { FEED_PAGE_SIZE } from '@/lib/feed-pagination';
import { TurmaView } from './turma-view';

export const metadata = { title: 'Turma · Kixi' };

/**
 * A Turma (#728): as dúvidas da turma (o feed filtrado a `type === 'doubt'`) e as médias
 * (a mesma tabela do ranking, aba turma). Substitui o destino "Ranking" na barra principal —
 * o ranking continua a existir em `/ranking`, com as outras abas (escola, amigos, global).
 */
export default async function TurmaPage() {
  const profile = await getProfile();
  if (profile.kind !== 'ok') {
    return (
      <Page>
        <RefreshError title="Não foi possível carregar a tua turma" message="O servidor não respondeu a tempo. Tenta de novo — se continuar, fala com o teu professor." />
      </Page>
    );
  }
  const me = profile.me;
  const classId = me.currentClass?.id ?? null;
  const className = me.currentClass?.code ?? null;

  if (!classId) {
    return (
      <Page>
        <PageHeader title="Turma" />
        <EmptyState title="Ainda sem turma" message="Matricula-te com o código da tua escola para veres as dúvidas e as médias da tua turma." />
      </Page>
    );
  }

  const [feed, board] = await Promise.all([getFeed(classId, 1, FEED_PAGE_SIZE), getLeaderboard('class')]);
  const posts = feed.ok ? feed.data.filter((p) => p.type === 'doubt') : [];
  const authors = feed.ok ? await loadAuthors(feed.data, me.accountId) : {};

  return (
    <TurmaView
      className={className}
      classId={classId}
      myAccountId={me.accountId}
      myName={fullName(me) || 'Tu'}
      myPhoto={me.photo}
      posts={posts}
      authors={authors}
      feedError={feed.ok ? null : feed.message}
      board={board.ok ? board.data : null}
      boardError={board.ok ? null : board.message}
    />
  );
}
