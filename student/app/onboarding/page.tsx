import { FireEventOnce } from '@/components/analytics/fire-event-once';
import { OnboardingForm } from '@/components/onboarding-form';

export const metadata = { title: 'Começar · Kixi' };

/** Só o código: a turma e o ano letivo vêm dele (kixi#255), por isso o ecrã não
 *  precisa de pedir escola/curso/turma — nem depende de o backend responder às
 *  listas para deixar um aluno matricular-se. A página é estática: o único pedido
 *  é o `POST /enrollments` da server action. */
export default function OnboardingPage() {
  // #219: o registo acabou de acontecer (ver auth-actions.ts) mesmo quando este ecrã
  // em concreto falha a seguir — por isso dispara-se antes de qualquer saída antecipada.
  return (
    <>
      <FireEventOnce param="novo" event="sign_up" />
      <OnboardingForm />
    </>
  );
}
