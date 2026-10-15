import { NextResponse } from 'next/server';
import {
  MAX_FILES,
  MAX_TOTAL_BYTES,
  forwardedFor,
  messageForStatus,
  readFields,
  validateFields,
  validateFiles,
} from '@/lib/donation-rules';

export const dynamic = 'force-dynamic';

/** Margem para o texto dos campos e o enquadramento do multipart por cima dos ficheiros. */
const ENVELOPE_BYTES = 256 * 1024;
const FORWARD_TIMEOUT_MS = 90_000;
const NO_STORE = { 'Cache-Control': 'no-store' };

function fail(status: number, error: string, extra: Record<string, unknown> = {}, headers: HeadersInit = {}) {
  return NextResponse.json({ error, ...extra }, { status, headers: { ...NO_STORE, ...headers } });
}

/**
 * A doação vai daqui para o backend, que é quem a avalia (tipo pelos bytes, limites, orçamento
 * por cliente). Este handler só impede que um pedido torto ou gigante chegue lá, repassa o
 * endereço do visitante e traduz as respostas. Não guarda nada nem lê cookies.
 */
export async function POST(request: Request) {
  const backend = (process.env.BACKEND_API_URL ?? '').replace(/\/$/, '');
  if (!backend) {
    return fail(503, 'O serviço de doação ainda não está configurado. Tenta mais tarde.');
  }

  const declared = Number(request.headers.get('content-length'));
  if (!Number.isFinite(declared) || declared <= 0) return fail(411, messageForStatus(411));
  if (declared > MAX_TOTAL_BYTES + ENVELOPE_BYTES) return fail(413, messageForStatus(413));
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('multipart/form-data')) {
    return fail(415, messageForStatus(415));
  }

  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return fail(400, messageForStatus(400));
  }

  const fields = readFields((name) => incoming.get(name));
  const fieldErrors = validateFields(fields);
  const files = incoming.getAll('files').filter((entry): entry is File => typeof entry !== 'string');
  const filesError = validateFiles(files);
  // Os campos escondidos de bot passam sem validação: quem decide é o backend, que responde igual.
  const website = String(incoming.get('website') ?? '');
  if (website === '' && (Object.keys(fieldErrors).length > 0 || filesError)) {
    return fail(400, 'Confirma os campos assinalados.', {
      fieldErrors: { ...fieldErrors, ...(filesError ? { files: filesError } : {}) },
    });
  }
  if (files.length > MAX_FILES) return fail(400, messageForStatus(400));

  const outgoing = new FormData();
  for (const name of ['donorName', 'donorEmail', 'institutionName', 'subjectName', 'classGrade', 'schoolYear',
    'examType', 'notes', 'consent', 'website', 'formStartedAt'] as const) {
    const value = incoming.get(name);
    if (typeof value === 'string') outgoing.append(name, value);
  }
  for (const file of files) outgoing.append('files', file, file.name);

  const headers: Record<string, string> = {};
  const forwarded = forwardedFor(request.headers.get('x-forwarded-for'));
  if (forwarded) headers['X-Forwarded-For'] = forwarded;

  let response: Response;
  try {
    response = await fetch(`${backend}/donations`, {
      method: 'POST',
      body: outgoing,
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    });
  } catch {
    return fail(503, messageForStatus(503));
  }

  if (response.status === 201) {
    const body = (await response.json().catch(() => null)) as { reference?: unknown } | null;
    const reference = typeof body?.reference === 'string' && /^KD-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(body.reference)
      ? body.reference
      : null;
    if (reference) return NextResponse.json({ reference }, { status: 201, headers: NO_STORE });
    return fail(502, messageForStatus(502));
  }

  const retryAfter = response.headers.get('retry-after');
  return fail(
    [400, 411, 413, 415, 429, 503].includes(response.status) ? response.status : 502,
    messageForStatus(response.status, retryAfter),
    {},
    retryAfter && /^\d{1,6}$/.test(retryAfter) ? { 'Retry-After': retryAfter } : {},
  );
}
