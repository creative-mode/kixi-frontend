import 'server-only';

import { apiGet, type Result } from './api';
import type { MyTermSheet } from './pautas-rules';

export type { MyTermSheet } from './pautas-rules';

/** As pautas do próprio aluno: o backend devolve só a sua linha, só de pautas fechadas (kixi#506). */
export function getMyTermSheets(): Promise<Result<MyTermSheet[]>> {
  return apiGet<MyTermSheet[]>('/me/term-sheets');
}
