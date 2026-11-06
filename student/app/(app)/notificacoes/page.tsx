import Link from 'next/link';
import { getProfile } from '@/lib/me';
import { loadSocial } from '@/lib/social';
import { upcomingInvitations } from '@/lib/home-rules';
import { RefreshError } from '@/components/refresh-error';

export const metadata = { title: 'Notificações · Kixi' };

const Item = ({ href, tone, icon, children, quando }: { href: string; tone: { bg: string; fg: string }; icon: React.ReactNode; children: React.ReactNode; quando: string }) => (
  <Link href={href} className="flex items-start gap-3.5 border-t border-[#e4e7e1] py-3.5 text-[#121c15] no-underline first:border-t-0">
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full" style={{ background: tone.bg, color: tone.fg }} aria-hidden="true">{icon}</span>
    <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
      <span className="text-[15px] leading-[1.4]">{children}</span>
      <span className="text-sm text-[#617066]">{quando}</span>
    </span>
  </Link>
);

/**
 * As notificações do aluno. O backend ainda não tem um feed de notificações: mostram-se os avisos que se
 * conseguem tirar do que já existe (as próximas provas e os resultados mais recentes).
 */
export default async function NotificacoesPage() {
  const profile = await getProfile();
  if (profile.kind !== 'ok') {
    return <div className="px-4 pt-7"><RefreshError title="Não foi possível carregar as notificações" message="O servidor não respondeu a tempo. Tenta de novo." /></div>;
  }
  const social = await loadSocial(profile.me);
  const proximas = upcomingInvitations(social.invitations.ok ? social.invitations.data : [], 5);
  const resultados = social.history.slice(0, 5);

  const calendario = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
  const estrela = <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" /></svg>;
  const vazio = proximas.length === 0 && resultados.length === 0;

  return (
    <div className="flex min-w-0 flex-col px-4 pt-3 pb-28 md:px-0 md:pt-7 md:pb-12">
      <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.02em]">Notificações</h1>
      {vazio && <p className="mt-6 text-[15px] text-[#617066]">Não tens notificações por agora.</p>}
      {proximas.length > 0 && (
        <>
          <h2 className="lbl mt-6 mb-2">Próximas provas</h2>
          {proximas.map((p) => (
            <Item key={p.key} href="/provas?aba=salas" tone={{ bg: '#fdf0d9', fg: '#9a6400' }} icon={calendario} quando={`${p.day} ${p.month}, ${p.meta}`}>
              A tua prova de <strong>{p.title}</strong> é a {p.day} de {p.month}
            </Item>
          ))}
        </>
      )}
      {resultados.length > 0 && (
        <>
          <h2 className="lbl mt-6 mb-2">Resultados</h2>
          {resultados.map((r) => (
            <Item key={r.id} href={`/prova/${r.id}/detalhe`} tone={{ bg: '#fdeec2', fg: '#9a6400' }} icon={estrela} quando={r.subject}>
              Terminaste <strong>{r.title}</strong>{r.score ? <> com {r.score}</> : null}
            </Item>
          ))}
        </>
      )}
    </div>
  );
}
