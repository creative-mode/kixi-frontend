import Link from 'next/link';
import { Award } from 'lucide-react';
import { Mastery } from '@/components/mastery';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { phaseOf, sortInvitations, type Invitation } from '@/lib/exam-room-rules';
import { parseServerTime } from '@/lib/exam-rules';
import { formatAverage } from '@/lib/ranking-rules';
import { groupBySubject } from '@/lib/social-rules';
import type { SocialData } from '@/lib/social';

function Widget({ title, href, linkLabel = 'Todas', children }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold tracking-tight">{title}</h2>
        {href && <Link href={href} className="text-[13px] font-semibold text-primary hover:underline">{linkLabel}</Link>}
      </div>
      {children}
    </Card>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-[13px] text-muted-foreground">{children}</p>;

function upcoming(invitations: Invitation[]) {
  return sortInvitations(invitations)
    .filter((inv) => ['scheduled', 'lobby', 'live'].includes(phaseOf(inv)))
    .slice(0, 3)
    .map((inv) => {
      const when = new Date(parseServerTime(inv.startsAt));
      return {
        key: inv.roomId,
        day: String(when.getDate()),
        month: when.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', ''),
        title: inv.statementTitle ?? 'Sala de prova',
        meta: `${when.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} · ${inv.durationMinutes} min`,
      };
    });
}

/** Os widgets da coluna da direita: medalhas, provas por disciplina, o que rever, a turma e as próximas provas. */
export function RightRail({ data }: { data: SocialData }) {
  const subjects = groupBySubject(data.history);
  const top = Math.max(1, ...subjects.map((s) => s.count));
  const soon = upcoming(data.invitations.ok ? data.invitations.data : []);
  const review = data.performance.mastery.slice(0, 3);

  return (
    <>
      <Widget title="Medalhas" href="/perfil?tab=Medalhas">
        {data.badges.length === 0 ? (
          <Empty>Termina a primeira simulação para ganhares a primeira medalha.</Empty>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {data.badges.slice(0, 6).map((b) => (
              <li key={b.code} title={b.description} className="px-step grid justify-items-center gap-1.5 bg-accent px-1.5 py-3 text-center">
                <Award className="size-6 text-primary" aria-hidden />
                <span className="line-clamp-2 text-[12px] leading-tight font-semibold text-accent-foreground">{b.name}</span>
              </li>
            ))}
          </ul>
        )}
      </Widget>

      <Widget title="Provas por disciplina" href="/provas" linkLabel="Provas">
        {subjects.length === 0 ? (
          <Empty>As provas que terminares aparecem aqui, por disciplina.</Empty>
        ) : (
          <ul className="grid gap-2.5">
            {subjects.map((s) => (
              <li key={s.name} className="grid gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm"><span className="min-w-0 truncate font-semibold">{s.name}</span><span className="text-muted-foreground tabular-nums">{s.count}</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((s.count / top) * 100)}%` }} /></div>
              </li>
            ))}
          </ul>
        )}
      </Widget>

      <Widget title="Para rever">
        {review.length === 0 ? (
          <Empty>Quando terminares uma prova, as que correram pior aparecem aqui.</Empty>
        ) : (
          <div className="grid gap-3">{review.map((t) => <Mastery key={t.id} label={t.label} value={t.value} />)}</div>
        )}
        <Button asChild variant="outline" size="sm"><Link href="/tutor">Rever com o tutor</Link></Button>
      </Widget>

      <Widget title="Na tua turma" href="/ranking" linkLabel="Turma">
        {data.classTop.length === 0 ? (
          <Empty>Ainda não há provas corrigidas na turma.</Empty>
        ) : (
          <ol className="grid gap-2.5">
            {data.classTop.map((r) => (
              <li key={r.position} className="flex items-center gap-2.5 text-sm">
                <span className="w-5 text-center font-semibold text-muted-foreground tabular-nums">{r.position}</span>
                <UserAvatar name={r.displayName} size={28} />
                <span className="min-w-0 flex-1 truncate">{r.me ? 'Tu' : r.displayName}</span>
                <span className="text-muted-foreground tabular-nums">{formatAverage(r.average)}%</span>
              </li>
            ))}
          </ol>
        )}
      </Widget>

      <Widget title="Próximas provas" href="/provas" linkLabel="Provas">
        {soon.length === 0 ? (
          <Empty>Sem salas de prova marcadas para ti.</Empty>
        ) : (
          <ul className="grid gap-3">
            {soon.map((u) => (
              <li className="flex items-center gap-3" key={u.key}>
                <div className="px-step grid size-11 shrink-0 place-items-center bg-accent text-center text-[15px] leading-none font-bold text-accent-foreground"><span>{u.day}<small className="mt-0.5 block text-[10px] font-semibold opacity-80">{u.month}</small></span></div>
                <div className="min-w-0 leading-tight"><div className="truncate text-sm font-semibold">{u.title}</div><div className="text-[13px] text-muted-foreground">{u.meta}</div></div>
              </li>
            ))}
          </ul>
        )}
      </Widget>
    </>
  );
}
