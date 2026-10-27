import { getCurrentUser } from '@/lib/auth.server';
import { call, message } from '@/lib/crud/http';
import { ocrFilesProblem } from '@/lib/crud/ocr-files';
import { createOcrRequestId, isOcrRequestId } from '@/lib/exam/ocr-telemetry';
import { readBoundedRequestBody } from '@/lib/exam/ocr-upload';

export const dynamic = 'force-dynamic';

/** Same-origin authenticated bridge. The bearer token stays on the server. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(user.roles.includes('ADMIN') || user.roles.includes('TEACHER'))) {
    return new Response('Sessão expirada.', { status: 401 });
  }

  let form: FormData;
  const uploadStarted = performance.now();
  const body = await readBoundedRequestBody(request);
  if (!body.ok) {
    if (body.tooLarge) {
      return Response.json({ detail: 'O envio ultrapassa o limite permitido.' }, { status: 413 });
    }
    return Response.json({ detail: 'Não foi possível ler os ficheiros enviados.' }, { status: 400 });
  }
  try {
    // The original Request body has been bounded above. Parsing this reconstructed
    // request keeps the multipart parser from seeing an unbounded stream.
    const boundedRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: body.bytes,
    });
    form = await boundedRequest.formData();
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

  const upstream = await call('/api/v1/ocr/jobs', {
    method: 'POST',
    body: upstreamForm,
    headers: {
      Accept: 'application/json',
      'X-OCR-Upload-Ms': String(uploadMs),
      'X-OCR-Request-ID': requestId,
    },
    signal: request.signal,
  });
  if (!upstream.ok) {
    return new Response(await message(upstream), { status: upstream.status || 502 });
  }
  const accepted = await upstream.json().catch(() => null);
  if (!accepted || typeof accepted.jobId !== 'string' || typeof accepted.statusUrl !== 'string') {
    return Response.json({ detail: 'O servidor não confirmou a fila OCR.' }, { status: 502 });
  }
  return Response.json(accepted, {
    status: 202,
    headers: { 'Cache-Control': 'no-store', 'X-OCR-Request-ID': requestId },
  });
}
