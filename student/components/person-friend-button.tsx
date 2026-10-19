'use client';

import { useState, useTransition } from 'react';
import { Check, UserPlus, X } from 'lucide-react';
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

  return (
    <div className="grid gap-2">
      {message && <Alert variant="destructive">{message}</Alert>}
      {notice && <Alert variant="success" role="status">{notice}</Alert>}
      {friend?.accepted ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => removeFriendAction(friend.friendshipId))}>
          No teu Buke · Remover
        </Button>
      ) : friend?.incoming ? (
        <div className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={() => run(() => acceptFriendAction(friend.friendshipId), 'Adicionado ao Buke')}>
            <Check />Aceitar
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => removeFriendAction(friend.friendshipId))} aria-label="Recusar pedido">
            <X />
          </Button>
        </div>
      ) : friend ? (
        // Pedido já enviado, ainda por responder.
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => removeFriendAction(friend.friendshipId))}>
          Pedido enviado · Cancelar
        </Button>
      ) : (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(() => requestFriendAction(accountId), 'Pedido enviado. Aparece no teu Buke quando aceitar.')}
        >
          <UserPlus />Add ao Buke
        </Button>
      )}
    </div>
  );
}
