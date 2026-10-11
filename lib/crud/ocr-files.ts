// Os limites do upload OCR, os mesmos do `LegacyOcrStatementController`/`OcrController`
// do backend: 10 ficheiros, as extensões que ele aceita, 20 MB por ficheiro e 50 MB
// no total. Aqui ficam um pouco abaixo por ficheiro (15 MB), que é o que anunciamos.
// O total também é o que o next.config deixa passar na server action e no proxy.

export const OCR_MAX_FILES = 10;
export const OCR_MAX_FILE_BYTES = 15 * 1024 * 1024;
export const OCR_MAX_TOTAL_BYTES = 50 * 1024 * 1024;
export const OCR_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf', '.webp', '.bmp', '.tiff', '.tif'];
/** Para o `accept` do input: as extensões, para o seletor não oferecer GIF ou HEIC. */
export const OCR_ACCEPT = OCR_EXTENSIONS.join(',');

type FileLike = { name: string; size: number };

const allowed = (name: string) => OCR_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

/**
 * Junta `incoming` aos ficheiros já escolhidos e diz porque é que algum ficou de fora.
 * Pela ordem: tipo, tamanho de cada um, quantidade, e por fim o total.
 */
export function addOcrFiles<T extends FileLike>(current: T[], incoming: T[]): { files: T[]; rejected: string[] } {
  const files = [...current];
  const rejected: string[] = [];
  let total = files.reduce((a, f) => a + f.size, 0);
  for (const f of incoming) {
    if (!allowed(f.name)) rejected.push(`«${f.name}»: só são aceites JPG, PNG, PDF, WEBP, BMP e TIFF.`);
    else if (f.size > OCR_MAX_FILE_BYTES) rejected.push(`«${f.name}» ultrapassa os 15 MB.`);
    else if (files.length >= OCR_MAX_FILES) rejected.push(`«${f.name}»: no máximo ${OCR_MAX_FILES} ficheiros de cada vez.`);
    else if (total + f.size > OCR_MAX_TOTAL_BYTES) rejected.push(`«${f.name}»: o envio passaria dos 50 MB no total.`);
    else {
      files.push(f);
      total += f.size;
    }
  }
  return { files, rejected };
}

/** A mesma regra do lado do servidor, sobre a lista final: a primeira razão para recusar, ou null. */
export function ocrFilesProblem(files: FileLike[]): string | null {
  if (files.length === 0) return 'Escolha pelo menos um ficheiro.';
  const { rejected } = addOcrFiles([], files);
  return rejected[0] ?? null;
}
