export const OCR_TELEMETRY_URL = '/manager/api/ocr/metrics';

export const OCR_MARKS = [
  'request-start',
  'upload-start',
  'upload-complete',
  'first-server-event',
  'ocr-end',
  'first-useful-render',
  'editor-ready',
  'image-decode-start',
  'image-decode-end',
  'request-end',
] as const;

export type OcrMark = typeof OCR_MARKS[number];

export const OCR_TIMING_KEYS = [
  'clientUploadMs',
  'clientRequestMs',
  'requestToFirstServerEventMs',
  'uploadToOcrEndMs',
  'requestToOcrEndMs',
  'ocrEndToFirstUsefulRenderMs',
  'ocrEndToEditorReadyMs',
  'requestToFirstUsefulRenderMs',
  'requestToEditorReadyMs',
  'imageDecodeMs',
  'serverUploadMs',
  'serverPreparationMs',
  'serverRasterizationMs',
  'serverOcrMs',
  'serverParseMs',
  'serverTotalMs',
] as const;

export type OcrTimingKey = typeof OCR_TIMING_KEYS[number];

export const OCR_COUNT_KEYS = [
  'pageCount',
  'fileCount',
  'questionCount',
  'imageCount',
  'imageDecodeSuccessCount',
  'imageDecodeFailureCount',
  'requestFailureCount',
  'cancelledRequestCount',
  'renderTimeoutCount',
] as const;

export type OcrCountKey = typeof OCR_COUNT_KEYS[number];

export type OcrTelemetryPayload = {
  requestId: string;
  timings: Partial<Record<OcrTimingKey, number>>;
  counts: Record<OcrCountKey, number>;
};

export type OcrTelemetryInput = {
  requestId: string;
  marks: Partial<Record<OcrMark, number>>;
  serverTimings?: Record<string, number>;
  counts?: Partial<Record<OcrCountKey, number>>;
};

const UUID = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
const MAX_DURATION_MS = 3_600_000;
const MAX_COUNT = 10_000;

export function createOcrRequestId(randomUUID: () => string = () => crypto.randomUUID()): string {
  const id = randomUUID();
  if (!UUID.test(id)) throw new TypeError('OCR request id must be a random UUID v4.');
  return id.toLowerCase();
}

export function isOcrRequestId(value: string): boolean {
  return UUID.test(value);
}

function duration(start: number | undefined, end: number | undefined): number | undefined {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end! < start!) return undefined;
  return Math.round((end! - start!) * 100) / 100;
}

function validNumber(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
}

export function buildOcrTelemetryPayload(input: OcrTelemetryInput): OcrTelemetryPayload {
  if (!UUID.test(input.requestId)) throw new TypeError('Invalid OCR request id.');
  const { marks, serverTimings = {} } = input;
  const start = marks['request-start'];
  const uploaded = marks['upload-complete'];
  const ocrEnd = marks['ocr-end'];
  const firstRender = marks['first-useful-render'];
  const editorReady = marks['editor-ready'];
  const imageDecode = duration(marks['image-decode-start'], marks['image-decode-end']);

  const timings: Partial<Record<OcrTimingKey, number>> = {};
  const put = (key: OcrTimingKey, value: number | undefined) => {
    if (value !== undefined && validNumber(value, MAX_DURATION_MS)) timings[key] = value;
  };
  put('clientUploadMs', duration(marks['upload-start'], uploaded));
  put('clientRequestMs', duration(start, marks['request-end']));
  put('requestToFirstServerEventMs', duration(start, marks['first-server-event']));
  put('uploadToOcrEndMs', duration(uploaded, ocrEnd));
  put('requestToOcrEndMs', duration(start, ocrEnd));
  put('ocrEndToFirstUsefulRenderMs', duration(ocrEnd, firstRender));
  put('ocrEndToEditorReadyMs', duration(ocrEnd, editorReady));
  put('requestToFirstUsefulRenderMs', duration(start, firstRender));
  put('requestToEditorReadyMs', duration(start, editorReady));
  put('imageDecodeMs', imageDecode);

  const serverKeys: Record<string, OcrTimingKey> = {
    uploadMs: 'serverUploadMs',
    preparationMs: 'serverPreparationMs',
    rasterizationMs: 'serverRasterizationMs',
    ocrMs: 'serverOcrMs',
    parsingMs: 'serverParseMs',
    totalMs: 'serverTotalMs',
  };
  for (const [name, key] of Object.entries(serverKeys)) {
    const value = serverTimings[name];
    if (validNumber(value, MAX_DURATION_MS)) put(key, value);
  }

  const counts = {} as Record<OcrCountKey, number>;
  for (const key of OCR_COUNT_KEYS) {
    const value = input.counts?.[key] ?? 0;
    if (!Number.isInteger(value) || value < 0 || value > MAX_COUNT) throw new TypeError(`Invalid OCR telemetry count: ${key}.`);
    counts[key] = value;
  }

  return { requestId: input.requestId.toLowerCase(), timings, counts };
}

