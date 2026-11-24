import { translateError } from './exam-rules.ts';
import { translateRoomError } from './exam-room-rules.ts';

/** Frases em português para os estados HTTP que o backend devolve.
 *  O texto do servidor (`detail`) está em inglês e é técnico: serve para registos, não para o aluno. */
export function messageForStatus(status: number): string {
  if (status === 401) return 'A sessão expirou. Entra novamente.';
  if (status === 403) return 'Não tens permissão para fazer isto.';
  if (status === 404) return 'Não encontrámos o que procuravas. Pode já não estar disponível.';
  if (status === 408) return 'O servidor demorou a responder. Tenta de novo.';
  if (status === 409) return 'Isto já existe ou foi alterado entretanto. Atualiza a página e tenta de novo.';
  if (status === 400 || status === 422) return 'Há dados que não estão certos. Verifica e tenta de novo.';
  if (status === 413) return 'O ficheiro é grande demais.';
  if (status === 429) return 'Foram feitos pedidos a mais. Espera um momento e tenta de novo.';
  if (status >= 500) return 'O servidor teve um problema. Tenta de novo daqui a pouco.';
  return 'Não foi possível concluir. Tenta de novo.';
}

/** O 409 de um pedido de amizade a quem já é amigo: o ecrã actualiza-se para mostrar a amizade. */
export const ALREADY_FRIENDS = 'Já são amigos.';

/** O 403 de um enunciado usado numa prova que ainda não terminou. */
export const EMBARGO = 'Ainda não está disponível: este enunciado faz parte de uma prova que ainda não terminou. Abre quando a prova terminar.';

/** Os textos do feed, das amizades e das contas que o backend devolve em inglês (S9): têm frase própria, que diz a causa. */
const FEED: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Class not found, or you do not belong to it/i, () => 'Essa turma não existe ou não é a tua.'],
  [/^Class not found/i, () => 'A turma não existe ou foi removida.'],
  [/^Content must have at least (\d+) characters/i, (m) => `Escreve pelo menos ${m[1]} caracteres.`],
  [/^Content must have (\d+) to (\d+) characters/i, (m) => `O texto tem de ter entre ${m[1]} e ${m[2]} caracteres.`],
  [/^Account is inactive/i, () => 'Esta conta está desativada. Fala com a tua escola para a reativar.'],
  [/^Too many feed requests/i, () => 'Pediste o feed vezes de mais. Espera um momento e tenta de novo.'],
  [/^Post not found/i, () => 'A publicação já não existe.'],
  [/^Comment not found/i, () => 'O comentário já não existe.'],
  [/^You have already reported this post/i, () => 'Já denunciaste esta publicação.'],
  [/^You cannot follow yourself/i, () => 'Não podes enviar um pedido de amizade a ti próprio.'],
  // Amizades e bloqueio (kixi#656): o 409 diz a causa; o 404 de quem me bloqueou não revela o bloqueio.
  [/^Já são amigos/i, () => ALREADY_FRIENDS],
  [/^Bloqueaste esta pessoa/i, () => 'Bloqueaste esta pessoa. Desbloqueia-a (em Definições, «Pessoas bloqueadas») antes de enviar um pedido de amizade.'],
  [/^Pessoa não encontrada/i, () => 'Não foi possível concluir. Esta pessoa já não está disponível.'],
  [/^You cannot block yourself/i, () => 'Não podes bloquear-te a ti.'],
  [/^Could not update the block state/i, () => 'O bloqueio mudou entretanto. Atualiza a página e tenta de novo.'],
  // Enunciado de uma prova por terminar (kixi#659): as perguntas e opções, e a simulação ou o treino que as usam, abrem no fim.
  [/prova que ainda não terminou/i, () => EMBARGO],
];

export function translateFeedError(serverText: string): string {
  for (const [re, to] of FEED) {
    const m = serverText.match(re);
    if (m) return to(m);
  }
  return serverText;
}

/** A frase para o aluno. Os textos do servidor que já conhecemos têm tradução própria (exam-rules,
 *  exam-room-rules) porque dizem a causa exacta ("a prova já foi entregue"); tudo o resto cai na
 *  frase genérica do estado, nunca no texto em inglês. */
export function friendlyMessage(status: number, serverText: string): string {
  const exam = translateError(serverText);
  if (exam !== serverText) return exam;
  const room = translateRoomError(serverText);
  if (room !== serverText) return room;
  const feed = translateFeedError(serverText);
  if (feed !== serverText) return feed;
  return messageForStatus(status);
}

/** Só faz sentido tentar de novo quando a falha pode passar sozinha. */
export function isRetryable(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}
