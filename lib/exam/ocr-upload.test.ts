import assert from 'node:assert/strict';
import test from 'node:test';
import { OCR_MAX_REQUEST_BODY_BYTES, readBoundedRequestBody } from './ocr-upload.ts';

function requestWithChunks(chunks: Uint8Array[], headers?: HeadersInit): Request {
  const init: RequestInit & { duplex: 'half' } = {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data; boundary=test', ...headers },
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    duplex: 'half',
  };
  return new Request('http://localhost/manager/api/ocr/extract', init);
}

test('rejects a declared multipart body before parsing it', async () => {
  const request = requestWithChunks([new Uint8Array([1])], {
    'Content-Length': String(OCR_MAX_REQUEST_BODY_BYTES + 1),
  });
  assert.deepEqual(await readBoundedRequestBody(request), { ok: false, tooLarge: true });
});

test('bounds chunked uploads without Content-Length', async () => {
  const request = requestWithChunks([
    new Uint8Array([1, 2, 3, 4]),
    new Uint8Array([1]),
  ]);
  assert.deepEqual(await readBoundedRequestBody(request, 4), { ok: false, tooLarge: true });
});

test('returns the exact bounded bytes for an accepted upload', async () => {
  const request = requestWithChunks([new Uint8Array([1, 2]), new Uint8Array([3, 4])]);
  const result = await readBoundedRequestBody(request, 4);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual([...new Uint8Array(result.bytes)], [1, 2, 3, 4]);
});
