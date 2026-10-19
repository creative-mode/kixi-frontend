import 'server-only';

import { apiGet, type Result } from './api';
import { parseExperience, type ExperienceEntry } from './experience-rules';

/** A cronologia pública de uma conta. Um 404 (backend sem a rota) conta como «sem experiência», não como erro. */
export async function getExperience(accountId: number): Promise<Result<ExperienceEntry[]>> {
  const r = await apiGet<unknown>(`/profiles/${accountId}/experience`);
  if (r.ok) return { ok: true, data: parseExperience(r.data) };
  return r.status === 404 ? { ok: true, data: [] } : r;
}
