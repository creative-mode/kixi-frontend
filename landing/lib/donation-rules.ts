/** Regras da doação de enunciados, partilhadas pelo formulário e pelo route handler.
 *  O backend é quem decide (tipo pelos bytes, limites, orçamento); isto só poupa um pedido
 *  perdido e garante que o que sai daqui já vai bem formado. */

export const EXAM_TYPES = ['Teste', 'Prova', 'Exame', 'Trabalho', 'Outro'] as const;
export const MAX_FILES = 10;
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf'] as const;
export const ACCEPT_ATTR = '.jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf';

/** Versão do texto de consentimento mostrado; o backend guarda a sua própria versão. */
export const CONSENT_TEXT_VERSION = '2026-10-v1';

export type DonationFields = {
  donorName: string;
  donorEmail: string;
  institutionName: string;
  subjectName: string;
  classGrade: string;
  schoolYear: string;
  examType: string;
  notes: string;
  consent: boolean;
};

export type FieldErrors = Partial<Record<keyof DonationFields | 'files', string>>;

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;
const YEAR = /^(19|20)\d{2}(\/(19|20)\d{2})?$/;
const NO_MARKUP = /[<>]/;

/** Um cabeçalho `X-Forwarded-For` aceitável para repassar: só uma lista de IPs. */
export function forwardedFor(header: string | null | undefined): string | null {
  const value = header?.trim();
  if (!value || value.length > 200) return null;
  return /^[0-9a-fA-F:.]+(\s*,\s*[0-9a-fA-F:.]+)*$/.test(value) ? value : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function readFields(get: (name: string) => unknown): DonationFields {
  return {
    donorName: text(get('donorName')),
    donorEmail: text(get('donorEmail')),
    institutionName: text(get('institutionName')),
    subjectName: text(get('subjectName')),
    classGrade: text(get('classGrade')),
    schoolYear: text(get('schoolYear')),
    examType: text(get('examType')),
    notes: text(get('notes')),
    consent: text(get('consent')) === 'true',
  };
}

export function validateFields(f: DonationFields): FieldErrors {
  const errors: FieldErrors = {};
  const range = (key: keyof DonationFields, value: string, min: number, max: number, label: string) => {
    if (value.length < min || value.length > max) errors[key] = `${label}: entre ${min} e ${max} caracteres.`;
    else if (NO_MARKUP.test(value)) errors[key] = `${label}: não pode conter < ou >.`;
  };
  range('institutionName', f.institutionName, 2, 150, 'Instituição');
  range('subjectName', f.subjectName, 2, 100, 'Disciplina');
  if (f.donorName) range('donorName', f.donorName, 2, 100, 'Nome');
  if (f.classGrade) range('classGrade', f.classGrade, 1, 50, 'Classe ou turma');
  if (f.notes.length > 1000) errors.notes = 'Notas: no máximo 1000 caracteres.';
  else if (NO_MARKUP.test(f.notes)) errors.notes = 'Notas: não podem conter < ou >.';
  if (f.donorEmail && (f.donorEmail.length > 150 || !EMAIL.test(f.donorEmail))) {
    errors.donorEmail = 'Indica um e-mail válido ou deixa em branco.';
  }
  if (f.schoolYear && !YEAR.test(f.schoolYear)) errors.schoolYear = 'Ano lectivo como 2024/2025 (ou 2025).';
  if (!(EXAM_TYPES as readonly string[]).includes(f.examType)) errors.examType = 'Escolhe o tipo de prova.';
  if (!f.consent) errors.consent = 'Tens de aceitar para podermos receber a doação.';
  return errors;
}

export type FileLike = { name: string; size: number };

function extension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/** Primeiro problema encontrado nos ficheiros, ou `null`. */
export function validateFiles(files: readonly FileLike[]): string | null {
  if (files.length === 0) return 'Junta pelo menos uma foto ou PDF do enunciado.';
  if (files.length > MAX_FILES) return `No máximo ${MAX_FILES} ficheiros por doação.`;
  let total = 0;
  for (const file of files) {
    if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(extension(file.name))) {
      return `“${file.name}” não é uma foto (JPG, PNG, WEBP) nem um PDF.`;
    }
    if (file.size <= 0) return `“${file.name}” está vazio.`;
    if (file.size > MAX_FILE_BYTES) return `“${file.name}” passa dos ${MAX_FILE_BYTES / (1024 * 1024)} MB.`;
    total += file.size;
  }
  if (total > MAX_TOTAL_BYTES) return `O total passa dos ${MAX_TOTAL_BYTES / (1024 * 1024)} MB.`;
  return null;
}

export type BackendOutcome = { ok: true; reference: string } | { ok: false; status: number; message: string };

/** A resposta do backend em português, sem repassar o texto técnico dele. */
export function messageForStatus(status: number, retryAfter?: string | null): string {
  switch (status) {
    case 400:
      return 'Algum dado não foi aceite. Confirma os campos e os ficheiros e tenta outra vez.';
    case 411:
    case 413:
      return 'O envio é demasiado grande. Reduz o número ou o tamanho dos ficheiros.';
    case 415:
      return 'Um dos ficheiros não é uma foto nem um PDF válido (ou o PDF tem conteúdo ativo).';
    case 429: {
      const seconds = Number(retryAfter);
      const wait = Number.isFinite(seconds) && seconds > 0 ? ` Tenta de novo em ${Math.ceil(seconds / 60)} min.` : '';
      return `Já recebemos muitas doações deste endereço.${wait}`;
    }
    case 503:
      return 'O serviço está temporariamente indisponível. Tenta daqui a pouco.';
    default:
      return 'Não foi possível enviar agora. Tenta outra vez daqui a pouco.';
  }
}