export function evaluateOcrEditorRender(
  expected: readonly string[],
  current: readonly string[],
  previous: readonly string[],
): { firstUsefulIndex: number | null; editorReady: boolean; alreadyReady: boolean } {
  if (expected.length === 0) return { firstUsefulIndex: null, editorReady: false, alreadyReady: false };
  const matches = expected.map((value, index) => current[index] === value);
  const newlyVisible = matches.findIndex((matched, index) => matched && previous[index] !== current[index]);
  const editorReady = matches.every(Boolean);
  const alreadyReady = editorReady && expected.every((value, index) => previous[index] === value);
  return {
    firstUsefulIndex: newlyVisible === -1 ? null : newlyVisible,
    editorReady,
    alreadyReady,
  };
}

/** Strict allowlist shared by the reporting route and its tests. Unknown fields are rejected. */
export function parseOcrTelemetryPayload(value: unknown): OcrTelemetryPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !['requestId', 'timings', 'counts'].includes(key))) return null;
  if (typeof input.requestId !== 'string' || !UUID.test(input.requestId)) return null;
  if (!input.timings || typeof input.timings !== 'object' || Array.isArray(input.timings)) return null;
  if (!input.counts || typeof input.counts !== 'object' || Array.isArray(input.counts)) return null;

  const rawTimings = input.timings as Record<string, unknown>;
  const rawCounts = input.counts as Record<string, unknown>;
  if (Object.keys(rawTimings).some((key) => !(OCR_TIMING_KEYS as readonly string[]).includes(key))) return null;
  if (Object.keys(rawCounts).some((key) => !(OCR_COUNT_KEYS as readonly string[]).includes(key))) return null;
  if (Object.values(rawTimings).some((item) => !validNumber(item, MAX_DURATION_MS))) return null;
  if (OCR_COUNT_KEYS.some((key) => !Number.isInteger(rawCounts[key]) || !validNumber(rawCounts[key], MAX_COUNT))) return null;

  return {
    requestId: input.requestId.toLowerCase(),
    timings: rawTimings as OcrTelemetryPayload['timings'],
    counts: rawCounts as OcrTelemetryPayload['counts'],
  };
}

/** Reporting is best-effort and never blocks or changes the OCR/editor interaction. */
export async function reportOcrTelemetry(
  payload: OcrTelemetryPayload,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const safePayload = parseOcrTelemetryPayload(payload);
  if (!safePayload) return;
  try {
    const response = await fetcher(OCR_TELEMETRY_URL, {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      signal: AbortSignal.timeout(5_000),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(safePayload),
    });
    if (!response.ok) console.warn('OCR performance report was rejected.', response.status);
  } catch {
    console.warn('OCR performance report could not reach the same-origin endpoint.');
  }
}

export async function decodeOcrImages(
  images: readonly { decode: () => Promise<void> }[],
  timeoutMs = 10_000,
): Promise<{ successCount: number; failureCount: number }> {
  const results = await Promise.all(images.map(async (image) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const decoded = await Promise.race([
        Promise.resolve().then(() => image.decode()).then(() => true, () => false),
        new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs); }),
      ]);
      return decoded;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }));
  return {
    successCount: results.filter(Boolean).length,
    failureCount: results.filter((result) => !result).length,
  };
}
