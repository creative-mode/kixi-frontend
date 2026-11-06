import Link from 'next/link';
import { getProfile } from '@/lib/me';
import { loadNotifications, type Notification } from '@/lib/notifications';
import { sinceLabel } from '@/lib/attempt-history';
import { RefreshError } from '@/components/refresh-error';
import { MarcarLidas } from '@/components/marcar-lidas';
import { UserAvatar } from '@/components/user-avatar';

export const metadata = { title: 'Notificações · Kixi' };

const estrela = <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" /></svg>;
const prova = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>;

function Item({ n }: { n: Notification }) {
  return (
    <Link href={n.href} className="flex items-start gap-3.5 border-t border-[#e4e7e1] py-3.5 text-[#121c15] no-underline first:border-t-0">
      {n.kind === 'reply' ? (
        <UserAvatar name={n.who ?? 'Colega'} src={null} size={40} />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full" style={n.kind === 'badge' ? { background: '#fdeec2', color: '#9a6400' } : { background: '#eef6ea', color: '#1b4d27' }} aria-hidden="true">{n.kind === 'badge' ? estrela : prova}</span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="text-[15px] leading-[1.4]">{n.who && <strong>{n.who} </strong>}{n.text}</span>
        <span className="text-sm text-[#617066]">{sinceLabel(n.at) ?? ''}</span>
      </span>
      {n.unread && <span className="mt-2 size-[7px] shrink-0 rounded-full bg-[#c2383e]" aria-label="Nova" />}
    </Link>
  );
}

/** As notificações do aluno: respostas às suas perguntas, medalhas e resultados, com «Marcar tudo como lido» guardado no servidor. */
export default async function NotificacoesPage() {
  const profile = await getProfile();
  if (profile.kind !== 'ok') {
    return <div className="px-4 pt-7"><RefreshError title="Não foi possível carregar as notificações" message="O servidor não respondeu a tempo. Tenta de novo." /></div>;
  }
  const { items, unreadCount } = await loadNotifications(profile.me);
  const novas = items.filter((i) => i.unread);
  const antigas = items.filter((i) => !i.unread);

  return (
    <div className="flex min-w-0 flex-col px-4 pt-3 pb-28 md:px-0 md:pt-7 md:pb-12">
      <div className="flex items-baseline justify-between">
        <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.02em]">Notificações</h1>
        <MarcarLidas disabled={unreadCount === 0} />
      </div>
      {items.length === 0 && <p className="mt-6 text-[15px] text-[#617066]">Não tens notificações por agora.</p>}
      {novas.length > 0 && (<><h2 className="lbl mt-6 mb-2">Novas</h2>{novas.map((n) => <Item key={n.key} n={n} />)}</>)}
      {antigas.length > 0 && (<><h2 className="lbl mt-6 mb-2">Anteriores</h2>{antigas.map((n) => <Item key={n.key} n={n} />)}</>)}
    </div>
  );
}
