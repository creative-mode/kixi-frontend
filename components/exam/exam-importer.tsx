'use client';

import { useRef, useState } from 'react';
import { FileImage, FileText, ScanText, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { addOcrFiles, OCR_ACCEPT, ocrFilesProblem } from '@/lib/crud/ocr-files';
import { streamExamOcr, type OcrStreamEvent } from '@/lib/exam/ocr-stream';
import { draftFromExtraction, type ExamExtraction } from '@/lib/exam/extraction';
import {
  buildOcrTelemetryPayload,
  createOcrRequestId,
  decodeOcrImages,
  evaluateOcrEditorRender,
  reportOcrTelemetry,
  type OcrCountKey,
  type OcrMark,
} from '@/lib/exam/ocr-telemetry';
import { serializeMathText } from '@/student/lib/shared/math-types';

const size = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

/**
 * Fotografias ou PDF de uma prova: o OCR lê-as e o construtor fica preenchido para o professor rever.
 *
 * Nada é guardado aqui. `onExtracted` recebe o que o motor leu e quem chama decide o que fazer com isso
 * (o construtor transforma-o em rascunho e avisa do que ficou por decidir).
 */
export function ExamImporter({ onExtracted, onClose }: { onExtracted: (extraction: ExamExtraction, names: string) => boolean | void; onClose: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [pageProgress, setPageProgress] = useState<{ page: number; pageCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  function recordRenderTimings(
    requestId: string,
    marks: Partial<Record<OcrMark, number>>,
    serverTimings: Record<string, number>,
    counts: Record<OcrCountKey, number>,
  ) {
    const prefix = `kixi.ocr.${requestId}`;
    let reported = false;
    const markUi = (name: Extract<OcrMark, 'first-useful-render' | 'editor-ready' | 'image-decode-start' | 'image-decode-end'>, at = performance.now()) => {
      if (marks[name] !== undefined) return;
      marks[name] = at;
      performance.mark(`${prefix}.${name}`);
    };
    const measure = (name: string, start: OcrMark, end: OcrMark) => {
      if (marks[start] !== undefined && marks[end] !== undefined) {
        performance.measure(`${prefix}.${name}`, `${prefix}.${start}`, `${prefix}.${end}`);
      }
    };
    const cleanup = () => {
      performance.getEntriesByType('mark').filter((entry) => entry.name.startsWith(`${prefix}.`)).forEach((entry) => performance.clearMarks(entry.name));
      performance.getEntriesByType('measure').filter((entry) => entry.name.startsWith(`${prefix}.`)).forEach((entry) => performance.clearMeasures(entry.name));
    };
    const report = () => {
      if (reported) return;
      reported = true;
      measure('request-to-first-useful-render', 'request-start', 'first-useful-render');
      measure('request-to-editor-ready', 'request-start', 'editor-ready');
      measure('ocr-end-to-first-useful-render', 'ocr-end', 'first-useful-render');
      measure('ocr-end-to-editor-ready', 'ocr-end', 'editor-ready');
      measure('image-decode', 'image-decode-start', 'image-decode-end');
      const payload = buildOcrTelemetryPayload({ requestId, marks, serverTimings, counts });
      void reportOcrTelemetry(payload).finally(cleanup);
    };
    const fields = () => Array.from(document.querySelectorAll('fieldset > legend.sr-only'))
      .filter((legend) => /^Questão \d+$/.test(legend.textContent?.trim() ?? ''))
      .map((legend) => legend.parentElement as HTMLFieldSetElement)
      .filter((fieldset) => fieldset.getClientRects().length > 0);
    const values = (fieldsets: HTMLFieldSetElement[]) => fieldsets.map((fieldset) =>
      fieldset.querySelector<HTMLTextAreaElement>(':scope > div textarea')?.value ?? '',
    );

    return (extraction: ExamExtraction, names: string) => {
      const expectedItems = draftFromExtraction(extraction, { subjects: [] }).items;
      const expected = expectedItems.map((item) => serializeMathText(item.text, item.formulas, item.blocks));
      const previous = values(fields()).slice(0, expected.length);
      counts.questionCount = Math.min(10_000, expected.length);
      // A callback may ask a blocking confirmation before replacing the current
      // draft. Start observing only after it returns, and skip declined imports.
      if (onExtracted(extraction, names) === false) {
        report();
        return;
      }

      if (expected.length === 0) {
        report();
        return;
      }

      let observationClosed = false;
      let checkScheduled = false;
      const check = () => {
        if (observationClosed) return false;
        const currentFields = fields();
        const current = values(currentFields);
        const state = evaluateOcrEditorRender(expected, current, previous);
        if (state.alreadyReady && marks['first-useful-render'] === undefined) {
          // The identical draft was already visible before this OCR run; it is ready at OCR completion.
          const readyAt = marks['ocr-end'] ?? performance.now();
          markUi('first-useful-render', readyAt);
          markUi('editor-ready', readyAt);
        } else {
          if (state.firstUsefulIndex !== null) markUi('first-useful-render');
          if (state.editorReady) markUi('editor-ready');
        }
        if (!state.editorReady) return false;

        observationClosed = true;
        observer.disconnect();
        window.clearTimeout(timeout);
        const images = currentFields.flatMap((fieldset) => Array.from(fieldset.querySelectorAll<HTMLImageElement>('img')));
        counts.imageCount = Math.min(10_000, images.length);
        if (images.length === 0) {
          report();
          return true;
        }

        markUi('image-decode-start');
        void decodeOcrImages(images).then((result) => {
          counts.imageDecodeSuccessCount = Math.min(10_000, result.successCount);
          counts.imageDecodeFailureCount = Math.min(10_000, result.failureCount);
          markUi('image-decode-end');
          report();
        });
        return true;
      };

      const scheduleCheck = () => {
        if (checkScheduled || observationClosed) return;
        checkScheduled = true;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          checkScheduled = false;
          check();
        }));
      };
      const observer = new MutationObserver(scheduleCheck);
      observer.observe(document.body, { childList: true, subtree: true });
      const timeout = window.setTimeout(() => {
        observationClosed = true;
        observer.disconnect();
        counts.renderTimeoutCount = 1;
        report();
      }, 15_000);
      scheduleCheck();
    };
  }

  function add(list: FileList | File[]) {
    const { files: next, rejected } = addOcrFiles(files, Array.from(list));
    rejected.forEach((r) => toast.error(r));
    setFiles(next);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = ocrFilesProblem(files);
    if (problem) { setError(problem); return; }
    const form = new FormData();
    files.forEach((f) => form.append('files', f, f.name));
    setBusy(true);
    setError(null);
    setStage('A enviar ficheiros…');
    setUploadPercent(0);
    setPageProgress(null);
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = createOcrRequestId();
    const marks: Partial<Record<OcrMark, number>> = {};
    const serverTimings: Record<string, number> = {};
    const pageTimings: Record<string, number> = {};
    const counts: Record<OcrCountKey, number> = {
      pageCount: 0,
      fileCount: files.length,
      questionCount: 0,
      imageCount: 0,
      imageDecodeSuccessCount: 0,
      imageDecodeFailureCount: 0,
      requestFailureCount: 0,
      cancelledRequestCount: 0,
      renderTimeoutCount: 0,
    };
    const prefix = `kixi.ocr.${requestId}`;
    let reported = false;
    const reportFailure = () => {
      if (reported) return;
      reported = true;
      if (!Number.isFinite(serverTimings.ocrMs) && Number.isFinite(pageTimings.ocrMs)) serverTimings.ocrMs = pageTimings.ocrMs;
      if (!Number.isFinite(serverTimings.parsingMs) && Number.isFinite(pageTimings.parsingMs)) serverTimings.parsingMs = pageTimings.parsingMs;
      const payload = buildOcrTelemetryPayload({ requestId, marks, serverTimings, counts });
      void reportOcrTelemetry(payload).finally(() => {
        performance.getEntriesByType('mark').filter((entry) => entry.name.startsWith(`${prefix}.`)).forEach((entry) => performance.clearMarks(entry.name));
        performance.getEntriesByType('measure').filter((entry) => entry.name.startsWith(`${prefix}.`)).forEach((entry) => performance.clearMeasures(entry.name));
      });
    };
    try {
      const extraction = await streamExamOcr(form, {
        requestId,
        onMark(mark, at) { marks[mark] = at; },
        onUploadProgress(loaded, total) {
          if (total > 0) setUploadPercent(Math.min(100, Math.round((loaded / total) * 100)));
        },
        onEvent(event: OcrStreamEvent) {
          if (event.type === 'prepared') {
            setStage('A ler as páginas…');
            setPageProgress({ page: 0, pageCount: event.pageCount });
            counts.pageCount = Math.min(10_000, Math.max(counts.pageCount, event.pageCount));
            Object.assign(serverTimings, event.timings);
          } else if (event.type === 'rasterized') {
            setStage(`A preparar página ${event.page} de ${event.pageCount}…`);
            counts.pageCount = Math.min(10_000, Math.max(counts.pageCount, event.pageCount));
            if (Number.isFinite(event.timings.rasterizationMs) && event.timings.rasterizationMs >= 0) {
              serverTimings.rasterizationMs = event.timings.rasterizationMs;
            }
          } else if (event.type === 'progress') {
            setStage(`A ler página ${event.page} de ${event.pageCount}…`);
            setPageProgress({ page: event.page, pageCount: event.pageCount });
            counts.pageCount = Math.min(10_000, Math.max(counts.pageCount, event.pageCount));
            for (const key of ['ocrMs', 'parsingMs']) {
              const value = event.timings[key];
              if (Number.isFinite(value) && value >= 0) pageTimings[key] = (pageTimings[key] ?? 0) + value;
            }
          } else if (event.type === 'result') {
            setStage('A montar as questões…');
            Object.assign(serverTimings, event.timings);
            if (!Number.isFinite(serverTimings.ocrMs) && Number.isFinite(pageTimings.ocrMs)) serverTimings.ocrMs = pageTimings.ocrMs;
            if (!Number.isFinite(serverTimings.parsingMs) && Number.isFinite(pageTimings.parsingMs)) serverTimings.parsingMs = pageTimings.parsingMs;
          }
        },
      }, controller.signal);
      const apply = recordRenderTimings(requestId, marks, serverTimings, counts);
      apply(extraction, files.map((f) => f.name).join(', '));
      reported = true;
      setFiles([]);
    } catch (caught) {
      marks['request-end'] ??= performance.now();
      if (caught instanceof DOMException && caught.name === 'AbortError') counts.cancelledRequestCount = 1;
      else counts.requestFailureCount = 1;
      reportFailure();
      if (!(caught instanceof DOMException && caught.name === 'AbortError')) {
        setError(caught instanceof Error ? caught.message : 'Não foi possível concluir a leitura OCR.');
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      setStage(null);
      setUploadPercent(null);
      setPageProgress(null);
    }
  }

  return (
    <Card className="print:hidden">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Importar de imagem ou PDF</CardTitle>
            <CardDescription>O OCR lê a prova, descobre o tipo de cada questão e as alíneas, e preenche o construtor. Nada é guardado até clicar em Guardar ou Publicar.</CardDescription>
          </div>
          <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Fechar o importador" onClick={onClose} disabled={busy}><X size={16} /></Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
            className={`grid place-items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors ${over ? 'border-primary bg-accent' : 'border-border'}`}
          >
            <UploadCloud className="size-7 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Arraste os ficheiros para aqui</p>
            <p className="max-w-prose text-xs text-muted-foreground">JPG, PNG, PDF, WEBP, BMP ou TIFF, até 15 MB cada, no máximo 10 e 50 MB no total. As páginas são lidas pela ordem em que as adicionar. Uma foto de frente e bem iluminada lê melhor.</p>
            <input ref={inputRef} type="file" multiple accept={OCR_ACCEPT} className="sr-only" onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ''; }} aria-label="Escolher ficheiros da prova" />
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy} data-testid="gestor-statements-import-ficheiro">Escolher ficheiros</Button>
          </div>

          {files.length > 0 && (
            <ol className="grid gap-2" aria-label="Ficheiros a importar">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex min-w-0 items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent text-primary">{f.type === 'application/pdf' ? <FileText size={16} aria-hidden /> : <FileImage size={16} aria-hidden />}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{i + 1}. {f.name}</span><span className="text-xs text-muted-foreground">{size(f.size)}</span></span>
                  <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0" aria-label={`Remover ${f.name}`} disabled={busy} onClick={() => setFiles((cur) => cur.filter((_, k) => k !== i))}><X size={14} /></Button>
                </li>
              ))}
            </ol>
          )}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          {busy && stage ? (
            <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm" role="status" aria-live="polite">
              <Spinner className="size-4" />
              <span className="font-medium">{stage}</span>
              {uploadPercent !== null && <span className="text-xs text-muted-foreground">Envio: {uploadPercent}%</span>}
              {pageProgress && <span className="ml-auto text-xs text-muted-foreground">{pageProgress.page}/{pageProgress.pageCount} páginas</span>}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            {busy && <Button type="button" variant="outline" onClick={() => abortRef.current?.abort()}>Cancelar</Button>}
            <Button type="submit" disabled={busy || files.length === 0} data-testid="gestor-statements-import-submeter">
              {busy ? (<><Spinner className="size-4" />A ler a prova…</>) : (<><ScanText size={16} aria-hidden />Ler e preencher</>)}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
