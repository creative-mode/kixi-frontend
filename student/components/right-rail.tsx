import Link from 'next/link';
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
export function RightRail({ data }: { me: Me; data: SocialData }) {
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
    </>
  );
}
