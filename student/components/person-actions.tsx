'use client';

import { useCallback } from 'react';

import { ReportBlock } from './report-block';
import { reportAccountAction, toggleBlockAction } from '@/lib/moderation-actions';

/**
 * Liga as server actions ao formulário. Server components não podem passar funções
 * para um componente cliente, por isso este é o único ponto do perfil que é cliente.
 */
export function PersonActions({
  accountId,
  nome,
  podeBloquear,
  onBlockedChange,
}: {
  accountId: number;
  nome: string;
  /** Não se bloqueia o próprio, nem quem está autenticado. */
  podeBloquear: boolean;
  /** Quem usa o resultado do bloqueio (o botão «Adicionar» do perfil esconde-se). */
  onBlockedChange?: (blocked: boolean) => void;
}) {
  const denunciar = useCallback(
    (reason: string, note: string) => reportAccountAction(accountId, reason, note),
    [accountId],
  );
  const bloquear = useCallback(async () => {
    const result = await toggleBlockAction(accountId);
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
        onReport={denunciar}
        onBlock={bloquear}
      />
    </div>
  );
}