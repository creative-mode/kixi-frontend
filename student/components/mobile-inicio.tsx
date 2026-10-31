import Link from 'next/link';
import { Award, ChevronDown, Flame } from 'lucide-react';
import { Mastery } from '@/components/mastery';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { levelProgress } from '@/lib/gamification-rules';
import { upcomingInvitations } from '@/lib/home-rules';
import { loadSocial } from '@/lib/social';
import type { Me } from '@/lib/types';

/** Onde o conteúdo de um recolhível aparece: os três têm o mesmo cabeçalho e a
 *  mesma seta, para o aluno reconhecer o gesto em qualquer secção. */
function Fold({ id, title, count, children }: { id: string; title: string; count: number; children: React.ReactNode }) {
  return (
    <details data-testid={id} className="group overflow-hidden rounded-xl border bg-card">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 py-3 text-[15px] font-bold [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">{title}</span>
        <span className="text-[13px] font-semibold text-muted-foreground tabular-nums">{count}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t px-4 py-3">{children}</div>
    </details>
  );
}

/**
 * O topo do início no telemóvel (#493): a coluna da direita só existe a partir de
 * `lg`, por isso o nível, a barra, o streak e os atalhos de estudo não chegavam a
 * quem usa o telemóvel. O cartão e as secções são `lg:hidden`; em ecrã grande a
 * coluna da direita continua a ser a única.
 */
export async function MobileInicio({ me }: { me: Me }) {
  const data = await loadSocial(me);
  const { stats } = data;
  const soon = upcomingInvitations(data.invitations.ok ? data.invitations.data : []);
  const review = data.performance.mastery.slice(0, 4);

  return (
    <section data-testid="mobile-progresso" className="grid gap-3 px-4 pt-3 lg:hidden">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[17px] font-bold tracking-tight">O teu progresso</h2>
          <Link href="/perfil" className="shrink-0 text-[13px] font-semibold text-primary hover:underline">Perfil</Link>
        </div>
        {stats ? (
          <div className="mt-3 grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[14px]">
              <span className="inline-flex items-center gap-1.5 font-semibold"><Award className="size-4 text-primary" aria-hidden />Nível {stats.level}</span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Flame className="size-3.5" aria-hidden />{stats.streak} {stats.streak === 1 ? 'dia' : 'dias'} de sequência
              </span>
            </div>
            <Progress value={levelProgress(stats.xp, stats.level)} aria-label={`Progresso para o nível ${stats.level + 1}`} />
            <p className="text-[13px] text-muted-foreground tabular-nums">{stats.xp} XP no total</p>
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-muted-foreground">O teu progresso não está disponível agora. Tenta de novo daqui a pouco.</p>
        )}
      </div>

      {review.length > 0 && (
        <Fold id="mobile-para-rever" title="Para rever" count={review.length}>
          <div className="grid gap-3">
            {review.map((t) => <Mastery key={t.id} label={t.label} value={t.value} />)}
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link href={`/tutor?statementId=${review[0].id}`}>Rever com o tutor</Link>
            </Button>
          </div>
        </Fold>
      )}

      {soon.length > 0 && (
        <Fold id="mobile-proximas-provas" title="Próximas provas" count={soon.length}>
          <ul className="grid gap-3">
            {soon.map((u) => (
              <li className="flex min-w-0 items-center gap-3" key={u.key}>
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-center text-[15px] leading-none font-bold text-accent-foreground">
                  <span>{u.day}<small className="mt-0.5 block text-[10px] font-semibold opacity-80">{u.month}</small></span>
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-[15px] font-bold">{u.title}</div>
                  <div className="text-[13px] text-muted-foreground">{u.meta}</div>
                </div>
              </li>
            ))}
          </ul>
          <Link href="/provas" className="mt-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-primary hover:underline">Ver todas as provas</Link>
        </Fold>
      )}
    </section>
  );
}

/** O lugar do cartão enquanto `loadSocial` resolve: a página e o feed já estão
 *  pintados, o progresso preenche depois. */
export function MobileInicioSkeleton() {
  return (
    <div data-testid="mobile-progresso-skeleton" className="px-4 pt-3 lg:hidden" aria-hidden="true">
      <div className="grid gap-2 rounded-xl border bg-card p-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-2 h-4 w-48" />
        <Skeleton className="h-1.5 w-full" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}
