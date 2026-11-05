/**
 * PDF no navegador, para as miniaturas e a repetição de uma página.
 *
 * Carregado só quando há um PDF na lista (import dinâmico): o `pdfjs-dist` não
 * entra no bundle inicial. O worker vem de `public/pdf.worker.min.mjs` — o CSP
 * já aceita `worker-src 'self' blob:` — e o caminho leva o `basePath` porque o
 * Next não o prefixa em `workerSrc`.
 */
import { BASE_PATH } from '../constants';

export interface PdfDocument {
  numPages: number;
  renderPage(page: number, canvas: HTMLCanvasElement, scale: number): Promise<void>;
  destroy(): Promise<void>;
}

let pdfjsPromise: Promise<{ getDocument: typeof import('pdfjs-dist').getDocument } | null> | null = null;

const loadPdfjs = async () => {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = `${BASE_PATH}/pdf.worker.min.mjs`;
      return pdfjs;
    }).catch(() => null); // Sem worker, sem PDF: os tiles voltam ao ícone.
  }
  return pdfjsPromise;
};

const cache = new WeakMap<File, Promise<PdfDocument | null>>();

/** Abre (e memoriza) um PDF; resolve `null` quando o navegador não o consegue ler. */
export function loadPdf(file: File): Promise<PdfDocument | null> {
  const cached = cache.get(file);
  if (cached) return cached;
  const opened = loadPdfjs().then(async (pdfjs) => {
    if (!pdfjs) return null;
    try {
      const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
      const doc = await task.promise;
      const document: PdfDocument = {
        numPages: doc.numPages,
        async renderPage(page, canvas, scale) {
          const rendered = await doc.getPage(Math.min(Math.max(1, page), doc.numPages));
          const viewport = rendered.getViewport({ scale });
          canvas.width = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          await rendered.render({ canvasContext: canvas.getContext('2d')!, canvas, viewport }).promise;
        },
        async destroy() {
          await task.destroy();
        },
      };
      return document;
    } catch {
      return null;
    }
  });
  cache.set(file, opened);
  return opened;
}

/** O nº de páginas de um PDF, ou `null` se não souber (a lista trata como 1 até saber). */
export async function pdfPageCount(file: File): Promise<number | null> {
  const doc = await loadPdf(file);
  return doc?.numPages ?? null;
}

/** Renderiza uma página de PDF para PNG: é o ficheiro que «Repetir esta página» volta a enviar. */
export async function renderPdfPageToImage(file: File, page: number, scale = 2): Promise<File | null> {
  const doc = await loadPdf(file);
  if (!doc) return null;
  const canvas = document.createElement('canvas');
  try {
    await doc.renderPage(page, canvas, scale);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return null;
    return new File([blob], `${file.name.replace(/\.pdf$/i, '')}-p${page}.png`, { type: 'image/png' });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
