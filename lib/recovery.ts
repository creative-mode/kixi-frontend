/**
 * Recuperação de palavra-passe do gestor.
 *
 * O backend de autenticação não expõe um endpoint de recuperação (não há
 * `/auth/forgot-password` nem equivalente no contrato). Por isso não se inventa um
 * pedido: o utilizador recebe sempre a mesma resposta neutra e as instruções para
 * falar com a escola. A resposta não depende do identificador, para não revelar se a
 * conta existe.
 */
export const MANAGER_RECOVERY_MESSAGE =
  'Se estes dados corresponderem a uma conta, a escola poderá ajudar a redefinir a palavra-passe. Neste momento a recuperação automática não está disponível: contacta o professor ou a secretaria da escola.';

export function managerRecoveryMessage(identifier: string): string {
  void identifier;
  return MANAGER_RECOVERY_MESSAGE;
}
