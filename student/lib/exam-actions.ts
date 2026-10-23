'use server';

import { forgetVisitedPages } from './refresh';
import { requireStudent } from './guard';
import { getMe } from './me';
import { getStatementFull, myAccountId, saveAnswer, saveIntegrityEvent, startSimulation, submitSimulation } from './exam';
import { getStudentView } from './exam-room';
import { answerRequest, isTransient, translateError, type ExamQuestion } from './exam-rules';
import { isIntegrityKind, type IntegrityKind } from './integrity';
import { redirectFromAction } from './action-redirect';

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
  /** Numa sala de prova, as questões leem-se da sala: o enunciado pode não estar publicado. */
  roomId?: number | null;
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
async function questionOf(statementId: number, questionId: number, roomId: number | null): Promise<ExamQuestion | null> {
  if (roomId !== null) {
    const view = await getStudentView(roomId, { cached: true });
    if (!view.ok) return null;
    return view.data.questions.find((q) => q.id === questionId) ?? null;
  }
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

  const question = await questionOf(statementId, questionId, id(input.roomId));
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

  // O ano letivo vai com a simulação: é por ele que o ranking a conta. O da prova, e na falta
  // dele (uma prova sem ano) o da turma do aluno, que é a coorte onde ele é comparado.
  const statement = await getStatementFull(statementId, { cached: true });
  const schoolYearId = (statement.ok ? statement.data.schoolYearId : null)
    ?? (await getMe())?.currentClass?.school_year_id
    ?? null;

  const result = await startSimulation(statementId, accountId, schoolYearId);
  if (!result.ok) return { error: translateError(result.message) };

  // Caminho cru, de propósito: numa server action o Next escreve este valor no
  // cabeçalho `x-action-redirect` e o cliente acrescenta o basePath. Escrever
  // `/aluno/prova/...` aqui daria `/aluno/aluno/prova/...`. Ver README, "basePath".
  // `iniciada=1` é o sinal de uso único do kixi-frontend#219 ("prova iniciada"): a
  // mesma sala é revisitada enquanto a tentativa continua em curso.
  forgetVisitedPages();
  await redirectFromAction(`/prova/${statementId}?iniciada=1`);
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

  // `submetida=1` é o sinal de uso único do kixi-frontend#219 ("prova submetida"): o
  // resultado é revisitado depois, para o aluno ver a nota de novo.
  forgetVisitedPages();
  await redirectFromAction(`/resultado?prova=${simulationId}&submetida=1`);
}

/** O que o modo de avaliação regista. Vem do cliente, por isso o tipo é validado
 *  aqui: uma string livre chegaria ao backend como um evento que ninguém sabe ler. */
export interface EventoInput {
  simulationId: number;
  kind: IntegrityKind;
  questionId?: number | null;
}

/** Regista um evento do modo de avaliação (#192). Best-effort de propósito: o
 *  registo é uma nota para o professor, não uma condição para responder. Se falhar,
 *  o aluno não pode ficar a saber — e nunca fica bloqueado por causa disso. */
export async function registarEventoAction(input: EventoInput): Promise<{ ok: boolean }> {
  await requireStudent();

  const simulationId = id(input.simulationId);
  if (simulationId === null || !isIntegrityKind(input.kind)) return { ok: false };

  const result = await saveIntegrityEvent(simulationId, input.kind, id(input.questionId));
  return { ok: result.ok };
}
