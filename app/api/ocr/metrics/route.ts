import { getCurrentUser } from '@/lib/auth.server';
import { parseOcrTelemetryPayload } from '@/lib/exam/ocr-telemetry';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 4_096;

type BoundedBody = { ok: true; text: string } | { ok: false; tooLarge: boolean };

async function readBoundedBody(request: Request): Promise<BoundedBody> {
  const length = request.headers.get('content-length');
  if (length && !/^\d+$/.test(length)) return { ok: false, tooLarge: false };
  if (length && Number(length) > MAX_BODY_BYTES) return { ok: false, tooLarge: true };
  if (!request.body) return { ok: false, tooLarge: false };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return { ok: false, tooLarge: true };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, tooLarge: false };
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, tooLarge: false };
  }
}

/** Receives only allowlisted timings/counts and writes one sanitized structured log entry. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(user.roles.includes('ADMIN') || user.roles.includes('TEACHER'))) {
    return new Response('Sessão expirada.', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    return new Response(null, { status: 415, headers: { 'Cache-Control': 'no-store' } });
  }

  const body = await readBoundedBody(request);
  if (!body.ok) return new Response(null, { status: body.tooLarge ? 413 : 400, headers: { 'Cache-Control': 'no-store' } });
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.text);
  } catch {
    return new Response(null, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const telemetry = parseOcrTelemetryPayload(parsed);
  if (!telemetry) return new Response(null, { status: 400, headers: { 'Cache-Control': 'no-store' } });

  console.info(JSON.stringify({ event: 'kixi.ocr.telemetry', ...telemetry }));
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
