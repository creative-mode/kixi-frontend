/**
 * Tabela única de motivos de proibição (403) — usada na página canónica da landing.
 *
 * Cada motivo define a mensagem exibida e o destino do botão primário e
 * secundário, coerente com a app de origem do utilizador:
 *  - `role`: conta com papel, mas sem acesso a esta área (gestor).
 *  - `student-manager`: aluno a tentar aceder ao gestor.
 *  - `manager`: gestor/admin a tentar aceder ao aluno.
 *  - Qualquer outro valor (`unknown`, vazio, `undefined`) cai no fallback
 *    neutro com o botão primário «Voltar ao início».
 *
 * Os destinations (`MANAGER_HOME`, `STUDENT_HOME`) espelham os de
 * `landing/lib/session-destination.ts` para não duplicar rotas entre ficheiros.
 */

export type ForbiddenReason = 'role' | 'student-manager' | 'manager';

export type ForbiddenReasonConfig = {
  message: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
};

/** Espelho de `landing/lib/session-destination.ts` (mesma origem, mesmas rotas). */
const MANAGER_HOME = '/manager';
const STUDENT_HOME = '/aluno/inicio';

const FALLBACK: ForbiddenReasonConfig = {
  message: 'Não tens permissão para abrir esta página.',
  primary: { href: '/', label: 'Voltar ao início' },
};

export const FORBIDDEN_REASONS: Record<ForbiddenReason, ForbiddenReasonConfig> = {
  role: {
    message: 'Esta área é para quem gere o Kixi. O teu acesso chega até aqui.',
    primary: { href: MANAGER_HOME, label: 'Ir para o meu painel' },
    secondary: { href: '/', label: 'Ver o site' },
  },
  'student-manager': {
    message: 'Esta área é para quem gere o Kixi. O teu acesso é do lado dos alunos.',
    primary: { href: STUDENT_HOME, label: 'Ir para o meu painel' },
    secondary: { href: '/', label: 'Ver o site' },
  },
  manager: {
    message: 'Esta área é para alunos. O teu acesso é do lado do gestor.',
    primary: { href: MANAGER_HOME, label: 'Ir para o meu painel' },
    secondary: { href: '/', label: 'Ver o site' },
  },
};

/**
 * Retorna a configuração de um motivo de proibição.
 * Motivos desconhecidos devolvem o fallback neutro.
 */
export function getForbiddenReason(reason: string | undefined): ForbiddenReasonConfig {
  const r = reason as ForbiddenReason | undefined;
  if (!r) return FALLBACK;
  return FORBIDDEN_REASONS[r] ?? FALLBACK;
}
