import 'server-only';

import { apiGet, type Result } from './api';
import { getCatalog, getCatalogNames, type CatalogItem } from './catalog';

/** GET /profiles/search (InstitutionCard). */
export interface SchoolCard {
  id: number;
  code: string;
  name: string;
  shortName: string | null;
  logo: string | null;
  verified: boolean;
}

/** GET /profiles/institutions/{id} (InstitutionProfile). */
export interface SchoolProfile extends SchoolCard {
  verifiedAt: string | null;
  teacherCount: number;
  studentCount: number;
  statementCount: number;
}

/** GET /profiles/institutions/{id}/teachers (TeacherCard). */
export interface TeacherCard {
  id: number;
  accountId: number | null;
  displayName: string;
  photo: string | null;
  specialty: string | null;
  verified: boolean;
}

/** GET /profiles/accounts/{id} (PersonProfile). Com `restricted`, só nome e foto vêm preenchidos. */
export interface PersonProfile {
  userId: number;
  displayName: string;
  photo: string | null;
  kind: string;
  verified: boolean;
  restricted: boolean;
  visibility: string;
  schools: SchoolCard[];
  level: number | null;
  xp: number | null;
  badges: string[];
}

export type Visibility = 'public' | 'school' | 'private';

export const getSchool = (id: number) => apiGet<SchoolProfile>(`/profiles/institutions/${id}`);
export const getSchoolTeachers = (id: number) => apiGet<TeacherCard[]>(`/profiles/institutions/${id}/teachers`);
export const getPerson = (accountId: number) => apiGet<PersonProfile>(`/profiles/accounts/${accountId}`);
export const getMyVisibility = () => apiGet<{ visibility: Visibility }>('/profiles/me/visibility');

/** Procura escolas pelo nome ou código. Abaixo de 2 letras não pergunta ao servidor. */
export async function searchSchools(q: string): Promise<Result<SchoolCard[]>> {
  const term = q.trim();
  if (term.length < 2) return { ok: true, data: [] };
  return apiGet<SchoolCard[]>('/profiles/search', { q: term });
}

/** Os enunciados de uma escola, pelo catálogo filtrado por `institutionId`. */
export async function getSchoolStatements(id: number): Promise<CatalogItem[]> {
  const names = await getCatalogNames();
  const page = await getCatalog({ institutionId: id, size: 20 }, names);
  return page.ok ? page.items : [];
}
