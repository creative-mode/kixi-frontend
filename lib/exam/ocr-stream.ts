import type { ExamExtraction } from './extraction';
import { createOcrRequestId, isOcrRequestId, type OcrMark } from './ocr-telemetry.ts';

export type OcrStreamEvent =
  | { type: 'queued' }
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
    let acceptedJobId: string | null = null;
    let settled = false;
    let firstProgressEvent = false;
    let preparedPageCount = 0;
    let lastRasterized = 0;
    let lastCompleted = 0;
    let delayMs = 800;
    let consecutivePollFailures = 0;

    const finish = (error?: Error, result?: ExamExtraction) => {
      if (settled) return;
      settled = true;
      mark('request-end');
      signal?.removeEventListener('abort', abort);
      if (error) reject(error);
      else if (result) resolve(result);
      else reject(new Error('A ligação terminou antes de o OCR devolver o resultado.'));
    };
    const reportFirstEvent = () => {
      if (firstProgressEvent) return;
      firstProgressEvent = true;
      const firstEventAt = mark('first-server-event');
      const uploadCompleteAt = markTimes.get('upload-complete');
      if (uploadCompleteAt !== undefined && firstEventAt !== undefined && firstEventAt >= uploadCompleteAt) {
        performance.measure(`${markPrefix}.upload-to-first-event`, `${markPrefix}.upload-complete`, `${markPrefix}.first-server-event`);
      }
    };
    const abort = () => {
      xhr.abort();
      cancelAcceptedJob();
      finish(new DOMException('Pedido OCR cancelado.', 'AbortError'));
    };
    const cancelAcceptedJob = () => {
      if (acceptedJobId) {
        const jobId = acceptedJobId;
        acceptedJobId = null;
        void fetch(`/manager/api/ocr/jobs/${jobId}`, {
          method: 'DELETE', credentials: 'include', keepalive: true,
        }).catch(() => undefined);
      }
    };
    const failFromResponse = async (response: Response) => {
      let message = `Pedido OCR recusado (${response.status}).`;
      try {
        const body = await response.json() as { detail?: string; message?: string };
        message = body.detail ?? body.message ?? message;
      } catch { /* keep status-based message */ }
      cancelAcceptedJob();
      finish(new Error(response.status === 401 ? 'Sessão expirada. Inicie sessão novamente.' : message));
    };
    const poll = async (jobId: string): Promise<void> => {
      callbacks.onEvent({ type: 'queued' });
      while (!settled) {
        if (signal?.aborted) return abort();
        let response: Response;
        try {
          response = await fetch(`/manager/api/ocr/jobs/${jobId}`, {
            credentials: 'include', cache: 'no-store', signal,
          });
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') throw error;
          consecutivePollFailures += 1;
          if (consecutivePollFailures > 5) throw new Error('A ligação ao estado OCR foi interrompida.');
          await new Promise((resolveDelay) => globalThis.setTimeout(resolveDelay, Math.min(5_000, 500 * 2 ** consecutivePollFailures)));
          continue;
        }
        if (response.status >= 500) {
          consecutivePollFailures += 1;
          if (consecutivePollFailures > 5) return failFromResponse(response);
          await new Promise((resolveDelay) => globalThis.setTimeout(resolveDelay, Math.min(5_000, 500 * 2 ** consecutivePollFailures)));
          continue;
        }
        if (!response.ok) return failFromResponse(response);
        consecutivePollFailures = 0;
        const job = await response.json() as {
          status?: string; pageCount?: number; completedPages?: number; currentPage?: number;
          eventType?: string; result?: ExamExtraction; error?: string;
        };
        const pageCount = Math.max(0, Number(job.pageCount) || 0);
        const currentPage = Math.max(0, Number(job.currentPage) || 0);
        const completedPages = Math.max(0, Number(job.completedPages) || 0);
        const timings = job.result?.timings as Record<string, number> | undefined;

        if (pageCount > 0 && preparedPageCount === 0) {
          preparedPageCount = pageCount;
          reportFirstEvent();
          callbacks.onEvent({ type: 'prepared', pageCount, timings: {} });
        }
        if (job.eventType === 'rasterized' && currentPage > lastRasterized) {
          lastRasterized = currentPage;
          reportFirstEvent();
          callbacks.onEvent({ type: 'rasterized', page: currentPage, pageCount, timings: {} });
        }
        if (completedPages > lastCompleted) {
          lastCompleted = completedPages;
          reportFirstEvent();
          callbacks.onEvent({ type: 'progress', page: completedPages, pageCount, timings: {} });
        }

        if (job.status === 'SUCCEEDED' && job.result) {
          reportFirstEvent();
          mark('ocr-end');
          callbacks.onEvent({ type: 'result', extraction: job.result, timings: timings ?? {} });
          acceptedJobId = null;
          return finish(undefined, job.result);
        }
        if (job.status === 'FAILED' || job.status === 'CANCELLED') {
          const error = job.error || (job.status === 'CANCELLED'
            ? 'Importação OCR cancelada.' : 'O OCR falhou durante o processamento.');
          callbacks.onEvent({ type: 'error', message: error });
          acceptedJobId = null;
          return finish(new Error(error));
        }
        delayMs = Math.min(3_000, Math.round(delayMs * 1.25));
        await new Promise((resolveDelay) => globalThis.setTimeout(resolveDelay, delayMs));
      }
    };

    xhr.open('POST', '/manager/api/ocr/extract');
    xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
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
    xhr.addEventListener('load', () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        let message = xhr.responseText || `Pedido OCR recusado (${xhr.status}).`;
        try { message = (JSON.parse(xhr.responseText) as { detail?: string }).detail ?? message; } catch { /* keep response */ }
        return finish(new Error(xhr.status === 401 ? 'Sessão expirada. Inicie sessão novamente.' : message));
      }
      let accepted: { jobId?: unknown };
      try { accepted = JSON.parse(xhr.responseText) as { jobId?: unknown }; }
      catch { return finish(new Error('O servidor devolveu uma confirmação OCR inválida.')); }
      if (typeof accepted.jobId !== 'string' || !/^[0-9a-f-]{36}$/i.test(accepted.jobId)) {
        return finish(new Error('O servidor não confirmou a fila OCR.'));
      }
      acceptedJobId = accepted.jobId;
      void poll(accepted.jobId).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') abort();
        else {
          cancelAcceptedJob();
          finish(error instanceof Error ? error : new Error('Não foi possível consultar o estado OCR.'));
        }
      });
    });
    xhr.addEventListener('error', () => finish(new Error('Não foi possível contactar o servidor OCR.')));
    xhr.addEventListener('timeout', () => finish(new Error('O envio dos ficheiros excedeu o limite de 180 segundos.')));
    xhr.addEventListener('abort', () => { if (!settled) finish(new DOMException('Pedido OCR cancelado.', 'AbortError')); });
    mark('request-start');
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });
    xhr.addEventListener('loadend', () => signal?.removeEventListener('abort', abort), { once: true });
    xhr.send(form);
  });
}
