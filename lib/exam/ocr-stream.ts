import type { ExamExtraction } from './extraction';
import { createOcrRequestId, isOcrRequestId, type OcrMark } from './ocr-telemetry.ts';

export type OcrStreamEvent =
  | { type: 'prepared'; pageCount: number; timings: Record<string, number> }
  | { type: 'rasterized'; page: number; pageCount: number; timings: Record<string, number> }
  | { type: 'progress'; page: number; pageCount: number; timings: Record<string, number> }
  | { type: 'result'; extraction: ExamExtraction; timings: Record<string, number> }
  | { type: 'error'; message: string };

type SseFrame = { event: string; data: string };

/** Parse only complete SSE frames, retaining a partial frame across network chunks. */
export function takeSseFrames(input: string): { frames: SseFrame[]; rest: string } {
  const normalized = input.replace(/\r\n/g, '\n');
  const frames: SseFrame[] = [];
  let boundary = normalized.indexOf('\n\n');
  let offset = 0;
  while (boundary !== -1) {
    const block = normalized.slice(offset, boundary);
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    if (data.length) frames.push({ event, data: data.join('\n') });
    offset = boundary + 2;
    boundary = normalized.indexOf('\n\n', offset);
  }
  return { frames, rest: normalized.slice(offset) };
}

export function streamExamOcr(
  form: FormData,
  callbacks: {
    onUploadProgress: (loaded: number, total: number) => void;
    onEvent: (event: OcrStreamEvent) => void;
    onMark?: (mark: OcrMark, at: number) => void;
    requestId?: string;
  },
  signal?: AbortSignal,
): Promise<ExamExtraction> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const requestId = callbacks.requestId ?? createOcrRequestId();
    if (!isOcrRequestId(requestId)) {
      reject(new TypeError('OCR request id must be a random UUID v4.'));
      return;
    }
    const markPrefix = `kixi.ocr.${requestId}`;
    const marked = new Set<string>();
    const markTimes = new Map<string, number>();
    const mark = (name: OcrMark) => {
      if (marked.has(name)) return;
      marked.add(name);
      const at = performance.now();
      markTimes.set(name, at);
      performance.mark(`${markPrefix}.${name}`);
      try { callbacks.onMark?.(name, at); } catch { /* instrumentation must not interrupt OCR */ }
      return at;
    };
    let hasFirstServerEvent = false;
    let responseTextOffset = 0;
    let pending = '';
    let extraction: ExamExtraction | null = null;
    let terminalError: Error | null = null;

    const dispatch = (frame: SseFrame) => {
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(frame.data) as Record<string, unknown>;
      } catch {
        throw new Error('O servidor devolveu um evento OCR inválido.');
      }
      if (!hasFirstServerEvent) {
        hasFirstServerEvent = true;
        const firstEventAt = mark('first-server-event');
        const uploadCompleteAt = markTimes.get('upload-complete');
        if (uploadCompleteAt !== undefined && firstEventAt !== undefined && firstEventAt >= uploadCompleteAt) {
          performance.measure(`${markPrefix}.upload-to-first-event`, `${markPrefix}.upload-complete`, `${markPrefix}.first-server-event`);
        }
      }
      if (frame.event === 'prepared') {
        callbacks.onEvent({
          type: 'prepared',
          pageCount: Number(payload.pageCount) || 0,
          timings: (payload.timings as Record<string, number>) ?? {},
        });
      } else if (frame.event === 'rasterized') {
        callbacks.onEvent({
          type: 'rasterized',
          page: Number(payload.page) || 0,
          pageCount: Number(payload.pageCount) || 0,
          timings: (payload.timings as Record<string, number>) ?? {},
        });
      } else if (frame.event === 'progress') {
        callbacks.onEvent({
          type: 'progress',
          page: Number(payload.page) || 0,
          pageCount: Number(payload.pageCount) || 0,
          timings: (payload.timings as Record<string, number>) ?? {},
        });
      } else if (frame.event === 'result') {
        mark('ocr-end');
        if (payload.status === 'error') {
          const message = typeof payload.errorMessage === 'string'
            ? payload.errorMessage
            : 'O OCR não conseguiu ler o ficheiro.';
          callbacks.onEvent({ type: 'error', message });
          terminalError = new Error(message);
          return;
        }
        extraction = payload as unknown as ExamExtraction;
        callbacks.onEvent({ type: 'result', extraction, timings: (payload.timings as Record<string, number>) ?? {} });
      } else if (frame.event === 'error') {
        const message = typeof payload.message === 'string' ? payload.message : 'O OCR falhou durante o processamento.';
        callbacks.onEvent({ type: 'error', message });
        terminalError = new Error(message);
      }
    };

    const consume = (chunk: string) => {
      const parsed = takeSseFrames(pending + chunk);
      pending = parsed.rest;
      parsed.frames.forEach(dispatch);
    };

    xhr.open('POST', '/manager/api/ocr/extract');
    xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.setRequestHeader('X-OCR-Request-ID', requestId);
    xhr.timeout = 180_000;
    xhr.upload.addEventListener('loadstart', () => mark('upload-start'));
    xhr.upload.addEventListener('progress', (event) => callbacks.onUploadProgress(event.loaded, event.total));
    xhr.upload.addEventListener('load', () => {
      mark('upload-complete');
      if (performance.getEntriesByName(`${markPrefix}.upload-start`, 'mark').length) {
        performance.measure(`${markPrefix}.upload`, `${markPrefix}.upload-start`, `${markPrefix}.upload-complete`);
      }
    });
    xhr.addEventListener('progress', () => {
      const next = xhr.responseText.slice(responseTextOffset);
      responseTextOffset = xhr.responseText.length;
      try { consume(next); } catch (error) {
        terminalError = error instanceof Error ? error : new Error('O servidor devolveu um evento OCR inválido.');
        xhr.abort();
      }
    });
    xhr.addEventListener('load', () => {
      const next = xhr.responseText.slice(responseTextOffset);
      try { consume(next); } catch (error) {
        terminalError = error instanceof Error ? error : new Error('O servidor devolveu um evento OCR inválido.');
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        let message = xhr.responseText || `Pedido OCR recusado (${xhr.status}).`;
        try {
          const body = JSON.parse(xhr.responseText) as { detail?: string; message?: string };
          message = body.detail ?? body.message ?? message;
        } catch { /* keep the plain response */ }
        reject(new Error(xhr.status === 401 ? 'Sessão expirada. Inicie sessão novamente.' : message));
      } else if (terminalError) reject(terminalError);
      else if (extraction) resolve(extraction);
      else reject(new Error('A ligação terminou antes de o OCR devolver o resultado.'));
      mark('request-end');
    });
    xhr.addEventListener('error', () => { mark('request-end'); reject(new Error('Não foi possível contactar o servidor OCR.')); });
    xhr.addEventListener('timeout', () => { mark('request-end'); reject(new Error('O processamento OCR excedeu o limite de 180 segundos.')); });
    xhr.addEventListener('abort', () => { mark('request-end'); reject(terminalError ?? new DOMException('Pedido OCR cancelado.', 'AbortError')); });
    const abort = () => xhr.abort();
    mark('request-start');
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });
    xhr.addEventListener('loadend', () => signal?.removeEventListener('abort', abort), { once: true });
    xhr.send(form);
  });
}
