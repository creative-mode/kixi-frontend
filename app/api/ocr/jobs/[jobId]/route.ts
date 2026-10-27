import { getCurrentUser } from '@/lib/auth.server';
import { call, message } from '@/lib/crud/http';

export const dynamic = 'force-dynamic';

const UUID_V4_OR_ANY = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authorize() {
  const user = await getCurrentUser();
  return user && (user.roles.includes('ADMIN') || user.roles.includes('TEACHER'));
}

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  if (!await authorize()) return new Response('Sessão expirada.', { status: 401 });
  const { jobId } = await params;
  if (!UUID_V4_OR_ANY.test(jobId)) return Response.json({ detail: 'Identificador OCR inválido.' }, { status: 400 });

  const upstream = await call(`/api/v1/ocr/jobs/${jobId}`);
  if (!upstream.ok) return new Response(await message(upstream), { status: upstream.status || 502 });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' },
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  if (!await authorize()) return new Response('Sessão expirada.', { status: 401 });
  const { jobId } = await params;
  if (!UUID_V4_OR_ANY.test(jobId)) return Response.json({ detail: 'Identificador OCR inválido.' }, { status: 400 });

  const upstream = await call(`/api/v1/ocr/jobs/${jobId}`, { method: 'DELETE' });
  if (!upstream.ok) return new Response(await message(upstream), { status: upstream.status || 502 });
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } });
}
