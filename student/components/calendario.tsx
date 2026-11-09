import Link from 'next/link';
import { upcomingInvitations } from '@/lib/home-rules';
import type { Invitation } from '@/lib/exam-room-rules';

/**
 * O calendário: as próximas provas (salas a que o professor convidou o aluno), pela ordem em que começam. Cada uma
 * abre «O que sai na prova», na disciplina dessa prova. É o mesmo cartão na coluna da direita (computador) e no topo
 * de Provas (telemóvel e ecrãs médios, onde a coluna não cabe).
 */
export function Calendario({ invitations, limit = 4, className = '' }: { invitations: readonly Invitation[]; limit?: number; className?: string }) {
  const soon = upcomingInvitations(invitations, limit);
  if (soon.length === 0) return null;
  return (
    <section className={`sheet p-5 ${className}`} aria-label="Calendário">
      <h2 className="m-0 mb-3.5 text-base font-extrabold">Calendário</h2>
      <div className="flex flex-col gap-3.5">
        {soon.map((u) => (
          <Link key={u.key} href={`/provas/preparar?sala=${u.key}&prova=${u.statementId}`} className="flex items-center gap-3.5 text-[#121c15] no-underline">
            <span className="w-11 text-center"><span className="block text-xs text-[#617066]">{u.month}</span><strong className="text-[22px] leading-none">{u.day}</strong></span>
            <span className="flex flex-col"><strong className="text-sm">{u.title}</strong><span className="text-[13px] text-[#617066]">{u.meta}</span></span>
          </Link>
        ))}
      </div>
    </section>
  );
}
