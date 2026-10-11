'use server';

import { redirect } from 'next/navigation';
import { requireStudent } from './guard';
import { getStatementFull, myAccountId, saveAnswer, startSimulation, submitSimulation } from './exam';
import { answerRequest, isTransient, translateError, type ExamQuestion } from './exam-rules';

/** What the room sends to save one answer. Plain values, not a FormData: the save
 *  queue calls this directly, and it is the queue — not a form — that knows the
 *  current `answerId`. The question's type is NOT in here: it is read from the
 *  server again, because it decides whether the answer is an option or a text. */
export interface SaveInput {
  simulationId: number;
  statementId: number;
  questionId: number;
  optionId: number | null;
  text: string;
  answerId: number | null;
}

/** The outcome of saving one answer. `transient` tells the queue whether to try
 *  again (the network or the server had a bad moment) or to stop and show the error
 *  (the server refused, and repeating would not change that). */
export type SaveOutcome =
  | { ok: true; answerId: number }
  | { ok: false; message: string; transient: boolean };

function id(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Loads the questions again instead of trusting the browser. The question is what
 *  decides whether this is a choice or an open answer, and that decision belongs
 *  to the server: a `questionType` or an option id sent by the browser would tell
 *  the backend that an open question has a chosen alternative. */
async function questionOf(statementId: number, questionId: number): Promise<ExamQuestion | null> {
  const statement = await getStatementFull(statementId, { cached: true });
  if (!statement.ok) return null;
  return statement.data.questions.find((q) => q.id === questionId) ?? null;
}

export async function guardarAction(input: SaveInput): Promise<SaveOutcome> {
  await requireStudent();

  const simulationId = id(input.simulationId);
  const statementId = id(input.statementId);
  const questionId = id(input.questionId);
  const previousId = id(input.answerId);

  if (simulationId === null || statementId === null || questionId === null) {
    return { ok: false, transient: false, message: 'Não identificámos a questão. Tenta de novo.' };
  }

  const question = await questionOf(statementId, questionId);
  if (!question) {
    return { ok: false, transient: false, message: 'Esta questão não existe nesta prova.' };
  }

  const result = await saveAnswer(
    answerRequest(simulationId, question, {
      optionId: input.optionId === null ? null : String(input.optionId),
      text: typeof input.text === 'string' ? input.text : null,
    }),
    previousId,
  );

  if (!result.ok) {
    return { ok: false, transient: isTransient(result.status), message: translateError(result.message) };
  }
  return { ok: true, answerId: result.data.id };
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
  if (!result.ok) return { error: translateError(result.message) };

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
  if (!result.ok && result.status !== 409) return { error: translateError(result.message) };

  redirect(`/resultado?prova=${simulationId}`);
}
