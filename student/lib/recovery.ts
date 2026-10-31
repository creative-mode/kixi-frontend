/**
 * Recuperação de palavra-passe do aluno.
 *
 * O backend de autenticação não expõe um endpoint de recuperação (não há
 * `/auth/forgot-password` nem equivalente no contrato). Por isso não se inventa um
 * pedido: o aluno recebe sempre a mesma resposta neutra e as instruções para falar
 * com o professor ou a escola. A resposta não depende do identificador, para não
 * revelar se a conta existe.
 */
export const STUDENT_RECOVERY_MESSAGE =
  'Se estes dados corresponderem a uma conta, a escola poderá ajudar a redefinir a palavra-passe. Neste momento a recuperação automática não está disponível: fala com o teu professor ou com a secretaria da escola.';

export function studentRecoveryMessage(identifier: string): string {
  void identifier;
  return STUDENT_RECOVERY_MESSAGE;
}
