import type { CatalogItem } from './catalog.ts';

/** O estado de uma prova no ecrã «Provas»: pela nota, mas sempre sobre a cotação da
 *  prova — nunca sobre 20 (#820). Uma prova de 25 pontos com 17,75 está a 71%, não a 89%. */

export type EstadoDaProva = 'dom' | 'apr' | 'fra' | 'nov';

export function estadoDaProva(item: CatalogItem): { estado: EstadoDaProva; label: string; pct: number | null } {
  const nota = item.score ? Number(item.score.replace(',', '.')) : NaN;
  if (item.state === 'done' && Number.isFinite(nota)) {
    const total = item.maxScore != null && item.maxScore > 0 ? item.maxScore : 20;
    const pct = Math.max(0, Math.min(100, Math.round((nota / total) * 100)));
    if (pct >= 80) return { estado: 'dom', label: 'Dominado', pct };
    if (pct >= 50) return { estado: 'apr', label: 'A aprender', pct };
    return { estado: 'fra', label: 'A rever', pct };
  }
  // Entregue sem número (a nota é a do motor, só no resultado) ou com correção pendente.
  if (item.state === 'done' && item.correction) return { estado: 'apr', label: item.correction, pct: null };
  if (item.state === 'progress') return { estado: 'apr', label: 'Em curso', pct: null };
  return { estado: 'nov', label: 'Ainda não treinaste', pct: null };
}
