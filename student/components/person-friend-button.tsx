'use client';

import { useState, useTransition } from 'react';
import { Ico } from '@/components/ui/ico';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { acceptFriendAction, removeFriendAction, requestFriendAction } from '@/lib/friends-actions';
import type { Friend } from '@/lib/friends';

/**
 * O botão de amizade no perfil de outra pessoa (#121): o mesmo "Convidar"/"Aceitar"/"Remover"
 * do painel do ranking (`FriendsPanel`), só que a partir de quem o aluno está a ver, não de uma
 * pesquisa. O backend é quem decide se a amizade é possível (mesma escola e ano letivo); não se
 * repete essa regra aqui — um pedido que o servidor recusa mostra-se tal e qual, como ali.
 */
export function PersonFriendButton({ accountId, friend }: { accountId: number; friend: Friend | null }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = (action: () => Promise<{ ok: true } | { ok: false; message: string }>, done?: string) =>
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? null : result.message);
      setNotice(result.ok ? (done ?? null) : null);
    });

  // Estado imediato (otimista): o botão muda no toque e volta atrás só se o servidor recusar.
  const [sent, setSent] = useState(false);
  const base = 'min-h-12 w-full gap-2 text-[15px] sm:w-auto';
  const rise = 'rise';

  return (
    <div className="grid gap-2 px-4">
      {message && <Alert variant="destructive">{message}</Alert>}
      {notice && <Alert variant="success" role="status">{notice}</Alert>}
      {friend?.accepted ? (
        <Button variant="outline" className={base} aria-label="Amigos. Tocar para remover" title="Amigos" disabled={pending} onClick={() => run(() => removeFriendAction(friend.friendshipId))}>
          <Ico name="userCheck" filled size={24} />Amigos
        </Button>
      ) : friend?.incoming ? (
        <div className="flex gap-2">
          <Button className={base} aria-label="Aceitar pedido de amizade" disabled={pending} onClick={() => run(() => acceptFriendAction(friend.friendshipId), 'Adicionado aos amigos')}>
            <Ico name="check" size={24} />Aceitar
          </Button>
          <Button variant="outline" size="icon" className="size-12" disabled={pending} onClick={() => run(() => removeFriendAction(friend.friendshipId))} aria-label="Recusar pedido" title="Recusar">
            <Ico name="x" size={22} />
          </Button>
        </div>
      ) : friend || sent ? (
        <Button key="sent" variant="secondary" className={`${base} ${rise}`} aria-label="Pedido enviado. Tocar para cancelar" title="Pedido enviado" disabled={pending || !friend} onClick={() => friend && run(() => removeFriendAction(friend.friendshipId))}>
          <Ico name="clock" size={24} />Pedido enviado
        </Button>
      ) : (
        <Button
          key="add"
          className={base}
          aria-label="Adicionar aos amigos"
          disabled={pending}
          onClick={() => {
            setSent(true);
            startTransition(async () => {
              const result = await requestFriendAction(accountId);
              setMessage(result.ok ? null : result.message);
              setNotice(result.ok ? 'Pedido enviado. A pessoa passa a aparecer nos teus amigos quando aceitar.' : null);
              if (!result.ok) setSent(false);
            });
          }}
        >
          <Ico name="userPlus" size={24} />Adicionar
        </Button>
      )}
    </div>
  );
}
