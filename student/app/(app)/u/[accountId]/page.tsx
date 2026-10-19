import { notFound, redirect } from 'next/navigation';
import { PersonView } from '@/components/person-view';
import { RefreshError } from '@/components/refresh-error';
import { getFeed } from '@/lib/feed';
import { loadConnectionsAction } from '@/lib/friends-actions';
import { getProfile } from '@/lib/me';
import { fullName, photoUrl } from '@/lib/profile';
import { getPerson } from '@/lib/profiles';

export async function generateMetadata({ params }: { params: Promise<{ accountId: string }> }) {
  const person = await getPerson(Number((await params).accountId));
  return { title: `${person.ok ? person.data.displayName : 'Perfil'} · Kixi` };
}

/** O perfil de outra pessoa, no mesmo modelo do teu, como a visibilidade dela deixa ver (#336). */
export default async function PessoaPage({ params }: { params: Promise<{ accountId: string }> }) {
  const id = Number((await params).accountId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [result, profile] = await Promise.all([getPerson(id), getProfile()]);
  if (profile.kind === 'ok' && profile.me.accountId === id) redirect('/perfil');
  if (!result.ok) {
    if (result.status === 404) notFound();
    return <RefreshError title="Não foi possível carregar o perfil" message={result.message} status={result.status} back={{ href: "/inicio", label: "Início" }} />;
  }

  const me = profile.kind === 'ok' ? profile.me : null;
  const myClassId = me?.currentClass?.id ?? null;
  // As publicações desta pessoa que a tua turma vê: o feed é por turma, por isso só há as da mesma turma.
  const feed = myClassId ? await getFeed(myClassId, 1, 30) : null;
  const posts = feed?.ok ? feed.data.filter((p) => p.authorAccountId === id) : [];
  // Amigos ou pedido já trocado com esta pessoa (#121): o botão de amizade do perfil
  // não pede do zero se já há uma ligação — mostra o estado em que ela está.
  const connections = me ? await loadConnectionsAction() : { friends: [], requests: [] };
  const friend = [...connections.friends, ...connections.requests].find((f) => f.accountId === id) ?? null;

  return (
    <PersonView
      person={{ ...result.data, accountId: id }}
      posts={posts}
      // O perfil não diz a turma; uma publicação na tua turma é a prova de que é da mesma.
      classmate={posts.length > 0}
      myAccountId={me?.accountId ?? null}
      myName={me ? fullName(me) : ''}
      myPhoto={me ? photoUrl(me) : null}
      myClassId={myClassId}
      friend={friend}
    />
  );
}
