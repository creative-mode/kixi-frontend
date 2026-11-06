import Link from 'next/link';
import { Award, Flame } from 'lucide-react';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { levelProgress } from '@/lib/gamification-rules';
import { contextLine, fullName, photoUrl } from '@/lib/profile';
import { formatAverage } from '@/lib/ranking-rules';
import { upcomingInvitations } from '@/lib/home-rules';
import type { SocialData } from '@/lib/social';
import type { Me } from '@/lib/types';

type Estado = 'dom' | 'apr' | 'fra' | 'nov';

/** O estado de um tema pelo domínio (0–100) que o backend devolve: sem tentativas é «por ver». */
function estadoDe(value: number): { estado: Estado; label: string } {
  if (value >= 80) return { estado: 'dom', label: 'Dominado' };
  if (value >= 50) return { estado: 'apr', label: 'A aprender' };
  if (value > 0) return { estado: 'fra', label: 'A rever' };
  return { estado: 'nov', label: 'Por ver' };
}

const Bolinha = ({ estado }: { estado: Estado }) => (
  <span className={`st ${estado}`}>
    {estado === 'dom' && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
  </span>
);

/**
 * A coluna da direita do computador: os temas do aluno e o calendário, como no protótipo «nova experiência».
 * Tudo vem de `loadSocial`, lido uma vez no layout.
 */
/** Um módulo de apoio da coluna da direita, no mesmo cartão claro do protótipo. */
function Module({ title, href, linkLabel = 'Ver tudo', children }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <section className="sheet p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="m-0 text-base font-extrabold">{title}</h2>
        {href && <Link href={href} className="text-sm font-semibold text-[#1f5a2c] no-underline hover:underline">{linkLabel}</Link>}
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

export function RightRail({ me, data }: { me: Me; data: SocialData }) {
  const { stats } = data;
  const name = fullName(me) || 'Aluno';
  const context = contextLine(me);
  const temas = data.performance.mastery.slice(0, 6);
  const soon = upcomingInvitations(data.invitations.ok ? data.invitations.data : [], 4);

  return (
    <>
      <section className="sheet px-5 pt-5 pb-2" aria-label="Os teus temas">
        <h2 className="m-0 mb-1 text-base font-extrabold">Os teus temas</h2>
        <span className="lbl">{temas.length > 0 ? 'O que tens de treinar, do mais fraco ao mais forte' : 'Faz uma prova para veres os temas'}</span>
        {temas.length > 0 && (
          <div className="mt-3">
            {temas.map((t, i) => {
              const { estado, label } = estadoDe(t.value);
              return (
                <Link key={t.id} href={`/tutor?statementId=${t.id}`} className="row" style={i === 0 ? { borderTop: 0 } : undefined}>
                  <Bolinha estado={estado} />
                  <span className="flex-1 text-sm" style={estado === 'fra' ? { fontWeight: 700 } : undefined}>{t.label}</span>
                  <span className="text-[13px]" style={estado === 'fra' ? { color: '#c2383e', fontWeight: 600 } : { color: '#617066' }}>{label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
      {soon.length > 0 && (
        <section className="sheet p-5">
          <h2 className="m-0 mb-3.5 text-base font-extrabold">Calendário</h2>
          <div className="flex flex-col gap-3.5">
            {soon.map((u) => (
              <Link key={u.key} href={`/provas/preparar?materia=${encodeURIComponent(u.title)}`} className="flex items-center gap-3.5 text-[#121c15] no-underline">
                <span className="w-11 text-center"><span className="block text-xs text-[#617066]">{u.month}</span><strong className="text-[22px] leading-none">{u.day}</strong></span>
                <span className="flex flex-col"><strong className="text-sm">{u.title}</strong><span className="text-[13px] text-[#617066]">{u.meta}</span></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Module title="O teu progresso" href="/perfil" linkLabel="Perfil">
        <div className="flex items-center gap-3">
          <UserAvatar name={name} src={photoUrl(me)} size={44} />
          <div className="min-w-0 leading-tight">
            <p className="m-0 truncate text-[15px] font-bold">{name}</p>
            {context && <p className="mt-0.5 line-clamp-2 text-[13px] text-[#617066]">{context}</p>}
          </div>
        </div>
        {stats && (
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 font-semibold"><Award className="size-4 text-[#1f5a2c]" aria-hidden />Nível {stats.level}</span>
              <span className="inline-flex items-center gap-1 text-[#617066]"><Flame className="size-3.5" aria-hidden />{stats.streak} {stats.streak === 1 ? 'dia' : 'dias'}</span>
            </div>
            <Progress value={levelProgress(stats.xp, stats.level)} aria-label={`Progresso para o nível ${stats.level + 1}`} />
          </div>
        )}
      </Module>

      {data.classTop.length > 0 && (
        <Module title="Na tua turma" href="/ranking" linkLabel="Ranking">
          <ol className="m-0 grid list-none gap-2.5 p-0">
            {data.classTop.map((r) => (
              <li key={r.position} className="flex items-center gap-2.5 text-[15px]">
                <span className="w-5 text-center font-semibold text-[#617066] tabular-nums">{r.position}</span>
                <UserAvatar name={r.displayName} src={r.me ? photoUrl(me) : null} size={32} />
                <span className="min-w-0 flex-1 truncate font-semibold">{r.me ? 'Tu' : r.displayName}</span>
                <span className="text-[#617066] tabular-nums">{formatAverage(r.average)}%</span>
              </li>
            ))}
          </ol>
        </Module>
      )}

      <Module title="Os teus amigos" href="/ranking" linkLabel="Ver">
        {data.friends.length === 0 ? (
          <>
            <p className="m-0 text-sm text-[#617066]">Ainda não tens amigos. Convida um colega para te comparares só com ele.</p>
            <Button asChild variant="outline" size="sm" className="w-fit"><Link href="/ranking">Procurar colegas</Link></Button>
          </>
        ) : (
          <ul className="m-0 grid list-none gap-1 p-0">
            {data.friends.slice(0, 5).map((f) => (
              <li key={f.friendshipId}>
                <Link href="/ranking" className="-mx-2 flex min-h-11 items-center gap-2.5 rounded-xl px-2 py-1.5 text-[15px] text-[#121c15] no-underline hover:bg-[#f5f6f4]">
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
