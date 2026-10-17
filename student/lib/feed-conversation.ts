/** O que o painel de uma publicação sabe da conversa (#179).
 *
 *  Vive fora do React porque o que interessa aqui é uma corrida: o aluno abre o
 *  painel, a leitura inicial ainda corre, e ele escreve antes de ela acabar. O
 *  pedido de actualizar tinha de ficar à espera da leitura em curso em vez de se
 *  perder — e isso só se prova com um teste, que sem DOM precisa de regra pura (o
 *  mesmo corte que `feed-rules.ts` e `mock/exam-rooms.ts` fazem). */

import type { PostComment } from './feed';

export type Conversation = {
  /** null é "ainda não li": uma lista vazia é "li e não há nada". */
  comments: PostComment[] | null;
  error: string | null;
  reading: boolean;
  /** Houve um pedido a meio de uma leitura: o resultado que está a caminho já vai
   *  velho e não pode entrar. */
  stale: boolean;
};

export const IDLE: Conversation = { comments: null, error: null, reading: false, stale: false };

/** Sai uma leitura. */
export function started(state: Conversation): Conversation {
  return { ...state, reading: true, stale: false };
}

/** Um pedido que chega a meio de outro não se perde: fica marcado para repetir. */
export function queued(state: Conversation): Conversation {
  return { ...state, stale: true };
}

export type ReadRequest = { start: boolean; state: Conversation };

/** Pedir a conversa: abrir o painel lê-a uma vez, reabrir não, e `force` relê sempre.
 *
 *  Pedir e marcar são o mesmo passo de propósito. Um `readComments(true)` que se
 *  lembre de pedir mas se esqueça de marcar `stale` é exactamente o que fez o
 *  comentário desaparecer: o pedido caía em silêncio e ninguém notava. */
export function requestRead(state: Conversation, force = false): ReadRequest {
  if (state.reading) {
    return force ? { start: false, state: queued(state) } : { start: false, state };
  }
  if (!force && state.comments !== null) return { start: false, state };
  return { start: true, state: started(state) };
}

/**
 * O comentário acabado de escrever entra logo na lista.
 *
 * <p>A issue pede que apareça de imediato, e esperar por uma leitura para o mostrar é
 * o mesmo atraso de sempre. Sem lista ainda não há onde o meter, por isso a lista
 * nasce com esse comentário: fica incompleta e a leitura inicial, já marcada velha,
 * não a pinta. Quem a substitui é a leitura seguinte, que vai buscar ao servidor o que
 * ele tem — e é essa que confirmará a ordem.</p>
 */
export function withComment(state: Conversation, row: PostComment): Conversation {
  if (state.comments?.some((c) => c.id === row.id)) return state;
  return { ...state, comments: [...(state.comments ?? []), row] };
}

export type Settled = { state: Conversation; chained: boolean };

/**
 * Acabou uma leitura.
 *
 * <p>Se chegou um pedido a meio dela, o resultado é velho e não entra: devolve-se a
 * lista como está — com o comentário novo à vista — e diz-se que há outra leitura para
 * sair. Sem isto, o comentário que o aluno acabou de escrever desaparecia da lista e
 * não voltava, porque `comments` deixava de ser null e reabrir o painel já não lia
 * nada.</p>
 */
export function settled(state: Conversation, comments: PostComment[] | null, error: string | null): Settled {
  if (state.stale) {
    // `reading` fica falso de propósito: a leitura que estava a curso acabou, e a
    // seguinte só sai porque `chained` diz que sai. Marcar `reading` aqui faria o
    // pedido seguinte achar que ainda havia uma em curso e não saía nenhuma.
    return { state: { ...state, reading: false, stale: false }, chained: true };
  }
  return {
    state: { ...state, comments: comments ?? state.comments, error, reading: false, stale: false },
    chained: false,
  };
}