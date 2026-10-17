import { PerfilView } from '@/components/perfil-view';
import { RefreshError } from '@/components/refresh-error';
import { FriendsCard } from '@/components/social/friends-card';
import { ProfileCard } from '@/components/social/profile-card';
import { RightRail } from '@/components/social/right-rail';
import { SocialLayout } from '@/components/social/social-layout';
import { getFeed } from '@/lib/feed';
import { getProfile } from '@/lib/me';
import { loadSocial } from '@/lib/social';
import { ownPosts, profileTabOf } from '@/lib/social-rules';

/**
 * O perfil, em três colunas. Ao meio, o cabeçalho, as últimas simulações e os separadores
 * (publicações, atividade, desempenho, medalhas, histórico e definições). `?tab=` abre um separador
 * e `?editar=1` abre o editor, que é para onde levam os atalhos do cartão do aluno.
 */
export default async function PerfilPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [profile, query] = await Promise.all([getProfile(), searchParams]);

  // Sem resposta do backend não há perfil para mostrar. Um erro explícito com
  // "Tentar de novo" é melhor do que um ecrã em branco — e o `apiGet` corta aos
  // 10 s, por isso não fica preso em "A carregar…" para sempre (#191). A sessão
  // expirada já foi tratada no layout.
  if (profile.kind !== 'ok') {
    return (
      <RefreshError
        title="Não foi possível carregar o teu perfil"
        message="O servidor não respondeu a tempo. Tenta de novo — se continuar, fala com o teu professor."
      />
    );
  }

  const me = profile.me;
  const classId = me.currentClass?.id ?? null;

  const [social, feed] = await Promise.all([loadSocial(me), classId ? getFeed(classId, 1, 30) : Promise.resolve(null)]);

  return (
    <SocialLayout identity={<ProfileCard me={me} data={social} onProfile />} friends={<FriendsCard friends={social.friends} />} rail={<RightRail data={social} />}>
      <PerfilView
        me={me}
        stats={social.stats}
        badges={social.badges}
        history={social.history}
        performance={social.performance}
        classId={classId}
        posts={feed?.ok ? ownPosts(feed.data, me.accountId) : []}
        feedError={feed && !feed.ok ? feed.message : null}
        initialTab={profileTabOf(query.tab)}
        startEditing={query.editar === '1'}
      />
    </SocialLayout>
  );
}
