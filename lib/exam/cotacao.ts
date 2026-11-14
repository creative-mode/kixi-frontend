/**
 * A cotação de uma pergunta, como o professor a conhece (#760/#782):
 * «1,5» e «1.5» valem o mesmo, e a vírgula nunca salta para o ponto sem teclado.
 */

export type CotaçãoParse =
  | { ok: true; value: number | '' }
  | { ok: false };

/** O que o campo feito a mão aceita: «1,5»/«1.5» valem o mesmo; um valor ruim mantém-se no campo sem tocar no rascunho. */
export function parseCotação(text: string): CotaçãoParse {
  const raw = text.replace(',', '.').trim();
  if (raw === '') return { ok: true, value: '' };
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return { ok: false };
  return { ok: true, value: parsed };
}

/** Por que apresenta o campo: «1,5», ou vazio quando a cotação ainda não foi decidida. */
export function formatCotação(value: number | ''): string {
  return value === '' ? '' : String(value).replace('.', ',');
}
