/** Regras do HUD de gamificação (#118/#33), sem servidor e sem React, para
 *  `node --test` as alcançar. O nível e o XP em si são sempre do backend
 *  (GET /me/stats); nada aqui decide quando o aluno sobe de nível. */

/** Quanto da barra do nível atual já está preenchido, 0–100.
 *
 *  100 XP por nível é só o desenho da barra — se o backend mudar a curva, a barra
 *  fica errada visualmente, mas nunca inventa um nível que o backend não deu. */
export function levelProgress(xp: number, level: number): number {
  const into = xp - (level - 1) * 100;
  return Math.max(0, Math.min(100, into));
}
