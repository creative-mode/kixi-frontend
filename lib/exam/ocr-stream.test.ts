import assert from 'node:assert/strict';
import test from 'node:test';
import { streamExamOcr, takeSseFrames, type OcrStreamEvent } from './ocr-stream.ts';

class FakeTarget {
  private listeners = new Map<string, ((event: unknown) => void)[]>();
  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  emit(type: string, event: unknown = {}) {
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }
}

class FakeXhr extends FakeTarget {
  upload = new FakeTarget();
  responseText = '';
  status = 200;
  timeout = 0;
  withCredentials = false;
  url = '';
  headers: Record<string, string> = {};
  static responseOnSend = true;
  static finalPayload: Record<string, unknown> = { jobId: '5dbfe179-e74d-4aa6-a603-8b1e6a264cea' };
  static last: FakeXhr | undefined;
  constructor() { super(); FakeXhr.last = this; }
  open(_method: string, url: string) { this.url = url; }
  setRequestHeader(name: string, value: string) { this.headers[name] = value; }
  send() {
    this.upload.emit('loadstart');
    this.upload.emit('progress', { loaded: 16, total: 32 });
    this.upload.emit('load');
    if (FakeXhr.responseOnSend) {
      this.responseText = JSON.stringify(FakeXhr.finalPayload);
      this.emit('load');
    }
  }
  abort() { this.emit('abort'); }
}

test('SSE parser buffers an event split across transport chunks', () => {
  const first = takeSseFrames('event: progress\ndata: {"page":1,');
  assert.deepEqual(first.frames, []);
  assert.equal(first.rest, 'event: progress\ndata: {"page":1,');

  const second = takeSseFrames(`${first.rest}"pageCount":2}\r\n\r\n`);
  assert.deepEqual(second.frames, [{ event: 'progress', data: '{"page":1,"pageCount":2}' }]);
  assert.equal(second.rest, '');
});

test('SSE parser supports multiline data and leaves an incomplete following frame buffered', () => {
  const parsed = takeSseFrames('event: result\ndata: {"timings":\ndata: {"ocrMs":4}}\n\nevent: progress\ndata: {"page":');

  assert.deepEqual(parsed.frames, [{ event: 'result', data: '{"timings":\n{"ocrMs":4}}' }]);
  assert.equal(parsed.rest, 'event: progress\ndata: {"page":');
});

test('browser bridge reports real upload and page events, then resolves the final extraction', async () => {
  const original = globalThis.XMLHttpRequest;
  const originalFetch = globalThis.fetch;
  globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  FakeXhr.responseOnSend = true;
  FakeXhr.finalPayload = { jobId: '5dbfe179-e74d-4aa6-a603-8b1e6a264cea' };
  let poll = 0;
  globalThis.fetch = (async () => {
    poll += 1;
    const states = [
      { status: 'PROCESSING', pageCount: 2, completedPages: 0, currentPage: 1, eventType: 'rasterized' },
      { status: 'PROCESSING', pageCount: 2, completedPages: 1, currentPage: 1, eventType: 'progress' },
      { status: 'SUCCEEDED', pageCount: 2, completedPages: 2, currentPage: 2, eventType: 'result',
        result: { title: 'Prova', timings: { totalMs: 10 } } },
    ];
    return Response.json(states[Math.min(poll - 1, states.length - 1)]);
  }) as typeof fetch;
  const upload: number[] = [];
  const events: OcrStreamEvent[] = [];
  const marks: string[] = [];
  const requestId = 'ad8f8b31-35a0-4f76-ae46-692ec432601e';
  try {
    const result = await streamExamOcr(new FormData(), {
      requestId,
      onUploadProgress: (loaded, total) => upload.push(Math.round((loaded / total) * 100)),
      onEvent: (event) => events.push(event),
      onMark: (mark) => marks.push(mark),
    });
    assert.equal(result.title, 'Prova');
    assert.equal(result.timings?.totalMs, 10);
    assert.deepEqual(upload, [50]);
    assert.deepEqual(events.map((event) => event.type), ['queued', 'prepared', 'rasterized', 'progress', 'progress', 'result']);
    assert.equal((events[2] as Extract<OcrStreamEvent, { type: 'rasterized' }>).page, 1);
    assert.equal(FakeXhr.last?.url, '/manager/api/ocr/extract');
    assert.equal(FakeXhr.last?.withCredentials, true);
    assert.equal(FakeXhr.last?.headers.Accept, 'application/json');
    assert.equal(FakeXhr.last?.headers['X-OCR-Request-ID'], requestId);
    assert.deepEqual(marks, ['request-start', 'upload-start', 'upload-complete', 'first-server-event', 'ocr-end', 'request-end']);
  } finally {
    FakeXhr.finalPayload = { jobId: '5dbfe179-e74d-4aa6-a603-8b1e6a264cea' };
    globalThis.XMLHttpRequest = original;
    globalThis.fetch = originalFetch;
  }
});

