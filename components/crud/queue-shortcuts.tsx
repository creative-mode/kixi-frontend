'use client';

import { useQueueShortcuts, useShortcutsEnabled } from '@/hooks/use-queue-shortcuts';

/**
 * Regista os atalhos de uma fila. É um componente, e não uma chamada ao hook, para os ecrãs que só têm os seus
 * dados depois de um `return` antecipado (carregar, erro) poderem montá-lo quando já os têm. Respeita o
 * interruptor da legenda: com os atalhos desligados não regista nada.
 */
export function QueueShortcuts({ handlers, enabled = true }: { handlers: Record<string, () => void>; enabled?: boolean }) {
  const [on] = useShortcutsEnabled();
  useQueueShortcuts(handlers, enabled && on);
  return null;
}
