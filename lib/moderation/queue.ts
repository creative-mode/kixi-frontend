/** Os separadores da moderação (por decidir e decididas) e as contagens: sem React, testável com `node --test`. */
import type { Report } from './model.ts';

export type ModerationFilter = 'por-decidir' | 'decididas';

export const MODERATION_FILTERS: { key: ModerationFilter; label: string }[] = [
  { key: 'por-decidir', label: 'Por decidir' },
  { key: 'decididas', label: 'Decididas' },
];

export const MODERATION_FILTER_KEYS = MODERATION_FILTERS.map((f) => f.key);
export const DEFAULT_MODERATION_FILTER: ModerationFilter = 'por-decidir';

/** A lista das decididas cresce sem fim: mostra-se por páginas. */
export const DECIDED_PAGE_SIZE = 10;

export function moderationCounts(reports: readonly Pick<Report, 'status'>[]): Record<ModerationFilter, number> {
  const open = reports.filter((r) => r.status === 'OPEN').length;
  return { 'por-decidir': open, decididas: reports.length - open };
}
