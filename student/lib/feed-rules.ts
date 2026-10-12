/** Regras de apresentação do feed (#120/#30), sem servidor e sem React.
 *
 *  O backend nunca devolve o nome de quem publicou - só `authorAccountId` - e não
 *  há nenhum endpoint que um aluno possa chamar para o resolver (`/users/**` é
 *  ADMIN-only, ver SecurityConfig do backend). Por isso uma publicação é só "Tu"
 *  ou "Um colega da turma", nunca um nome inventado. */

export const POST_TYPE_LABEL: Record<string, string> = {
  doubt: 'Dúvida',
  topic: 'Tema',
  exam: 'Prova',
  milestone: 'Marco',
};

export function postTypeLabel(type: string): string {
  return POST_TYPE_LABEL[type] ?? type;
}

export function authorLabel(authorAccountId: number, myAccountId: number | null): string {
  return myAccountId != null && authorAccountId === myAccountId ? 'Tu' : 'Um colega da turma';
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
