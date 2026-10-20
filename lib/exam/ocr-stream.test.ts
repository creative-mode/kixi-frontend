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
  static finalPayload: Record<string, unknown> = { title: 'Prova', timings: { totalMs: 10 } };
  static last: FakeXhr | undefined;
  constructor() { super(); FakeXhr.last = this; }
  open(_method: string, url: string) { this.url = url; }
  setRequestHeader(name: string, value: string) { this.headers[name] = value; }
  send() {
    this.upload.emit('loadstart');
    this.upload.emit('progress', { loaded: 16, total: 32 });
    this.upload.emit('load');
    if (FakeXhr.responseOnSend) {
      this.responseText = [
        'event: prepared\ndata: {"pageCount":2,"timings":{"uploadMs":7}}\n\n',
        'event: rasterized\ndata: {"page":1,"pageCount":2,"timings":{"rasterizationMs":8}}\n\n',
        'event: progress\ndata: {"page":1,"pageCount":2,"timings":{"ocrMs":3}}\n\n',
        `event: result\ndata: ${JSON.stringify(FakeXhr.finalPayload)}\n\n`,
      ].join('');
      this.emit('progress');
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
  globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  FakeXhr.responseOnSend = true;
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
    assert.deepEqual(events.map((event) => event.type), ['prepared', 'rasterized', 'progress', 'result']);
    assert.equal((events[1] as Extract<OcrStreamEvent, { type: 'rasterized' }>).page, 1);
    assert.equal(FakeXhr.last?.url, '/manager/api/ocr/extract');
    assert.equal(FakeXhr.last?.withCredentials, true);
    assert.equal(FakeXhr.last?.headers.Accept, 'text/event-stream');
    assert.equal(FakeXhr.last?.headers['X-OCR-Request-ID'], requestId);
    assert.deepEqual(marks, ['request-start', 'upload-start', 'upload-complete', 'first-server-event', 'ocr-end', 'request-end']);
  } finally {
    FakeXhr.finalPayload = { title: 'Prova', timings: { totalMs: 10 } };
    globalThis.XMLHttpRequest = original;
  }
});

test('a terminal OCR error keeps the backend message and rejects the extraction', async () => {
  const original = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  FakeXhr.responseOnSend = true;
  FakeXhr.finalPayload = { status: 'error', errorMessage: 'PDF ilegível' };
  const events: OcrStreamEvent[] = [];
  try {
    await assert.rejects(streamExamOcr(new FormData(), {
      onUploadProgress: () => undefined,
      onEvent: (event) => events.push(event),
    }), /PDF ilegível/);
    assert.deepEqual(events, [
      { type: 'prepared', pageCount: 2, timings: { uploadMs: 7 } },
      { type: 'rasterized', page: 1, pageCount: 2, timings: { rasterizationMs: 8 } },
      { type: 'progress', page: 1, pageCount: 2, timings: { ocrMs: 3 } },
      { type: 'error', message: 'PDF ilegível' },
    ]);
  } finally {
    FakeXhr.finalPayload = { title: 'Prova', timings: { totalMs: 10 } };
    globalThis.XMLHttpRequest = original;
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

test('an internal event callback error is not swallowed as user cancellation', async () => {
  const original = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  FakeXhr.responseOnSend = true;
  try {
    await assert.rejects(streamExamOcr(new FormData(), {
      onUploadProgress: () => undefined,
      onEvent: () => { throw new Error('Medição inválida'); },
    }), /Medição inválida/);
  } finally {
    globalThis.XMLHttpRequest = original;
  }
});
