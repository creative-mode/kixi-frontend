/** Quando uma tecla é um atalho das filas e quando é só uma tecla: sem React nem DOM, testável com `node --test`. */

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  isComposing: boolean;
  repeat: boolean;
  defaultPrevented: boolean;
}

export interface KeyContext {
  /** O foco está num sítio onde se escreve (campo, área de texto, seletor, editor de fórmulas). */
  editable: boolean;
  /** Há um diálogo aberto: o que se carrega é com ele. */
  dialogOpen: boolean;
}

/** Só estas se repetem ao manter a tecla premida: andar pela lista sim, aprovar ou recusar nunca. */
const REPEATABLE = new Set(['j', 'k']);

/**
 * A tecla a tratar, em minúscula, ou `null`. Um atalho nunca dispara com modificadores (Ctrl+R recarrega a página,
 * Ctrl+A seleciona tudo), a meio de uma composição, num campo de texto, com um diálogo aberto, nem num evento
 * que outro já tratou.
 */
export function shortcutKey(event: KeyLike, context: KeyContext, allowed: readonly string[]): string | null {
  if (event.defaultPrevented || event.isComposing) return null;
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return null;
  if (context.editable || context.dialogOpen) return null;
  const key = event.key.toLowerCase();
  if (!allowed.includes(key)) return null;
  if (event.repeat && !REPEATABLE.has(key)) return null;
  return key;
}

/** A chave onde o utilizador guarda se quer os atalhos (neste navegador); o valor `off` desliga-os. */
export const SHORTCUTS_PREF_KEY = 'kixi.manager.atalhos';

/**
 * Se os atalhos estão ligados, a partir do que ficou guardado. Ligados por omissão: só um `off` explícito os desliga,
 * e qualquer outra coisa (vazio, lixo, valor antigo) conta como ligado, para um valor estragado nunca os deixar
 * desligados sem o utilizador o ter pedido.
 */
export function parseShortcutsPref(raw: string | null | undefined): boolean {
  return raw !== 'off';
}
