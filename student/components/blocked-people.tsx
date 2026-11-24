'use client';

import { useState, useTransition } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { setBlockAction } from '@/lib/moderation-actions';
import type { BlockedPerson } from '@/lib/moderation';

/**
 * «Pessoas bloqueadas» nas definições (kixi#656): quem bloqueei, com «Desbloquear». É a única porta de volta para quem
 * bloqueou alguém cujo perfil já não consegue abrir por outro caminho (a pessoa bloqueada não aparece em pesquisas nem feed).
 * Só quem bloqueou desbloqueia: o servidor recusa o resto, por isso a lista só tem as pessoas que eu bloqueei.
 */
export function BlockedPeople({ initial, loadError = null }: { initial: BlockedPerson[]; loadError?: string | null }) {
  const [people, setPeople] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [pending, start] = useTransition();

  function unblock(person: BlockedPerson) {
    setError(null);
    setWorkingId(person.accountId);
    start(async () => {
      const result = await setBlockAction(person.accountId, false);
      setWorkingId(null);
      if (result.error) setError(result.error);
      else setPeople((current) => current.filter((p) => p.accountId !== person.accountId));
    });
  }

  return (
    <div className="grid gap-2 border-t border-[#eef0ec] py-3.5" data-testid="aluno-pessoas-bloqueadas">
      <div className="grid gap-0.5 leading-snug">
        <h3 className="m-0 text-[15px] font-normal">Pessoas bloqueadas</h3>
        <span className="text-[13px] text-muted-foreground">Não se veem nem se podem contactar. Só tu podes desbloquear.</span>
      </div>
      {loadError && <Alert variant="destructive">{loadError}</Alert>}
      {error && <Alert variant="destructive">{error}</Alert>}
      {!loadError && people.length === 0 && <p className="m-0 text-sm text-muted-foreground">Não bloqueaste ninguém.</p>}
      {people.length > 0 && (
        <ul className="m-0 grid list-none gap-1 p-0">
          {people.map((p) => (
            <li key={p.accountId} className="flex items-center gap-3 py-1.5">
              <UserAvatar name={p.displayName} src={p.photo} size={32} />
              <span className="min-w-0 flex-1 truncate text-[15px]">{p.displayName}</span>
              <Button
                type="button" variant="outline" size="sm" disabled={pending}
                aria-label={`Desbloquear ${p.displayName}`}
                onClick={() => unblock(p)}
              >
                {workingId === p.accountId ? 'A desbloquear…' : 'Desbloquear'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
