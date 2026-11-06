import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFeed, getComments, loadAuthors } from '@/lib/feed';
import { getProfile } from '@/lib/me';
import { sinceLabel } from '@/lib/attempt-history';
import { UserAvatar } from '@/components/user-avatar';
import { Responder } from '@/components/responder';

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
  const list = comments.ok ? comments.data : [];
  const a = authors[post.authorAccountId];
  const nome = post.authorAccountId === me.accountId ? 'Tu' : (a?.name ?? 'Colega');

  return (
    <div className="flex min-w-0 flex-col px-4 pt-3 pb-28 md:px-0 md:pt-7 md:pb-12">
      <Link href="/ranking" className="mb-4 self-start text-sm font-semibold text-[#5f6b63] no-underline">← Turma</Link>
      <div className="flex items-center gap-3">
        <UserAvatar name={nome} src={a?.photo ?? null} size={38} />
        <span className="flex flex-col"><strong className="text-sm">{nome}</strong><span className="lbl">{sinceLabel(post.createdAt) ?? ''}</span></span>
      </div>
      {post.title && <h1 className="m-0 mt-4 text-[22px] leading-tight font-extrabold">{post.title}</h1>}
      <p className="mt-3 text-[17px] leading-[1.5]">{post.content}</p>

      <h2 className="m-0 mt-8 mb-1 text-[13px] font-bold tracking-[.04em] text-[#617066] uppercase">{list.length} {list.length === 1 ? 'resposta' : 'respostas'}</h2>
      <ol className="m-0 flex list-none flex-col p-0">
        {list.map((c) => (
          <li key={c.id} className="flex flex-col gap-2 border-b border-[#eef0ec] py-4">
            <div className="flex items-center gap-3">
              <UserAvatar name={c.mine ? 'Tu' : (c.displayName ?? 'Colega')} src={c.photo ?? null} size={38} />
              <span className="flex flex-col"><strong className="text-sm">{c.mine ? 'Tu' : (c.displayName ?? 'Colega')}</strong><span className="lbl">{sinceLabel(c.createdAt) ?? ''}</span></span>
            </div>
            <p className="m-0 text-[15px] leading-[1.5]">{c.content}</p>
          </li>
        ))}
      </ol>
      <Responder postId={id} />
    </div>
  );
}
