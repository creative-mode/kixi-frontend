import { OCR_MAX_TOTAL_BYTES } from '../crud/ocr-files.ts';

/**
 * Multipart has a small envelope (boundaries, names and headers) in addition
 * to the files themselves. Keep a hard cap for the complete request so a
 * chunked upload cannot make `request.formData()` buffer an unbounded body.
 */
export const OCR_MAX_REQUEST_BODY_BYTES = OCR_MAX_TOTAL_BYTES + 1024 * 1024;

export type BoundedRequestBody =
  | { ok: true; bytes: ArrayBuffer }
  | { ok: false; tooLarge: boolean };

/** Read at most `maxBytes`, including requests without Content-Length. */
export async function readBoundedRequestBody(
  request: Request,
  maxBytes = OCR_MAX_REQUEST_BODY_BYTES,
): Promise<BoundedRequestBody> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) return { ok: false, tooLarge: false };
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length)) return { ok: false, tooLarge: true };
    if (length > maxBytes) return { ok: false, tooLarge: true };
  }

  if (!request.body) return { ok: false, tooLarge: false };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch { /* the size violation is already decisive */ }
        return { ok: false, tooLarge: true };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, tooLarge: false };
  }

  const bytes = new ArrayBuffer(total);
  const output = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}
