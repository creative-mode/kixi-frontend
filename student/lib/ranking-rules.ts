import type { RankingScope } from './ranking';

/** Regras de apresentação do ranking (#117/#121/#31), sem servidor e sem React.
 *  As notas e as posições já vêm prontas do backend - isto só formata. */

export const SCOPE_LABEL: Record<RankingScope, string> = {
  class: 'Turma',
  school: 'Escola',
  friends: 'Amigos',
  global: 'Global',
};

export function formatAverage(value: number | null): string {
  return value == null ? '—' : value.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** "5.º de 28" - null quando o aluno ainda não tem nota rankeável (myPosition null),
 *  porque "5.º" sem nota própria seria inventado. */
export function myPositionLabel(myPosition: number | null, totalStudents: number): string | null {
  if (myPosition == null) return null;
  return `${myPosition}.º de ${totalStudents}`;
}

/** A regra de grupo pequeno (#117) esconde o pódio e corta as últimas posições:
 *  quando isso acontece, a lista de `entries` é só os vizinhos do aluno, nunca
 *  a turma toda - esta frase explica o porquê em vez de deixar parecer incompleta. */
export function smallGroupNote(smallGroup: boolean): string | null {
  return smallGroup
    ? 'Este grupo é pequeno: por isso só mostramos quem está perto de ti, sem revelar os últimos lugares.'
    : null;
}
