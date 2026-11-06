import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFeed, getComments, loadAuthors } from '@/lib/feed';
import { getProfile } from '@/lib/me';
import { sinceLabel } from '@/lib/attempt-history';
import { UserAvatar } from '@/components/user-avatar';
import { Responder } from '@/components/responder';
import { AceitarResposta } from '@/components/aceitar-resposta';

export const metadata = { title: 'Discussão · Kixi' };

/** Uma pergunta da turma com as respostas, e a caixa para responder. Lê o post da primeira página do feed da turma. */
export default async function DiscussaoPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const profile = await getProfile();
  if (profile.kind !== 'ok' || !profile.me.currentClass) notFound();
  const me = profile.me;
  const feed = await getFeed(me.currentClass!.id, 1, 50);
  const post = feed.ok ? feed.data.find((p) => p.id === id) : undefined;
  if (!post) notFound();
  const [comments, authors] = await Promise.all([getComments(id, 1, 50), loadAuthors([post], me.accountId)]);
  const raw = comments.ok ? comments.data : [];
  // A resposta aceite sobe ao topo.
  const list = [...raw].sort((x, y) => Number(!!y.isAccepted) - Number(!!x.isAccepted));
  const resolvida = list.find((c) => c.isAccepted);
  const souAutor = post.authorAccountId === me.accountId;
  const a = authors[post.authorAccountId];
  const nome = post.authorAccountId === me.accountId ? 'Tu' : (a?.name ?? 'Colega');

  return (
    <div className="flex min-w-0 flex-col px-4 pt-3 pb-28 md:px-0 md:pt-7 md:pb-12">
      <Link href="/ranking" className="mb-4 self-start text-sm font-semibold text-[#5f6b63] no-underline">&larr; Turma</Link>
      <div className="flex items-center gap-3">
        <UserAvatar name={nome} src={a?.photo ?? null} size={38} />
        <span className="flex flex-col"><strong className="text-sm">{nome}</strong><span className="lbl">{sinceLabel(post.createdAt) ?? ''}</span></span>
      </div>
      {post.title && <h1 className="m-0 mt-4 text-[22px] leading-tight font-extrabold">{post.title}</h1>}
      <p className="mt-3 text-[17px] leading-[1.5]">{post.content}</p>
      {resolvida && <span className="chk mt-3"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3d8a4e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>Resolvido · resposta aceite de {resolvida.mine ? 'ti' : (resolvida.displayName ?? 'um colega')}</span>}

      <h2 className="m-0 mt-8 mb-1 text-[13px] font-bold tracking-[.04em] text-[#617066] uppercase">{list.length} {list.length === 1 ? 'resposta' : 'respostas'}</h2>
      <ol className="m-0 flex list-none flex-col p-0">
        {list.map((c) => (
          <li key={c.id} className="flex flex-col gap-2 border-b border-[#eef0ec] py-4">
            <div className="flex items-center gap-3">
              <UserAvatar name={c.mine ? 'Tu' : (c.displayName ?? 'Colega')} src={c.photo ?? null} size={38} />
              <span className="flex flex-col"><strong className="text-sm">{c.mine ? 'Tu' : (c.displayName ?? 'Colega')}</strong><span className="lbl">{sinceLabel(c.createdAt) ?? ''}</span></span>
            </div>
            {c.isAccepted && <span className="chk"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3d8a4e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>Resposta aceite</span>}
            <p className="m-0 text-[15px] leading-[1.5]">{c.content}</p>
            {souAutor && !c.mine && <AceitarResposta postId={id} commentId={c.id} accepted={!!c.isAccepted} />}
          </li>
        ))}
      </ol>
      <Responder postId={id} />
    </div>
  );
}
