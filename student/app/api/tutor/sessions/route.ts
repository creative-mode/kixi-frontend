import { forwardToTutor } from '@/lib/tutor-proxy';

export const dynamic = 'force-dynamic';

/** Opens a tutor session bound to a statement. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { statementId?: unknown } | null;
  const statementId = Number(body?.statementId);
  if (!Number.isInteger(statementId) || statementId <= 0) {
    return Response.json({ message: 'Falta a prova.' }, { status: 400 });
  }
  return forwardToTutor('/chat/sessions', { statementId }, request.signal);
}
