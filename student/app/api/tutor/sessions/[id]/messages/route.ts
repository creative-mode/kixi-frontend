import { forwardToTutor } from '@/lib/tutor-proxy';
import { MAX_MESSAGE } from '@/lib/tutor-rules';

export const dynamic = 'force-dynamic';

/** Sends one message and streams the answer back as server-sent events. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ message: 'Conversa inválida.' }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { content?: unknown } | null;
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  if (!content) return Response.json({ message: 'A mensagem está vazia.' }, { status: 400 });
  if (content.length > MAX_MESSAGE) {
    return Response.json({ message: `A mensagem passa os ${MAX_MESSAGE} caracteres.` }, { status: 400 });
  }
  return forwardToTutor(`/chat/sessions/${id}/messages`, { content }, request.signal);
}
