/**
 * Validador de fotos de enunciados, feito no browser antes do envio.
 *
 * Um enunciado fotografado é uma folha clara com linhas de texto escuro, de pé, nítida e inteira.
 * Daqui sai um veredicto por imagem: `ok`, `warn` (passa, com um aviso) ou `reject` (não serve; diz como
 * tirar outra). Não lê o texto: só mede características que um enunciado tem e que o lixo (selfies,
 * paisagens, ecrãs, folhas em branco, fotos tremidas) não tem. O servidor valida o tipo e o tamanho dos ficheiros; isto trata só da qualidade.
 */

export type Verdict = 'ok' | 'warn' | 'reject';
export type Reason =
  | 'unreadable'
  | 'tiny'
  | 'blank'
  | 'dark'
  | 'not-document'
  | 'rotated'
  | 'sideways'
  | 'blurry'
  | 'low-res';

export type Assessment = { verdict: Verdict; reasons: Reason[]; metrics: Metrics };

export type Metrics = {
  width: number;
  height: number;
  bright: number;
  saturation: number;
  ink: number;
  lines: number;
  rowVsCol: number;
  sharpness: number;
};

export const MESSAGES: Record<Reason, string> = {
  unreadable: 'Não consegui abrir esta imagem. Tenta outra foto.',
  tiny: 'A imagem é muito pequena para ler o texto. Tira a foto mais perto ou com mais qualidade.',
  blank: 'Parece uma folha em branco. Fotografa a página com o enunciado.',
  dark: 'A foto está muito escura. Tira-a com mais luz.',
  'not-document': 'Não parece uma folha com texto. Fotografa o enunciado inteiro, de frente.',
  rotated: 'A página parece estar deitada. Roda o telemóvel e tira a foto com a folha em pé.',
  sideways: 'O texto parece estar de lado. Tira a foto com a folha em pé.',
  blurry: 'A foto está desfocada. Segura firme e deixa focar antes de tirar.',
  'low-res': 'A resolução é baixa; o texto pequeno pode não ser lido.',
};

/** Reasons that stop the file. The others only warn. */
const BLOCKING: Reason[] = ['unreadable', 'tiny', 'blank', 'dark', 'not-document', 'rotated', 'sideways', 'blurry'];

export const THRESHOLDS = {
  minSide: 420,
  lowResSide: 700,
  brightMin: 0.28,
  meanLumaMin: 70,
  blankInk: 0.004,
  saturationMax: 0.42,
  inkMin: 0.012,
  inkMax: 0.42,
  linesMin: 6,
  rotatedRatio: 1.6,
  rowVsColMin: 1.8,
  rowVsColMax: 200,
  blurHard: 14,
  blurSoft: 28,
};

const WORK = 640;

/** Grayscale + saturation from RGBA, already downscaled. */
function summarize(rgba: Uint8ClampedArray, w: number, h: number) {
  const gray = new Float32Array(w * h);
  let bright = 0;
  let sat = 0;
  let luma = 0;
  for (let i = 0, p = 0; p < w * h; i += 4, p++) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[p] = y;
    luma += y;
    if (y > 140) bright++;
    const mx = Math.max(r, g, b);
    sat += mx === 0 ? 0 : (mx - Math.min(r, g, b)) / mx;
  }
  const n = w * h;
  return { gray, bright: bright / n, saturation: sat / n, meanLuma: luma / n };
}

/** Pixels clearly darker than their neighbourhood: the ink (text, lines, drawings). */
function inkMask(gray: Float32Array, w: number, h: number): Uint8Array {
  const r = Math.max(6, Math.round(Math.min(w, h) / 40));
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row;
    }
  }
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const sum = integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      if (gray[y * w + x] < mean * 0.78 && mean > 60) mask[y * w + x] = 1;
    }
  }
  return mask;
}

function runs(profile: number[], threshold: number, minLength: number): number {
  let count = 0;
  let length = 0;
  for (const value of profile) {
    if (value > threshold) length++;
    else {
      if (length >= minLength) count++;
      length = 0;
    }
  }
  if (length >= minLength) count++;
  return count;
}

