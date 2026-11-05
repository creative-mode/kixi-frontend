/** O número de processo do aluno na escola (kixi#512), sem React: testável com `node --test`. */

/** O limite do contrato v1 do motor de pautas (`alunos[].processo`) e da coluna no backend. */
export const PROCESS_NUMBER_MAX = 30;

const ALLOWED = /^[\p{L}\p{N}][\p{L}\p{N} ./_-]*$/u;

/**
 * Apara e valida como o backend: vazio é «sem número» (`null`); até 30 caracteres; letras, algarismos, espaço e
 * `. / _ -`, a começar por letra ou algarismo. Devolve o valor limpo ou a frase do erro, para o campo a mostrar antes de
 * ir ao servidor (que volta a validar).
 */
export function parseProcessNumber(raw: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const value = raw.trim();
  if (value === '') return { ok: true, value: null };
  if (value.length > PROCESS_NUMBER_MAX) return { ok: false, error: `No máximo ${PROCESS_NUMBER_MAX} caracteres.` };
  if (!ALLOWED.test(value)) return { ok: false, error: 'Só letras, algarismos, espaço e . / _ -' };
  return { ok: true, value };
}
