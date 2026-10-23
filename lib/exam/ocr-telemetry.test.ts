import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOcrTelemetryPayload,
  createOcrRequestId,
  decodeOcrImages,
  evaluateOcrEditorRender,
  OCR_TELEMETRY_URL,
  parseOcrTelemetryPayload,
  reportOcrTelemetry,
  type OcrTelemetryInput,
} from './ocr-telemetry.ts';

const REQUEST_ID = 'ad8f8b31-35a0-4f76-ae46-692ec432601e';

test('computes browser end-to-end intervals and keeps server OCR/parse durations separate', () => {
  const input: OcrTelemetryInput = {
    requestId: REQUEST_ID,
    marks: {
      'request-start': 100,
      'upload-start': 110,
      'upload-complete': 160,
      'first-server-event': 180,
      'ocr-end': 460,
      'first-useful-render': 500,
      'editor-ready': 550,
      'image-decode-start': 560,
      'image-decode-end': 580,
      'request-end': 590,
    },
    serverTimings: { uploadMs: 7, ocrMs: 240, parsingMs: 40, rasterizationMs: 12, totalMs: 290 },
    counts: {
      pageCount: 4,
      fileCount: 1,
      questionCount: 20,
      imageCount: 2,
      imageDecodeSuccessCount: 1,
      imageDecodeFailureCount: 1,
    },
  };

  assert.deepEqual(buildOcrTelemetryPayload(input), {
    requestId: REQUEST_ID,
    timings: {
      clientUploadMs: 50,
      clientRequestMs: 490,
      requestToFirstServerEventMs: 80,
      uploadToOcrEndMs: 300,
      requestToOcrEndMs: 360,
      ocrEndToFirstUsefulRenderMs: 40,
      ocrEndToEditorReadyMs: 90,
      requestToFirstUsefulRenderMs: 400,
      requestToEditorReadyMs: 450,
      imageDecodeMs: 20,
      serverUploadMs: 7,
      serverRasterizationMs: 12,
      serverOcrMs: 240,
      serverParseMs: 40,
      serverTotalMs: 290,
    },
    counts: {
      pageCount: 4,
      fileCount: 1,
      questionCount: 20,
      imageCount: 2,
      imageDecodeSuccessCount: 1,
      imageDecodeFailureCount: 1,
      requestFailureCount: 0,
      cancelledRequestCount: 0,
      renderTimeoutCount: 0,
    },
  });
});

test('does not invent durations for missing or backwards marks', () => {
  const payload = buildOcrTelemetryPayload({
    requestId: REQUEST_ID,
    marks: { 'request-start': 200, 'ocr-end': 100 },
    serverTimings: { ocrMs: Number.NaN, parsingMs: -1 },
  });
  assert.deepEqual(payload.timings, {});
});

test('editor readiness waits for all imported questions and detects a previously identical draft', () => {
  assert.deepEqual(evaluateOcrEditorRender(['Q1', 'Q2'], ['Q1', ''], ['', '']), {
    firstUsefulIndex: 0,
    editorReady: false,
    alreadyReady: false,
  });
  assert.deepEqual(evaluateOcrEditorRender(['Q1', 'Q2'], ['Q1', 'Q2'], ['old', 'old']), {
    firstUsefulIndex: 0,
    editorReady: true,
    alreadyReady: false,
  });
  assert.deepEqual(evaluateOcrEditorRender(['Q1', 'Q2'], ['Q1', 'Q2'], ['Q1', 'Q2']), {
    firstUsefulIndex: null,
    editorReady: true,
    alreadyReady: true,
  });
  assert.deepEqual(evaluateOcrEditorRender([], [], []), {
    firstUsefulIndex: null,
    editorReady: false,
    alreadyReady: false,
  });
});

test('rendered KaTeX text counts as ready even though it differs from the LaTeX source', () => {
  assert.deepEqual(evaluateOcrEditorRender(['$v=v_0+at$', 'Questão 2'], ['𝑣 = 𝑣₀ + 𝑎𝑡', 'Questão 2'], ['', '']), {
    firstUsefulIndex: 0,
    editorReady: true,
    alreadyReady: false,
  });
});

test('image decode reports fulfilled, rejected and synchronous decode failures separately', async () => {
  const result = await decodeOcrImages([
    { decode: async () => undefined },
    { decode: async () => { throw new Error('decode rejected'); } },
    { decode: () => { throw new Error('decode threw'); } },
  ]);
  assert.deepEqual(result, { successCount: 1, failureCount: 2 });
});

test('image decode timeout is counted as a failure so reporting cannot hang indefinitely', async () => {
  const result = await decodeOcrImages([{ decode: () => new Promise<void>(() => undefined) }], 2);
  assert.deepEqual(result, { successCount: 0, failureCount: 1 });
});

test('image decode limits concurrent work to protect the browser on large imports', async () => {
  let active = 0;
  let maximum = 0;
  const images = Array.from({ length: 12 }, () => ({
    decode: async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
    },
  }));
  const result = await decodeOcrImages(images);
  assert.deepEqual(result, { successCount: 12, failureCount: 0 });
  assert.ok(maximum <= 4, `expected at most four decodes, got ${maximum}`);
});

test('payload validation rejects personal/file data and unknown telemetry fields', () => {
  const valid = buildOcrTelemetryPayload({ requestId: REQUEST_ID, marks: {}, counts: { fileCount: 1 } });
  assert.deepEqual(parseOcrTelemetryPayload(valid), valid);
  assert.equal(parseOcrTelemetryPayload({ ...valid, fileName: 'exam.pdf' }), null);
  assert.equal(parseOcrTelemetryPayload({ ...valid, rawText: 'question text' }), null);
  assert.equal(parseOcrTelemetryPayload({ ...valid, timings: { clientUploadMs: 2, email: 'x@example.test' } }), null);
  assert.equal(parseOcrTelemetryPayload({ ...valid, requestId: 'not-pseudonymous' }), null);
});

test('request ids are random UUID v4 values and reporting sends only the validated payload', async () => {
  assert.equal(createOcrRequestId(() => REQUEST_ID), REQUEST_ID);
  assert.throws(() => createOcrRequestId(() => 'exam.pdf'));

  const payload = buildOcrTelemetryPayload({ requestId: REQUEST_ID, marks: {}, counts: { pageCount: 2 } });
  let request: RequestInfo | URL | undefined;
  let init: RequestInit | undefined;
  await reportOcrTelemetry(payload, async (input, options) => {
    request = input;
    init = options;
    return new Response(null, { status: 204 });
  });
  assert.equal(request, OCR_TELEMETRY_URL);
  assert.equal(init?.method, 'POST');
  assert.equal(init?.credentials, 'same-origin');
  assert.equal(init?.keepalive, true);
  assert.deepEqual(JSON.parse(String(init?.body)), payload);
});
