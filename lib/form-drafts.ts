/**
 * Rascunhos de formulários longos do gestor, em `sessionStorage` (#503).
 *
 * `sessionStorage` vive só neste separador e desaparece quando ele fecha: é o sítio
 * certo para trabalho a meio de um formulário, sem deixar dados no computador da
 * escola para o próximo utilizador. Cada entrada tem o `owner` (accountId) para nunca
 * ser restaurada numa sessão de outra pessoa, uma validade curta e uma limpeza de
 * chaves antigas.
 *
 * O módulo é puro: recebe um `DraftStorage` (a interface mínima do `sessionStorage`)
 * para os testes de `node --test` não precisarem do browser.
 */

export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key?(index: number): string | null;
  readonly length?: number;
}

const VERSION = 1;
const PREFIX = 'kixi:form:';
const FORM_ID = /^[a-zA-Z0-9:_-]{1,120}$/;
/** Doze horas: chega para uma sessão de trabalho, não chega para ficar esquecido de um dia para o outro. */
export const DRAFT_TTL_MS = 12 * 60 * 60 * 1000;
/** Um formulário maior do que isto não é trabalho normal: não se guarda para não encher a quota. */
const MAX_DRAFT_BYTES = 512 * 1024;
/** Campos que nunca vão para o armazenamento, mesmo que o chamador os passe por engano. */
const SENSITIVE_KEY = /(pass(word)?|senha|token|secret|authorization|credential|api[-_]?key|cookie|jwt)/i;

export interface FormDraft<T> {
  v: typeof VERSION;
  owner: number | null;
  at: number;
  data: T;
}

export const formDraftKey = (formId: string): string => `${PREFIX}${formId}`;

/** Remove chaves sensíveis e valores que não sobrevivem a JSON (funções, símbolos, ciclos). */
export function sanitizeDraft(value: unknown, depth = 0): unknown {
  if (depth > 12) return undefined;
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDraft(item, depth + 1)).filter((item) => item !== undefined);
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(key)) continue;
      const clean = sanitizeDraft(item, depth + 1);
      if (clean !== undefined) out[key] = clean;
    }
    return out;
  }
  return undefined;
}

function validFormId(formId: string): boolean {
  return FORM_ID.test(formId);
}

/** Guarda o rascunho. Falhas de quota/modo privado não podem estragar o formulário. */
export function saveFormDraft<T>(
  storage: DraftStorage,
  formId: string,
  data: T,
  owner: number | null,
  now: number = Date.now(),
): boolean {
  if (!validFormId(formId)) return false;
  const clean = sanitizeDraft(data);
  if (clean === undefined) return false;
  try {
    const raw = JSON.stringify({ v: VERSION, owner, at: now, data: clean } satisfies FormDraft<unknown>);
    if (raw.length > MAX_DRAFT_BYTES) return false;
    storage.setItem(formDraftKey(formId), raw);
    return true;
  } catch {
    return false;
  }
}

function remove(storage: DraftStorage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // nada a fazer
  }
}

/** O rascunho, se for desta pessoa e ainda estiver dentro da validade. */
export function loadFormDraft<T>(
  storage: DraftStorage,
  formId: string,
  owner: number | null,
  now: number = Date.now(),
): T | null {
  if (!validFormId(formId)) return null;
  const key = formDraftKey(formId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FormDraft<T>>;
    if (parsed.v !== VERSION || parsed.owner !== owner || typeof parsed.at !== 'number' || now - parsed.at > DRAFT_TTL_MS) {
      remove(storage, key);
      return null;
    }
    return (parsed.data ?? null) as T | null;
  } catch {
    remove(storage, key);
    return null;
  }
}

export function clearFormDraft(storage: DraftStorage, formId: string): void {
  if (!validFormId(formId)) return;
  remove(storage, formDraftKey(formId));
}

/** Limpa rascunhos expirados, corrompidos ou de outra versão. Corre ao abrir um formulário. */
export function clearStaleFormDrafts(storage: DraftStorage, now: number = Date.now()): void {
  if (typeof storage.length !== 'number' || typeof storage.key !== 'function') return;
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  for (const key of keys) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<FormDraft<unknown>>;
      if (parsed.v !== VERSION || typeof parsed.at !== 'number' || now - parsed.at > DRAFT_TTL_MS) {
        remove(storage, key);
      }
    } catch {
      remove(storage, key);
    }
  }
}
