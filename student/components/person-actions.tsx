'use client';

import { useCallback } from 'react';

import { ReportBlock } from './report-block';
import { reportAccountAction, setBlockAction } from '@/lib/moderation-actions';

/**
 * Liga as server actions ao formulário. Server components não podem passar funções
 * para um componente cliente, por isso este é o único ponto do perfil que é cliente.
 */
export function PersonActions({
  accountId,
  nome,
  podeBloquear,
  initialBlocked = false,
  onBlockedChange,
}: {
  accountId: number;
  nome: string;
  /** Não se bloqueia o próprio, nem quem está autenticado. */
  podeBloquear: boolean;
  /** Eu bloqueei esta pessoa (`blockedByMe`): é só então que o botão diz «Desbloquear». */
  initialBlocked?: boolean;
  /** Quem usa o resultado do bloqueio (o botão «Adicionar» do perfil esconde-se). */
  onBlockedChange?: (blocked: boolean) => void;
}) {
  const denunciar = useCallback(
    (reason: string, note: string) => reportAccountAction(accountId, reason, note),
    [accountId],
  );
  const bloquear = useCallback(async (block: boolean) => {
    const result = await setBlockAction(accountId, block);
    if (typeof result.blocked === 'boolean') onBlockedChange?.(result.blocked);
    return result;
  }, [accountId, onBlockedChange]);

  return (
    <div className="border-t pt-4">
      <ReportBlock
        target="ACCOUNT"
        targetId={accountId}
        accountId={accountId}
        nome={nome}
        podeBloquear={podeBloquear}
        initialBlocked={initialBlocked}
        onReport={denunciar}
        onBlock={bloquear}
      />
    </div>
  );
}