/** O cookie de sessão leva `Secure` sempre que a ligação é HTTPS (directa ou atrás de um proxy TLS, que manda `x-forwarded-proto`) e, em
 *  produção, mesmo que o proxy não mande o cabeçalho: sem isto, um TLS que termina antes do Next emitia o token sem `Secure` e ele passava a
 *  poder circular em claro. Igual no gestor e no aluno (#588). Em desenvolvimento por HTTP fica sem `Secure`, senão o browser descartava o cookie. */
export function cookieSeguro(protocoloEncaminhado: string | null, env: Record<string, string | undefined> = process.env): boolean {
  return protocoloEncaminhado === 'https' || env.NODE_ENV === 'production';
}
