export type NavIconName = 'inicio' | 'provas' | 'explorar' | 'turma' | 'notificacoes';

const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/**
 * Os ícones da navegação, copiados do protótipo «nova experiência»: contorno quando inativo e
 * preenchido quando ativo. No computador o Explorar é uma bússola; no telemóvel, uma lupa.
 */
export function NavIcon({ name, active = false, size = 24, desktop = false }: { name: NavIconName; active?: boolean; size?: number; desktop?: boolean }) {
  const box = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true } as const;
  if (name === 'inicio') {
    return active
      ? <svg {...box} fill="currentColor"><path d="M2.4 9.7 11.4 2.2a1 1 0 0 1 1.2 0l9 7.5a1 1 0 0 1 .4.8V20a2 2 0 0 1-2 2h-5a1 1 0 0 1-1-1v-5h-4v5a1 1 0 0 1-1 1H4a2 2 0 0 1-2-2v-9.5a1 1 0 0 1 .4-.8z" /></svg>
      : <svg {...box} {...STROKE}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>;
  }
  if (name === 'provas') {
    return active
      ? <svg {...box}><path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="currentColor" /><path d="M14 2v6h6" fill="none" stroke="#ffffff" strokeWidth={1.6} strokeLinejoin="round" /></svg>
      : <svg {...box} {...STROKE}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>;
  }
  if (name === 'explorar') {
    if (desktop) {
      return <svg {...box} {...STROKE} strokeWidth={1.9} fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></svg>;
    }
    return active
      ? <svg {...box}><circle cx="11" cy="11" r="8" fill="currentColor" /><circle cx="11" cy="11" r="4.2" fill="#ffffff" /><path d="m20.5 20.5-4-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" /></svg>
      : <svg {...box} {...STROKE}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
  }
  if (name === 'turma') {
    return active
      ? <svg {...box} fill="currentColor"><circle cx="9" cy="7.5" r="4" /><path d="M1.5 20.5a7.5 7.5 0 0 1 15 0 1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1z" /><circle cx="17" cy="8" r="3" /><path d="M17.8 13.1a6 6 0 0 1 4.7 7.4 1 1 0 0 1-1 .9h-3.3a9 9 0 0 0-3.2-7.6 6 6 0 0 1 2.8-.7z" /></svg>
      : <svg {...box} {...STROKE}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></svg>;
  }
  return <svg {...box} {...STROKE} fill={active ? 'currentColor' : 'none'}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>;
}
