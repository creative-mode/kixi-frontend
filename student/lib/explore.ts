import 'server-only';

import { apiGet } from './api';
import { getCatalog, getCatalogNames, type CatalogItem } from './catalog';
import { getPerformance } from './performance';
import type { StatementDetail } from './statement-detail';

export interface CuratedEnunciados {
  subjectId: number;
  subjectName: string;
  items: CatalogItem[];
  total: number;
}

const CURATED_SIZE = 3;

/**
 * A secção "Para a tua prova de X" do Explorar (#728): a disciplina é a do tema mais
 * fraco do aluno — o mesmo que o "plano até à prova" do Início já usa para o treino —
 * e os enunciados mostrados são de OUTRAS escolas sobre essa disciplina. O ponto da
 * secção é mostrar o que lá fora se estuda e aqui não se vê, nunca repetir o que a
 * própria escola já publicou.
 *
 * `null` sem tentativa nenhuma ainda (sem "tema mais fraco" não há disciplina a sugerir),
 * sem a disciplina do enunciado, ou sem nenhum enunciado de outra escola para a mostrar.
 */
export async function curatedEnunciados(mySchoolId: number | null): Promise<CuratedEnunciados | null> {
  const performance = await getPerformance();
  const weakest = performance.mastery[0];
  if (!weakest) return null;

  const [statement, names] = await Promise.all([
    apiGet<StatementDetail>(`/statements/${weakest.id}`),
    getCatalogNames(),
  ]);
  const subjectId = statement.ok ? statement.data.subjectId : null;
  if (subjectId == null) return null;
  const subjectName = names.subjects.find((s) => s.id === subjectId)?.name ?? '';
  if (!subjectName) return null;

  const page = await getCatalog({ subjectId, size: 100 }, names);
  if (!page.ok) return null;
  const others = page.items.filter((i) => i.schoolId !== mySchoolId && i.schoolId != null);
  if (others.length === 0) return null;

  return { subjectId, subjectName, items: others.slice(0, CURATED_SIZE), total: others.length };
}

/** Todos os enunciados de uma disciplina, de outras escolas — o link "Ver os N
 *  enunciados de X" abre nisto, nunca numa pesquisa por texto (o nome da disciplina
 *  não aparece no título de cada enunciado para a pesquisa de texto o encontrar). */
export async function enunciadosBySubject(
  subjectId: number,
  mySchoolId: number | null,
): Promise<{ subjectName: string; items: CatalogItem[] } | null> {
  const names = await getCatalogNames();
  const subjectName = names.subjects.find((s) => s.id === subjectId)?.name ?? '';
  if (!subjectName) return null;
  const page = await getCatalog({ subjectId, size: 100 }, names);
  if (!page.ok) return { subjectName, items: [] };
  return { subjectName, items: page.items.filter((i) => i.schoolId !== mySchoolId && i.schoolId != null) };
}

/** Enunciados de qualquer escola e disciplina, pelo texto pesquisado — a aba
 *  "Enunciados" quando o aluno escreve em vez de seguir a sugestão. */
export async function searchEnunciados(q: string): Promise<CatalogItem[]> {
  const names = await getCatalogNames();
  const page = await getCatalog({ q, size: 50 }, names);
  return page.ok ? page.items : [];
}
