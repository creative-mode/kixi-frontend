import Link from 'next/link';
import type { CatalogItem } from '@/lib/catalog';

type Estado = 'dom' | 'apr' | 'fra' | 'nov';

/** O estado de uma prova pela nota (0–20): sem nota ainda é «por treinar». */
function estadoDe(item: CatalogItem): { estado: Estado; label: string; pct: number | null } {
  const nota = item.score ? Number(item.score.replace(',', '.')) : NaN;
  if (item.state === 'done' && Number.isFinite(nota)) {
    const pct = Math.round((nota / 20) * 100);
    if (pct >= 80) return { estado: 'dom', label: 'Dominado', pct };
    if (pct >= 50) return { estado: 'apr', label: 'A aprender', pct };
    return { estado: 'fra', label: 'A rever', pct };
  }
  if (item.state === 'progress') return { estado: 'apr', label: 'Em curso', pct: null };
  return { estado: 'nov', label: 'Ainda não treinaste', pct: null };
}

/** Por ordem de urgência: o que está por rever primeiro, o dominado no fim. */
const ORDEM: Record<Estado, number> = { fra: 0, apr: 1, nov: 2, dom: 3 };

/**
 * O ecrã «Provas» da nova experiência: separadores por disciplina e, por baixo, o que há para treinar
 * em cada uma (as provas do catálogo, com o estado tirado da nota). O catálogo completo, com pesquisa
 * e filtros, fica a um toque, em «Fazer um enunciado completo».
 */
export function ProvasTemas({ items, total, materia }: { items: CatalogItem[]; total: number; materia: string | null }) {
  const subjects = [...new Set(items.map((i) => i.subject).filter(Boolean))];
  const ativa = materia && subjects.includes(materia) ? materia : subjects[0] ?? null;
  const lista = items.filter((i) => i.subject === ativa).map((i) => ({ item: i, ...estadoDe(i) })).sort((a, b) => ORDEM[a.estado] - ORDEM[b.estado]);

  return (
    <div className="flex min-w-0 flex-col px-4 pt-3 pb-24 md:px-0 md:pt-7 md:pb-12">
      {subjects.length > 0 && (
        <nav aria-label="Disciplinas" className="flex gap-1 overflow-x-auto border-b border-[#e4e7e1]">
          {subjects.map((s) => (
            <Link
              key={s}
              href={`/provas/preparar?materia=${encodeURIComponent(s)}`}
              aria-current={s === ativa ? 'page' : undefined}
              className="-mb-px shrink-0 border-b-2 border-transparent px-3.5 py-3 text-[15px] font-bold text-[#617066] no-underline aria-[current=page]:border-[#1f5a2c] aria-[current=page]:text-[#121c15]"
            >
              {s}
            </Link>
          ))}
        </nav>
      )}

      <h1 className="m-0 mt-8 text-[26px] leading-tight font-extrabold tracking-[-0.02em]">O que sai na prova</h1>
      <p className="m-0 mt-1 mb-5 text-sm text-[#617066]">Clica numa prova para treinar só essa</p>

      <ul className="m-0 flex list-none flex-col border-t border-[#e4e7e1] p-0">
        {lista.map(({ item, estado, label, pct }) => (
          <li key={item.id} className="border-b border-[#e4e7e1]">
            <Link prefetch={false} href={`/prova/${item.id}/detalhe`} className="flex items-center gap-3.5 py-3.5 text-[#121c15] no-underline">
              <span className={`st ${estado}`} style={{ width: 24, height: 24 }}>
                {estado === 'dom' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={`text-[17px] leading-tight ${estado === 'fra' ? 'font-bold' : ''}`}>{item.title}</span>
                <span className="text-sm" style={estado === 'fra' ? { color: '#c2383e', fontWeight: 600 } : { color: '#617066' }}>{label}</span>
              </span>
              {pct != null && <span className="text-sm text-[#617066]">{pct}%</span>}
            </Link>
          </li>
        ))}
        {lista.length === 0 && <li className="py-6 text-sm text-[#617066]">Ainda não há provas para esta disciplina.</li>}
      </ul>

      <Link href="/provas" className="mt-9 flex items-center gap-4 rounded-[20px] border border-[#e9ebe7] bg-white px-6 py-[18px] text-[#121c15] no-underline">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>
        <span className="flex flex-1 flex-col"><strong className="text-base">Fazer um enunciado completo</strong><span className="text-sm text-[#617066]">{total} provas reais, da tua e de outras escolas</span></span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7a857d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
      </Link>
    </div>
  );
}
