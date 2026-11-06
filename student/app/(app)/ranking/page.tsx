import Link from 'next/link';
import { RankingView } from '@/components/ranking-view';
import { UserAvatar } from '@/components/user-avatar';
import { getLeaderboard } from '@/lib/ranking';
import { getFeed, loadAuthors } from '@/lib/feed';
import { getProfile } from '@/lib/me';
import { sinceLabel } from '@/lib/attempt-history';

export const metadata = { title: 'Turma · Kixi' };

type Params = Promise<Record<string, string | string[] | undefined>>;

/** A turma da nova experiência: «Dúvidas» (publicações da turma) e «Médias» (o ranking, com turma, escola, amigos e global). */
export default async function TurmaPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const aba = params.aba === 'medias' ? 'medias' : 'duvidas';
  const profile = await getProfile();
  const me = profile.kind === 'ok' ? profile.me : null;
  const classId = me?.currentClass?.id ?? null;

  const tab = (id: string, href: string, label: string) => (
    <Link key={id} href={href} role="tab" aria-selected={aba === id} className="-mb-px border-b-2 border-transparent py-3 text-base font-bold text-[#617066] no-underline aria-selected:border-[#1f5a2c] aria-selected:text-[#121c15]">{label}</Link>
  );

  let body: React.ReactNode;
  if (aba === 'medias') {
    const result = await getLeaderboard('class');
    body = <RankingView initial={result.ok ? result.data : null} error={result.ok ? null : result.message} />;
  } else {
    const feed = classId ? await getFeed(classId, 1, 20) : null;
    const posts = feed?.ok ? feed.data : [];
    const authors = await loadAuthors(posts, me?.accountId ?? null);
    body = posts.length === 0 ? (
      <p className="py-6 text-[15px] text-[#617066]">Ainda não há dúvidas na tua turma.</p>
    ) : (
      <div>
        {posts.map((p) => {
          const a = authors[p.authorAccountId];
          const nome = a?.name ?? (p.authorAccountId === me?.accountId ? 'Tu' : 'Colega');
          const semResposta = p.commentCount === 0;
          return (
            <Link key={p.id} href="/inicio" className="flex items-center gap-3.5 border-b border-[#eef0ec] py-4 text-[#121c15] no-underline">
              <UserAvatar name={nome} src={a?.photo ?? null} size={40} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="line-clamp-2 text-base leading-[1.45]">{p.title || p.content}</span>
                <span className="text-sm" style={{ color: semResposta ? '#c2383e' : '#617066' }}>{nome} · {sinceLabel(p.createdAt) ?? ''} · {semResposta ? 'sem resposta ainda' : `${p.commentCount} ${p.commentCount === 1 ? 'resposta' : 'respostas'}`}</span>
              </span>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col px-4 pt-3 pb-28 md:px-0 md:pt-7 md:pb-12">
      <div className="flex items-center justify-between">
        <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.02em]">{me?.currentClass?.code ?? 'Turma'}</h1>
        <Link href="/publicar" aria-label="Fazer uma pergunta à turma" className="flex h-[46px] items-center gap-2 rounded-full bg-[#1f5a2c] px-[18px] text-sm font-bold text-white no-underline">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Nova pergunta
        </Link>
      </div>
      <div role="tablist" aria-label="Secções da turma" className="mt-[18px] flex gap-7 border-b border-[#eef0ec]">
        {tab('duvidas', '/ranking', 'Dúvidas')}
        {tab('medias', '/ranking?aba=medias', 'Médias')}
      </div>
      {body}
    </div>
  );
}
