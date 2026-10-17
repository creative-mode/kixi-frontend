import Link from 'next/link';
import { Award, Flame, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { sairAction } from '@/lib/auth-actions';
import { cn } from '@/lib/utils';
import { levelProgress } from '@/lib/gamification-rules';
import { contextLine, fullName, initials, photoUrl } from '@/lib/profile';
import type { SocialData } from '@/lib/social';
import type { Me } from '@/lib/types';

/** A moldura da foto: cantos em degrau, como os cartões da landing. */
function Photo({ me, name }: { me: Me; name: string }) {
  const src = photoUrl(me);
  return (
    <div className="px-step aspect-square w-24 shrink-0 overflow-hidden bg-accent min-[1100px]:w-full">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={272} height={272} className="size-full object-cover" />
      ) : (
        <span aria-hidden="true" className="grid size-full place-items-center text-4xl font-bold text-accent-foreground min-[1100px]:text-7xl">{initials(name)}</span>
      )}
    </div>
  );
}

function Counter({ value, label, href }: { value: number | string; label: string; href: string }) {
  return (
    <Link href={href} className="px-step block bg-secondary px-3.5 py-3 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
      <b className="block text-xl leading-tight tracking-tight tabular-nums">{value}</b>
      <span className="text-[13px] text-muted-foreground">{label}</span>
    </Link>
  );
}

/** O cartão do aluno e os seus números, no topo da coluna da esquerda. */
export function ProfileCard({ me, data, onProfile = false }: { me: Me; data: SocialData; /** No perfil, o cabeçalho ao meio já diz o nome: em ecrã estreito o cartão não o repete. */ onProfile?: boolean }) {
  const name = fullName(me) || 'Aluno';
  const context = contextLine(me);
  const { stats } = data;

  return (
    <>
      <Card className="gap-3 p-3">
        <div className="flex gap-3.5 min-[1100px]:flex-col">
          <Photo me={me} name={name} />
          <div className="grid min-w-0 flex-1 content-start gap-2.5">
            <div className={cn('min-w-0 leading-tight', onProfile && 'max-[1099px]:hidden')}>
              <p className="truncate text-[17px] font-bold tracking-tight">{name}</p>
              {context && <p className="mt-0.5 text-[13px] text-muted-foreground">{context}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" className="min-[1100px]:w-full"><Link href="/provas">Fazer uma prova</Link></Button>
              <Button asChild size="sm" variant="outline" className={cn('min-[1100px]:w-full', onProfile && 'max-[1099px]:hidden')}><Link href="/perfil?editar=1">Editar perfil</Link></Button>
            </div>
          </div>
        </div>
        {stats && (
          <div className="grid gap-1.5 px-0.5 pb-0.5">
            <div className="flex items-center justify-between gap-2 text-[13px]">
              <span className="inline-flex items-center gap-1.5 font-semibold"><Award className="size-4 text-primary" aria-hidden />Nível {stats.level}</span>
              <span className="inline-flex items-center gap-1 text-muted-foreground"><Flame className="size-3.5" aria-hidden />{stats.streak} {stats.streak === 1 ? 'dia' : 'dias'}</span>
            </div>
            <Progress value={levelProgress(stats.xp, stats.level)} aria-label={`Progresso para o nível ${stats.level + 1}`} />
          </div>
        )}
        <form action={sairAction} className="px-0.5">
          <Button type="submit" variant="ghost" size="sm" className="w-full justify-start text-muted-foreground"><LogOut aria-hidden />Terminar sessão</Button>
        </form>
      </Card>

      <section aria-label="Os teus números" className="grid grid-cols-2 gap-2.5">
        <Counter value={stats?.xp ?? 0} label="pontos de XP" href="/perfil?tab=Desempenho" />
        <Counter value={data.friends.length} label={data.friends.length === 1 ? 'amigo' : 'amigos'} href="/ranking" />
        <Counter value={data.performance.activity.length} label="simulações" href="/perfil?tab=Atividade" />
        <Counter value={data.badges.length} label={data.badges.length === 1 ? 'medalha' : 'medalhas'} href="/perfil?tab=Medalhas" />
      </section>
    </>
  );
}
