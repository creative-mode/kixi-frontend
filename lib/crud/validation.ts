/** Validação dos formulários CRUD, sem React: testável com `node --test`. */
import type { Field } from './entities';

export type FieldErrors = Record<string, string>;
type Checked = Pick<Field, 'name' | 'type' | 'required' | 'min' | 'max' | 'step'>;

const isMultiple = (n: number, base: number, step: number) => {
  const ratio = (n - base) / step;
  return Math.abs(ratio - Math.round(ratio)) < 1e-9;
};

/** Um campo numérico só aceita decimais se declarar um `step` fracionário (0,5, 0,01…). */
const acceptsDecimals = (f: Checked) => f.step !== undefined && !Number.isInteger(f.step);

/** A mensagem de erro do campo, ou `''` quando o valor serve. */
export function fieldError(f: Checked, raw: unknown): string {
  const empty = raw === undefined || raw === null || String(raw).trim() === '';
  if (f.required && empty) return 'Campo obrigatório';
  if (empty) return '';
  const s = String(raw).trim();
  if (f.type === 'number') {
    const n = Number(s);
    const decimals = acceptsDecimals(f);
    if (!Number.isFinite(n)) return decimals ? 'Introduza um número' : 'Introduza um número inteiro';
    if (!decimals && !Number.isInteger(n)) return 'Introduza um número inteiro';
    if (f.min != null && n < f.min) return `Mínimo ${f.min}`;
    if (f.max != null && n > f.max) return `Máximo ${f.max}`;
    if (f.step !== undefined && !isMultiple(n, f.min ?? 0, f.step)) return `Use múltiplos de ${String(f.step).replace('.', ',')}`;
  } else if (f.type === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return 'Email inválido';
  } else if (f.type !== 'select') {
    if (f.min != null && s.length < f.min) return `Mínimo ${f.min} caracteres`;
    if (f.max != null && s.length > f.max) return `Máximo ${f.max} caracteres`;
  }
  return '';
}

/** Só os campos com erro, pela ordem do formulário. */
export function validate(fields: Checked[], values: Record<string, unknown>): FieldErrors {
  const errors: FieldErrors = {};
  for (const f of fields) {
    const message = fieldError(f, values[f.name]);
    if (message) errors[f.name] = message;
  }
  return errors;
}

/** O aviso de um envio inválido e o campo onde pôr o foco; `null` quando não há erros. */
export function errorSummary(fields: Pick<Field, 'name' | 'label'>[], errors: FieldErrors): { text: string; first: string } | null {
  const invalid = fields.filter((f) => errors[f.name]);
  if (invalid.length === 0) return null;
  const count = invalid.length;
  return {
    text: `Há ${count} ${count === 1 ? 'campo' : 'campos'} por corrigir: ${invalid.map((f) => f.label).join(', ')}.`,
    first: invalid[0].name,
  };
}
