/** Regras de apresentação do feed (#120/#30), sem servidor e sem React.
 *
 *  O backend devolve só `authorAccountId` nas publicações. O nome e a foto vêm do perfil
 *  público da conta (`/profiles/accounts/{id}`, ver `loadAuthors` em feed.ts); quando esse
 *  perfil não responde, a publicação fica "Colega", sem inventar nenhum nome. */

/** Quem publicou, tal como o perfil público o mostra. */
export interface FeedAuthor {
  name: string;
  photo: string | null;
  verified: boolean;
}

export interface AuthorView {
  /** O nome a mostrar: "Tu" para o próprio, o nome do perfil, ou "Colega" sem perfil. */
  name: string;
  photo: string | null;
  mine: boolean;
  verified: boolean;
  /** Publicou na mesma turma do aluno com sessão (e não é o próprio). */
  classmate: boolean;
}

/**
 * Quem pôs o perfil como privado não é identificado por inteiro no feed: fica o primeiro nome e a
 * inicial do último ("Beatriz C."), o mesmo critério que o backend usa nos comentários, e sem foto.
 * A escolha de privacidade da pessoa pesa mais do que a vontade de pôr nomes nas publicações.
 */
export function maskName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export const CLASSMATE_LABEL = 'Colega de turma';

/** Junta a publicação, o perfil do autor (se o houver) e a turma de quem está a ver. */
export function authorView(
  post: { authorAccountId: number; classId: number },
  myAccountId: number | null,
  author: FeedAuthor | null | undefined,
  myClassId: number | null,
  me: { name: string; photo: string | null },
): AuthorView {
  if (myAccountId != null && post.authorAccountId === myAccountId) {
    return { name: me.name || 'Tu', photo: me.photo, mine: true, verified: false, classmate: false };
  }
  return {
    name: author?.name?.trim() || 'Colega',
    photo: author?.photo ?? null,
    mine: false,
    verified: author?.verified ?? false,
    classmate: myClassId != null && post.classId === myClassId,
  };
}

export const POST_TYPE_LABEL: Record<string, string> = {
  doubt: 'Dúvida',
  topic: 'Tema',
  exam: 'Prova',
  milestone: 'Marco',
  simulation: 'Prova simulada',
};

export function postTypeLabel(type: string): string {
  return POST_TYPE_LABEL[type] ?? type;
}

/** Quem escreveu um comentário: "Tu" é o próprio aluno (mesmo sem nome no perfil),
 *  os outros são o nome mascarado que o backend devolveu, e quem não tem perfil
 *  fica "Colega" - o mesmo rótulo de quem não tem nome, sem inventar nenhum. */
export function commentAuthorLabel(displayName: string | null | undefined, mine: boolean): string {
  if (mine) return 'Tu';
  return displayName?.trim() ? displayName : 'Colega';
}

/** Uma publicação só se envia depois de 5 caracteres (o mínimo que o backend aceita,
 *  @Size(min = 5)) - mostrar isto antes do 400 poupa uma viagem ao servidor para dizer
 *  o que o próprio formulário já sabe. */
export const MIN_POST_LENGTH = 5;
export const MAX_POST_LENGTH = 2000;

export function canPublish(content: string): boolean {
  const length = content.trim().length;
  return length >= MIN_POST_LENGTH && length <= MAX_POST_LENGTH;
}

/** A etiqueta sobre o texto que o aluno escreve a acompanhar o cartão do resultado. */
export const REFLECTION_LABEL = 'Reflexão';

/** A reflexão que acompanha um resultado é opcional, mas se existir respeita o mesmo limite. */
export function canPublishReflection(content: string): boolean {
  return content.trim().length <= MAX_POST_LENGTH;
}

/** Nota em percentagem da cotação total, ou null quando falta um dos números (ou a cotação é 0). */
export function scorePercent(score: number | null | undefined, max: number | null | undefined): number | null {
  if (score == null || max == null || max <= 0) return null;
  return Math.round((score / max) * 100);
}
