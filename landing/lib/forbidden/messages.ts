import { LOGIN_URL } from '@/lib/content';
import { isForbiddenReason, type ForbiddenReason } from './reasons';

export const STUDENT_HOME = '/aluno/inicio';
export const MANAGER_EXAM_BUILDER = '/manager/exam-builder';
export const MANAGER_PROFESSOR = '/professor';
export const MANAGER_HOME = '/manager';

export type ForbiddenAction = {
  href: string;
  label: string;
};

export type ForbiddenCopy = {
  hint: string;
  primary: ForbiddenAction;
  secondary: ForbiddenAction;
};

const NEUTRAL_COPY: ForbiddenCopy = {
  hint: 'Esta porta não abre para esta conta.',
  primary: { href: '/', label: 'Voltar ao início' },
  secondary: { href: LOGIN_URL, label: 'Entrar noutra conta' },
};

const COPY_BY_REASON: Record<ForbiddenReason, ForbiddenCopy> = {
  role: {
    hint: 'Esta área é para quem gere o Kixi. O teu acesso chega até aqui.',
    primary: { href: MANAGER_PROFESSOR, label: 'Voltar ao meu painel' },
    secondary: { href: '/', label: 'Ver o site' },
  },
  'student-manager': {
    hint: 'Esta área é para quem gere o Kixi. O teu acesso chega até aqui.',
    primary: { href: MANAGER_PROFESSOR, label: 'Voltar ao meu painel' },
    secondary: { href: STUDENT_HOME, label: 'Ir para o caminho certo' },
  },
  manager: {
    hint: 'Esta área é do lado dos alunos. O teu acesso não chega aqui.',
    primary: { href: STUDENT_HOME, label: 'Ir para o caminho certo' },
    secondary: { href: LOGIN_URL, label: 'Entrar noutra conta' },
  },
};

export function getForbiddenCopy(reason: string | string[] | undefined): ForbiddenCopy {
  const raw = Array.isArray(reason) ? reason[0] : reason;
  if (!isForbiddenReason(raw)) {
    return NEUTRAL_COPY;
  }
  return COPY_BY_REASON[raw];
}
