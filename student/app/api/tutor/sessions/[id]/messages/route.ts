import { forwardToTutor } from '@/lib/tutor-proxy';
import { MAX_MESSAGE } from '@/lib/tutor-rules';

export const dynamic = 'force-dynamic';

/** Sends one message and streams the answer back as server-sent events. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ message: 'Conversa inválida.' }, { status: 404 });

  const body = (await request.json().catch(() => null)) as {
    content?: unknown;
    mode?: unknown;
    statementId?: unknown;
    questionId?: unknown;
    wrongAnswer?: unknown;
  } | null;
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  if (!content) return Response.json({ message: 'A mensagem está vazia.' }, { status: 400 });
  if (content.length > MAX_MESSAGE) {
    return Response.json({ message: `A mensagem passa os ${MAX_MESSAGE} caracteres.` }, { status: 400 });
  }
  const modes = ['EXPLAIN_QUESTION', 'SIMILAR_EXERCISES', 'CONCEPT'];
  if (body?.mode !== undefined && (typeof body.mode !== 'string' || !modes.includes(body.mode))) {
    return Response.json({ message: 'O modo do tutor é inválido.' }, { status: 400 });
  }
  const mode = typeof body?.mode === 'string' && modes.includes(body.mode) ? body.mode : undefined;
  const statementId = body?.statementId === undefined ? undefined : Number(body.statementId);
  const questionId = body?.questionId === undefined ? undefined : Number(body.questionId);
  if (statementId !== undefined && (!Number.isInteger(statementId) || statementId <= 0)) {
    return Response.json({ message: 'A prova é inválida.' }, { status: 400 });
  }
  if (questionId !== undefined && (!Number.isInteger(questionId) || questionId <= 0)) {
    return Response.json({ message: 'A questão é inválida.' }, { status: 400 });
  }
  const wrongAnswer = typeof body?.wrongAnswer === 'string' ? body.wrongAnswer : undefined;
  if (wrongAnswer !== undefined && wrongAnswer.length > 2000) {
    return Response.json({ message: 'A resposta passa os 2000 caracteres.' }, { status: 400 });
  }
  return forwardToTutor(
    `/chat/sessions/${id}/messages`,
    {
      content,
      ...(mode ? { mode } : {}),
      ...(statementId !== undefined ? { statementId } : {}),
      ...(questionId !== undefined ? { questionId } : {}),
      ...(wrongAnswer !== undefined ? { wrongAnswer } : {}),
    },
    request.signal,
  );
}