function variance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
}

/** Variance of the Laplacian: low when the picture has no sharp edges (blur, shake). */
function sharpness(gray: Float32Array, w: number, h: number): number {
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/**
 * `rgba` is the image already shrunk to fit WORK pixels on its long side; `originalWidth/Height` are the
 * real dimensions of the file (resolution is judged on those).
 */
export function assessPixels(rgba: Uint8ClampedArray, w: number, h: number, originalWidth: number, originalHeight: number): Assessment {
  const t = THRESHOLDS;
  const { gray, bright, saturation, meanLuma } = summarize(rgba, w, h);
  const mask = inkMask(gray, w, h);

  const rows: number[] = new Array(h).fill(0);
  const cols: number[] = new Array(w).fill(0);
  let inkCount = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        rows[y]++;
        cols[x]++;
        inkCount++;
      }
    }
  }
  const ink = inkCount / (w * h);
  const rowFrac = rows.map((v) => v / w);
  const colFrac = cols.map((v) => v / h);
  const rowMean = rowFrac.reduce((a, b) => a + b, 0) / h;
  const colMean = colFrac.reduce((a, b) => a + b, 0) / w;
  const lines = runs(rowFrac, Math.max(rowMean * 0.9, 0.004), 2);
  const linesCols = runs(colFrac, Math.max(colMean * 0.9, 0.004), 2);
  const rv = variance(rowFrac);
  const cv = variance(colFrac);
  const rowVsCol = cv === 0 ? 1 : rv / cv;
  const sharp = sharpness(gray, w, h);

  const metrics: Metrics = { width: originalWidth, height: originalHeight, bright, saturation, ink, lines, rowVsCol, sharpness: sharp };
  const reasons: Reason[] = [];
  const short = Math.min(originalWidth, originalHeight);

  if (short < t.minSide) reasons.push('tiny');
  else if (short < t.lowResSide) reasons.push('low-res');

  if (meanLuma < t.meanLumaMin) reasons.push('dark');
  else if (ink < t.blankInk) reasons.push('blank');
  else if (bright < t.brightMin || saturation > t.saturationMax || ink < t.inkMin || ink > t.inkMax) reasons.push('not-document');
  else if (linesCols > lines * 1.4 && cv > rv * t.rotatedRatio) reasons.push('sideways');
  else if (lines < t.linesMin || rowVsCol < t.rowVsColMin || rowVsCol > t.rowVsColMax) reasons.push('not-document');
  else if (originalWidth > originalHeight * 1.15) reasons.push('rotated');

  if (sharp < t.blurHard) reasons.push('blurry');
  else if (sharp < t.blurSoft) reasons.push('low-res');

  const blocking = reasons.some((r) => BLOCKING.includes(r));
  const verdict: Verdict = blocking ? 'reject' : reasons.length ? 'warn' : 'ok';
  return { verdict, reasons: [...new Set(reasons)], metrics };
}

/** The one message to show for an assessment: the first blocking reason, else the first warning. */
export function messageFor(a: Assessment): string | null {
  const first = a.reasons.find((r) => BLOCKING.includes(r)) ?? a.reasons[0];
  return first ? MESSAGES[first] : null;
}

/** Loads a file, shrinks it and assesses it. PDFs are not looked at (they cannot be drawn here). */
export async function inspectImage(file: File): Promise<Assessment | null> {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return null;
  try {
    const bitmap = await createImageBitmap(file); // aplica a orientação EXIF
    const scale = Math.min(1, WORK / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, w, h);
    const result = assessPixels(context.getImageData(0, 0, w, h).data, w, h, bitmap.width, bitmap.height);
    bitmap.close();
    return result;
  } catch {
    return { verdict: 'reject', reasons: ['unreadable'], metrics: { width: 0, height: 0, bright: 0, saturation: 0, ink: 0, lines: 0, rowVsCol: 0, sharpness: 0 } };
  }
}
