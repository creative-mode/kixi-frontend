import { getCurrentUser } from '@/lib/auth.server';
import { call, message } from '@/lib/crud/http';
import { ocrFilesProblem } from '@/lib/crud/ocr-files';
import { createOcrRequestId, isOcrRequestId } from '@/lib/exam/ocr-telemetry';

export const dynamic = 'force-dynamic';

/** Same-origin authenticated bridge. The bearer token stays on the server. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(user.roles.includes('ADMIN') || user.roles.includes('TEACHER'))) {
    return new Response('Sessão expirada.', { status: 401 });
  }

  let form: FormData;
  const uploadStarted = performance.now();
  try {
    form = await request.formData();
  } catch {
    return Response.json({ detail: 'Não foi possível ler os ficheiros enviados.' }, { status: 400 });
  }
  const uploadMs = Math.round(performance.now() - uploadStarted);

  const files = form.getAll('files').filter((value): value is File => value instanceof File && value.size > 0);
  const problem = ocrFilesProblem(files);
  if (problem) return Response.json({ detail: problem }, { status: 400 });

  const suppliedRequestId = request.headers.get('X-OCR-Request-ID');
  if (suppliedRequestId && !isOcrRequestId(suppliedRequestId)) {
    return Response.json({ detail: 'Identificador de medição inválido.' }, { status: 400 });
  }
  const requestId = suppliedRequestId?.toLowerCase() ?? createOcrRequestId();

  const upstreamForm = new FormData();
  for (const file of files) upstreamForm.append('files', file, file.name);

  const upstream = await call('/api/v1/ocr/extract/stream', {
    method: 'POST',
    body: upstreamForm,
    headers: {
      Accept: 'text/event-stream',
      'X-OCR-Upload-Ms': String(uploadMs),
      'X-OCR-Request-ID': requestId,
    },
    signal: request.signal,
  });
  if (!upstream.ok || !upstream.body) {
    return new Response(await message(upstream), { status: upstream.status || 502 });
  }

  const headers = new Headers({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const upstreamRequestId = upstream.headers.get('X-Request-ID');
  const serverTiming = upstream.headers.get('Server-Timing');
  headers.set('X-OCR-Request-ID', requestId);
  if (upstreamRequestId) headers.set('X-Request-ID', upstreamRequestId);
  if (serverTiming) headers.set('Server-Timing', serverTiming);

  return new Response(upstream.body, { status: upstream.status, headers });
}
