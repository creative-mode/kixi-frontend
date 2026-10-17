import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { UserAvatar } from '@/components/user-avatar';
import type { Friend } from '@/lib/friends';

/** Os amigos do aluno (GET /friends): é com eles que o ranking de amigos o compara. */
export function FriendsCard({ friends }: { friends: Friend[] }) {
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold tracking-tight">Os teus amigos {friends.length > 0 && <span className="font-normal text-muted-foreground">{friends.length}</span>}</h2>
        <Link href="/ranking" className="text-[13px] font-semibold text-primary hover:underline">Ver</Link>
      </div>
      {friends.length === 0 ? (
        <div className="grid gap-2.5 text-[13px] text-muted-foreground">
          <p>Ainda não tens amigos. Convida um colega para te comparares só com ele.</p>
          <Button asChild variant="outline" size="sm"><Link href="/ranking">Procurar colegas</Link></Button>
        </div>
      ) : (
        <ul className="grid gap-1.5">
          {friends.slice(0, 5).map((f) => (
            <li key={f.friendshipId}>
              <Link href="/ranking" className="flex min-h-11 items-center gap-2.5 rounded-lg bg-secondary px-2.5 py-1.5 text-sm transition-colors hover:bg-accent">
                <UserAvatar name={f.displayName} size={32} />
                <span className="min-w-0 flex-1 truncate font-semibold">{f.displayName}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
