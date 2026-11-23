/**
 * Devolver o foco a quem abriu um diálogo. O Radix só o devolve ao `Dialog.Trigger`; os diálogos do gestor abrem-se por
 * estado (um botão normal chama `setOpen(true)`), sem Trigger, e ao fechar com Esc o foco ficava no `body` (a seguir a
 * quem navega por teclado perdia o sítio). Regra pura, para se testar sem DOM.
 */
export type FocusLike = { isConnected: boolean; disabled?: boolean; focus: () => void } | null | undefined;

/**
 * O elemento a focar ao fechar, ou `null` para deixar tudo como está. Só se devolve o foco se ele se perdeu (nada focado, ou o
 * `body`): quem clicou noutro controlo fora do diálogo, ou o próprio ecrã que moveu o foco, não é contrariado. O gatilho tem de
 * continuar na página e activo (uma acção pode tê-lo substituído ou desactivado).
 */
export function restoreTarget<T extends NonNullable<FocusLike>>(opener: T | null | undefined, active: unknown, body: unknown): T | null {
  if (!opener || !opener.isConnected || opener.disabled) return null;
  if (active !== null && active !== undefined && active !== body) return null;
  if (opener === body) return null;
  return opener;
}
