/** A lista pública de escolas (#763): o contrato que o combobox da doação usa.
 *
 *  Pura de propósito: o route handler faz o pedido, o formulário filtra o que veio e
 *  os testes correm sem browser. A leitura é tolerante porque o `/institutions/public`
 *  ainda não existe (creative-mode/kixi#597): aceita a lista nua ou dentro de um
 *  envelope, e a sigla com os nomes que o backend lhe quiser dar. */

export interface InstitutionOption {
  id: number;
  name: string;
  /** Sigla, quando o backend a manda. Nunca é a identidade: quem liga a doação é o `id`. */
  shortName: string | null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Uma linha do backend, seja qual for o nome que dê à sigla. */
function toOption(value: unknown): InstitutionOption | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const id = Number(row.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const name = text(row.name);
  if (!name) return null;
  const shortName = text(row.shortName) || text(row.short_name) || text(row.acronym) || text(row.code);
  return { id, name, shortName: shortName || null };
}

function rowsOf(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const wrapper = payload as Record<string, unknown>;
    for (const key of ['institutions', 'items', 'content', 'data']) {
      if (Array.isArray(wrapper[key])) return wrapper[key] as unknown[];
    }
  }
  return [];
}

/**
 * As escolas de uma resposta do backend, sem repetidos e por ordem de nome.
 *
 * O que não tem id positivo e nome fica de fora: uma linha torta não pode
 * substituir o texto livre por uma escolha que não liga a nada.
 */
export function parseInstitutions(payload: unknown): InstitutionOption[] {
  const byId = new Map<number, InstitutionOption>();
  for (const row of rowsOf(payload)) {
    const option = toOption(row);
    if (option && !byId.has(option.id)) byId.set(option.id, option);
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt', { sensitivity: 'base' }));
}

/**
 * A escola da sessão na resposta de `/api/doar/institution`.
 *
 * A rota devolve `{ institution }`, mas o `/me` do backend chama-lhe `school`:
 * aceitam-se os dois nomes para o contrato não depender do embrulho.
 */
export function parseSessionInstitution(payload: unknown): InstitutionOption | null {
  if (!payload || typeof payload !== 'object') return null;
  const wrapper = payload as Record<string, unknown>;
  return toOption(wrapper.institution ?? wrapper.school);
}

/** Sem acentos nem maiúsculas: «itel» encontra «ITEL» e «educacao» encontra «Educação». */
export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** As escolas que respondem à pesquisa, pelo nome ou pela sigla. */
export function filterInstitutions(list: readonly InstitutionOption[], query: string): InstitutionOption[] {
  const needle = normalizeSearch(query);
  if (!needle) return [...list];
  return list.filter(
    (option) =>
      normalizeSearch(option.name).includes(needle) ||
      (option.shortName !== null && normalizeSearch(option.shortName).includes(needle)),
  );
}

/** O nome a mostrar no combobox: «Instituto de Telecomunicações (ITEL)». */
export function institutionLabel(option: InstitutionOption): string {
  return option.shortName && option.shortName !== option.name ? `${option.name} (${option.shortName})` : option.name;
}
