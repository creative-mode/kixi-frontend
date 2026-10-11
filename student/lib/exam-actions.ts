'use server';

import { redirect } from 'next/navigation';
import { requireStudent } from './guard';
import { getStatementFull, myAccountId, saveAnswer, startSimulation, submitSimulation } from './exam';
import { answerRequest, type ExamQuestion } from './exam-rules';

/** The outcome of saving one answer.
 *
 *  `answerId` comes back on every save because it decides the verb next time:
 *  there is no upsert on the backend, so a second POST for the same question is a
 *  409 (SimulationAnswerService.java:97). Losing it turns every later edit of
 *  that question into a create, and the student cannot change one answer twice. */
export type AnswerState =
  | { status: 'saved'; answerId: number; error?: undefined }
  | { status: 'error'; answerId: number | null; error: string }
  | undefined;

function id(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** `FormDataEntryValue` é `string | File`, e um File nunca é uma resposta de prova. */
function text(value: FormDataEntryValue | null): string | null {
  return typeof value === 'string' ? value : null;
}

/** Loads the questions again instead of trusting the form. The question is what
 *  decides whether this is a choice or an open answer, and that decision belongs
 *  to the server: a `questionType` or an option id sent by the browser would tell
 *  the backend that an open question has a chosen alternative. */
async function questionOf(statementId: number, questionId: number): Promise<ExamQuestion | null> {
  const statement = await getStatementFull(statementId);
  if (!statement.ok) return null;
  return statement.data.questions.find((q) => q.id === questionId) ?? null;
}

export async function responderAction(_: AnswerState, form: FormData): Promise<AnswerState> {
  await requireStudent();

  const simulationId = id(form.get('simulationId'));
  const statementId = id(form.get('statementId'));
  const questionId = id(form.get('questionId'));
  const previousId = id(form.get('answerId'));

  if (simulationId === null || statementId === null || questionId === null) {
    return {
      status: 'error',
      answerId: previousId,
      error: 'Não identificámos a questão. Tenta de novo.',
    };
  }

  const question = await questionOf(statementId, questionId);
  if (!question) {
    return {
      status: 'error',
      answerId: previousId,
      error: 'Esta questão não existe nesta prova.',
    };
  }

  const result = await saveAnswer(
    answerRequest(simulationId, question, {
      optionId: text(form.get('optionId')),
      text: text(form.get('answerText')),
    }),
    previousId,
  );

  if (!result.ok) return { status: 'error', answerId: previousId, error: result.message };
  return { status: 'saved', answerId: result.data.id };
}

export type StartState = { error?: string } | undefined;

export async function iniciarAction(_: StartState, form: FormData): Promise<StartState> {
  await requireStudent();

  const statementId = id(form.get('statementId'));
  if (statementId === null) return { error: 'Não identificámos a prova.' };

  const accountId = await myAccountId();
  if (accountId === null) {
    return { error: 'A sessão expirou. Entra novamente.' };
  }

  const result = await startSimulation(statementId, accountId);
  if (!result.ok) return { error: result.message };

  // Caminho cru, de propósito: numa server action o Next escreve este valor no
  // cabeçalho `x-action-redirect` e o cliente acrescenta o basePath. Escrever
  // `/aluno/prova/...` aqui daria `/aluno/aluno/prova/...`. Ver README, "basePath".
  redirect(`/prova/${statementId}`);
}

export type SubmitState = { error?: string } | undefined;

/** Hands the simulation in. Nothing is sent with it: the server grades what is
 *  stored and closes the simulation, and a client-sent score would be ignored. */
export async function submeterAction(_: SubmitState, form: FormData): Promise<SubmitState> {
  await requireStudent();

  const simulationId = id(form.get('simulationId'));
  if (simulationId === null) return { error: 'Não identificámos a prova.' };

  const result = await submitSimulation(simulationId);

  // 409 é "já entregue": a prova está corrigida, o aluno não está a perder nada
  // por acidentalmente carregar em Entregar duas vezes.
  if (!result.ok && result.status !== 409) return { error: result.message };

  redirect(`/resultado?prova=${simulationId}`);
}
