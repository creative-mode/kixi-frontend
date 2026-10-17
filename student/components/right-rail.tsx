import Link from 'next/link';
import { Award, Flame } from 'lucide-react';
import { Mastery } from '@/components/mastery';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { phaseOf, sortInvitations, type Invitation } from '@/lib/exam-room-rules';
import { parseServerTime } from '@/lib/exam-rules';
import { levelProgress } from '@/lib/gamification-rules';
import { contextLine, fullName, photoUrl } from '@/lib/profile';
import { formatAverage } from '@/lib/ranking-rules';
import type { SocialData } from '@/lib/social';
import type { Me } from '@/lib/types';

/** Um módulo da coluna da direita: caixa cinza-verde clara, título grande e ligação opcional. */
function Module({ title, href, linkLabel = 'Ver tudo', children }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <section className="px-box shrink-0 py-3 [--px-edge:#d3dccf] [--px-face:var(--secondary)]">
      <div className="flex items-baseline justify-between gap-2 px-4 pb-2">
        <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
        {href && <Link href={href} className="text-[14px] font-semibold text-primary hover:underline">{linkLabel}</Link>}
      </div>
      <div className="grid gap-3 px-4">{children}</div>
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-[14px] text-muted-foreground">{children}</p>;

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

/**
 * A coluna da direita, global e curta: o progresso do aluno, próximas provas, o que rever, a turma e os amigos.
 * O que já tem ecrã próprio (medalhas, atividade, disciplinas, escolas) fica nesse ecrã. Tudo vem de `loadSocial`, lido uma vez no layout.
 */
export function RightRail({ me, data }: { me: Me; data: SocialData }) {
  const { stats } = data;
  const name = fullName(me) || 'Aluno';
  const context = contextLine(me);
  const soon = upcoming(data.invitations.ok ? data.invitations.data : []);
  const review = data.performance.mastery.slice(0, 4);

  return (
    <>
      <Module title="O teu progresso" href="/perfil" linkLabel="Perfil">
        <div className="flex items-center gap-3">
          <UserAvatar name={name} src={photoUrl(me)} size={44} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[15px] font-bold">{name}</p>
            {context && <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">{context}</p>}
          </div>
        </div>
        {stats && (
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2 text-[14px]">
              <span className="inline-flex items-center gap-1.5 font-semibold"><Award className="size-4 text-primary" aria-hidden />Nível {stats.level}</span>
              <span className="inline-flex items-center gap-1 text-muted-foreground"><Flame className="size-3.5" aria-hidden />{stats.streak} {stats.streak === 1 ? 'dia' : 'dias'}</span>
            </div>
            <Progress value={levelProgress(stats.xp, stats.level)} aria-label={`Progresso para o nível ${stats.level + 1}`} />
          </div>
        )}
      </Module>

      {soon.length > 0 && <Module title="Próximas provas" href="/provas" linkLabel="Provas">
        {(
          <ul className="grid gap-3">
            {soon.map((u) => (
              <li className="flex items-center gap-3" key={u.key}>
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-center text-[15px] leading-none font-bold text-accent-foreground"><span>{u.day}<small className="mt-0.5 block text-[10px] font-semibold opacity-80">{u.month}</small></span></div>
                <div className="min-w-0 leading-tight"><div className="truncate text-[15px] font-bold">{u.title}</div><div className="text-[13px] text-muted-foreground">{u.meta}</div></div>
              </li>
            ))}
          </ul>
        )}
      </Module>}

      {review.length > 0 && (
        <Module title="Para rever">
          <div className="grid gap-3">{review.map((t) => <Mastery key={t.id} label={t.label} value={t.value} />)}</div>
          <Button asChild variant="outline" size="sm" className="w-fit"><Link href="/tutor">Rever com o tutor</Link></Button>
        </Module>
      )}

      {data.classTop.length > 0 && <Module title="Na tua turma" href="/ranking" linkLabel="Liga">
        {(
          <ol className="grid gap-2.5">
            {data.classTop.map((r) => (
              <li key={r.position} className="flex items-center gap-2.5 text-[15px]">
                <span className="w-5 text-center font-semibold text-muted-foreground tabular-nums">{r.position}</span>
                <UserAvatar name={r.displayName} size={32} />
                <span className="min-w-0 flex-1 truncate font-semibold">{r.me ? 'Tu' : r.displayName}</span>
                <span className="text-muted-foreground tabular-nums">{formatAverage(r.average)}%</span>
              </li>
            ))}
          </ol>
        )}
      </Module>}

      <Module title="Os teus amigos" href="/ranking" linkLabel="Ver">
        {data.friends.length === 0 ? (
          <>
            <Empty>Ainda não tens amigos. Convida um colega para te comparares só com ele.</Empty>
            <Button asChild variant="outline" size="sm" className="w-fit"><Link href="/ranking">Procurar colegas</Link></Button>
          </>
        ) : (
          <ul className="grid gap-1">
            {data.friends.slice(0, 5).map((f) => (
              <li key={f.friendshipId}>
                <Link href="/ranking" className="-mx-2 flex min-h-11 items-center gap-2.5 rounded-xl px-2 py-1.5 text-[15px] transition-colors hover:bg-muted">
                  <UserAvatar name={f.displayName} src={f.photo} size={36} />
                  <span className="min-w-0 flex-1 truncate font-bold">{f.displayName}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Module>
    </>
  );
}
