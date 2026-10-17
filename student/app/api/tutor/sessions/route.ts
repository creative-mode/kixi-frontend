import { forwardToTutor } from '@/lib/tutor-proxy';
import { MAX_STUDENT_ANSWER } from '@/lib/tutor-rules';

export const dynamic = 'force-dynamic';

/** Opens a tutor session bound to a statement. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    statementId?: unknown;
    mode?: unknown;
    questionId?: unknown;
    selectedOptionId?: unknown;
    studentAnswer?: unknown;
  } | null;
  const statementId = Number(body?.statementId);
  if (!Number.isInteger(statementId) || statementId <= 0) {
    return Response.json({ message: 'Falta a prova.' }, { status: 400 });
  }
  const modes = ['EXPLAIN_QUESTION', 'SIMILAR_EXERCISES', 'CONCEPT', 'GENERAL'];
  if (body?.mode !== undefined && (typeof body.mode !== 'string' || !modes.includes(body.mode))) {
    return Response.json({ message: 'O modo do tutor é inválido.' }, { status: 400 });
  }
  const mode = typeof body?.mode === 'string' ? body.mode : undefined;
  const questionId = body?.questionId === undefined ? undefined : Number(body.questionId);
  if (questionId !== undefined && (!Number.isInteger(questionId) || questionId <= 0)) {
    return Response.json({ message: 'A questão é inválida.' }, { status: 400 });
  }
  if ((mode === 'EXPLAIN_QUESTION' || mode === 'SIMILAR_EXERCISES') && questionId === undefined) {
    return Response.json({ message: 'Escolhe uma questão para esse modo.' }, { status: 400 });
  }
  const selectedOptionId = body?.selectedOptionId === undefined ? undefined : Number(body.selectedOptionId);
  if (selectedOptionId !== undefined && (!Number.isInteger(selectedOptionId) || selectedOptionId <= 0)) {
    return Response.json({ message: 'A opção selecionada é inválida.' }, { status: 400 });
  }
  // Every other field on this route is rejected when it is the wrong type. This one
  // was coerced instead: `studentAnswer: 42` arrived, read as `undefined` and was
  // dropped, so the turn went on without the answer the caller believed it had sent.
  // A context field that is silently discarded is worse than one refused — the default
  // here is to reject.
  if (body?.studentAnswer !== undefined && typeof body.studentAnswer !== 'string') {
    return Response.json({ message: 'A resposta do aluno tem de ser texto.' }, { status: 400 });
  }
  // Blank is no answer, not an empty answer: `minLength: 0` on the wire would carry an
  // empty string as if the student had written nothing on purpose.
  const written = typeof body?.studentAnswer === 'string' ? body.studentAnswer.trim() : '';
  const studentAnswer = written === '' ? undefined : written;
  if (studentAnswer !== undefined && studentAnswer.length > MAX_STUDENT_ANSWER) {
    return Response.json({ message: `A resposta passa os ${MAX_STUDENT_ANSWER} caracteres.` }, { status: 400 });
  }
  if ((selectedOptionId !== undefined || studentAnswer !== undefined) && questionId === undefined) {
    return Response.json({ message: 'A resposta do aluno precisa da questão.' }, { status: 400 });
  }

  return forwardToTutor(
    '/chat/sessions',
    {
      statementId,
      ...(mode ? { mode } : {}),
      ...(questionId !== undefined ? { questionId } : {}),
      ...(selectedOptionId !== undefined ? { selectedOptionId } : {}),
      ...(studentAnswer !== undefined ? { studentAnswer } : {}),
    },
    request.signal,
  );
}