test('a terminal OCR error keeps the backend message and rejects the extraction', async () => {
  const original = globalThis.XMLHttpRequest;
  const originalFetch = globalThis.fetch;
  globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  FakeXhr.responseOnSend = true;
  FakeXhr.finalPayload = { jobId: '5dbfe179-e74d-4aa6-a603-8b1e6a264cea' };
  globalThis.fetch = (async () => Response.json({ status: 'FAILED', pageCount: 0, error: 'PDF ilegível' })) as typeof fetch;
  const events: OcrStreamEvent[] = [];
  try {
    await assert.rejects(streamExamOcr(new FormData(), {
      onUploadProgress: () => undefined,
      onEvent: (event) => events.push(event),
    }), /PDF ilegível/);
    assert.deepEqual(events, [
      { type: 'queued' },
      { type: 'error', message: 'PDF ilegível' },
    ]);
  } finally {
    FakeXhr.finalPayload = { jobId: '5dbfe179-e74d-4aa6-a603-8b1e6a264cea' };
    globalThis.XMLHttpRequest = original;
    globalThis.fetch = originalFetch;
  }
});

test('polling retries a transient server failure without abandoning the job', async () => {
  const original = globalThis.XMLHttpRequest;
  const originalFetch = globalThis.fetch;
  globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  FakeXhr.responseOnSend = true;
  FakeXhr.finalPayload = { jobId: '5dbfe179-e74d-4aa6-a603-8b1e6a264cea' };
  let polls = 0;
  const methods: string[] = [];
  globalThis.fetch = (async (_input, init) => {
    methods.push(init?.method ?? 'GET');
    polls += 1;
    if (polls === 1) return Response.json({ detail: 'temporariamente indisponível' }, { status: 503 });
    return Response.json({
      status: 'SUCCEEDED', pageCount: 1, completedPages: 1, currentPage: 1,
      eventType: 'result', result: { title: 'Prova recuperada' },
    });
  }) as typeof fetch;
  try {
    const result = await streamExamOcr(new FormData(), {
      onUploadProgress: () => undefined,
      onEvent: () => undefined,
    });
    assert.equal(result.title, 'Prova recuperada');
    assert.equal(polls, 2);
    assert.deepEqual(methods, ['GET', 'GET']);
  } finally {
    globalThis.XMLHttpRequest = original;
    globalThis.fetch = originalFetch;
  }
});

test('browser bridge aborts the request when its signal is cancelled', async () => {
  const original = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  FakeXhr.responseOnSend = false;
  const controller = new AbortController();
  try {
    const pending = streamExamOcr(new FormData(), {
      onUploadProgress: () => undefined,
      onEvent: () => undefined,
    }, controller.signal);
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
  } finally {
    FakeXhr.responseOnSend = true;
    globalThis.XMLHttpRequest = original;
  }
});

test('cancelling after acceptance asks the server to cancel the durable job', async () => {
  const original = globalThis.XMLHttpRequest;
  const originalFetch = globalThis.fetch;
  globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  FakeXhr.responseOnSend = true;
  FakeXhr.finalPayload = { jobId: '5dbfe179-e74d-4aa6-a603-8b1e6a264cea' };
  const controller = new AbortController();
  let signalFetchStarted!: () => void;
  const fetchStarted = new Promise<void>((resolve) => { signalFetchStarted = resolve; });
  const methods: string[] = [];
  globalThis.fetch = (async (input, init) => {
    const method = init?.method ?? 'GET';
    methods.push(`${method} ${String(input)}`);
    if (method === 'DELETE') return new Response(null, { status: 204 });
    signalFetchStarted();
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    });
  }) as typeof fetch;
  try {
    const pending = streamExamOcr(new FormData(), {
      onUploadProgress: () => undefined,
      onEvent: () => undefined,
    }, controller.signal);
    await fetchStarted;
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
    assert.deepEqual(methods, [
      'GET /manager/api/ocr/jobs/5dbfe179-e74d-4aa6-a603-8b1e6a264cea',
      'DELETE /manager/api/ocr/jobs/5dbfe179-e74d-4aa6-a603-8b1e6a264cea',
    ]);
  } finally {
    FakeXhr.responseOnSend = true;
    globalThis.XMLHttpRequest = original;
    globalThis.fetch = originalFetch;
  }
});

test('an internal event callback error is not swallowed as user cancellation', async () => {
  const original = globalThis.XMLHttpRequest;
  const originalFetch = globalThis.fetch;
  globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  FakeXhr.responseOnSend = true;
  FakeXhr.finalPayload = { jobId: '5dbfe179-e74d-4aa6-a603-8b1e6a264cea' };
  globalThis.fetch = (async () => Response.json({
    status: 'PROCESSING', pageCount: 1, currentPage: 1, completedPages: 0, eventType: 'rasterized',
  })) as typeof fetch;
  try {
    await assert.rejects(streamExamOcr(new FormData(), {
      onUploadProgress: () => undefined,
      onEvent: () => { throw new Error('Medição inválida'); },
    }), /Medição inválida/);
  } finally {
    globalThis.XMLHttpRequest = original;
    globalThis.fetch = originalFetch;
  }
});
