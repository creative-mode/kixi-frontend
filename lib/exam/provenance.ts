// A proveniência OCR do enunciado criado no construtor (kixi#648). O backend aceita `ocrRequestId` e `ocrConfidence`
// opcionais em `POST /statements/manual` (`ManualStatementRequest`): com eles o enunciado fica `source=ocr` e entra na fila
// «Vindos do OCR». Um backend mais antigo ignora os campos, por isso enviá-los nunca parte nada; e um valor inválido não
// se envia, porque o backend recusaria o pedido inteiro.

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export type OcrProvenance = { ocrRequestId?: string; ocrConfidence?: number };

/** Os campos de proveniência de um rascunho, só os válidos: o id da leitura (UUID, em minúsculas) e a confiança (0 a 1). */
export function ocrProvenance(draft: OcrProvenance | null | undefined): OcrProvenance {
  const out: OcrProvenance = {};
  const id = draft?.ocrRequestId;
  if (typeof id === 'string' && UUID.test(id)) out.ocrRequestId = id.toLowerCase();
  const c = draft?.ocrConfidence;
  if (typeof c === 'number' && Number.isFinite(c) && c >= 0 && c <= 1) out.ocrConfidence = c;
  return out;
}

/** O trimestre escolhido como id para o corpo do pedido; `null` quando não há escolha válida. */
export function termIdFrom(value: string | number | null | undefined): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}
