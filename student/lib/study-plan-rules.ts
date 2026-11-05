/** O "plano até à prova" do início (kixi#728): um percurso de 4 passos até à próxima sala
 *  de prova agendada — diagnóstico, treino do tema mais fraco, simulação completa e a
 *  própria prova. Puro para o `node --test` o alcançar, como `home-rules.ts`.
 *
 *  Não há um calendário de provas por si: a única "próxima prova" que o backend conhece é
 *  uma sala de prova (convite do professor). Sem nenhum convite por abrir, não há plano. */

import { parseServerTime } from './exam-rules.ts';
import { phaseOf, sortInvitations, type Invitation } from './exam-room-rules.ts';
import { upcomingInvitations } from './home-rules.ts';
import type { Performance } from './performance-rules.ts';

export type StudyPlanStepId = 'diagnostic' | 'training' | 'simulation' | 'exam';
export type StudyPlanStepStatus = 'done' | 'current' | 'future';

export interface StudyPlanStep {
  id: StudyPlanStepId;
  status: StudyPlanStepStatus;
  title: string;
  description: string;
  href: string | null;
  linkLabel: string | null;
}

export interface StudyPlan {
  day: string;
  month: string;
  title: string;
  meta: string;
  daysLabel: string;
  steps: StudyPlanStep[];
}

/** O fuso fixo do servidor (`SERVER_OFFSET` em exam-rules.ts), em milissegundos. */
const SERVER_OFFSET_MS = 60 * 60 * 1000;

/** O dia de calendário (AAAA-MM-DD) de um instante, na hora do servidor. */
function serverDateKey(ms: number): string {
  return new Date(ms + SERVER_OFFSET_MS).toISOString().slice(0, 10);
}

/** "Hoje" / "Amanhã" / "Daqui a N dias", pelo dia de calendário até `startsAt` — uma
 *  prova às 23h59 de hoje ainda é "Hoje", não "em 0 dias" por faltarem só minutos. */
export function daysLabelOf(startsAt: string, now = Date.now()): string {
  const diffDays = Math.round((Date.parse(serverDateKey(parseServerTime(startsAt))) - Date.parse(serverDateKey(now))) / 86_400_000);
  if (diffDays <= 0) return 'Hoje';
  if (diffDays === 1) return 'Amanhã';
  return `Daqui a ${diffDays} dias`;
}

/**
 * O plano até à próxima prova agendada, ou `null` sem nenhuma por abrir.
 *
 * O passo 1 (diagnóstico) é a tentativa mais recente, se houver; o 2 é o treino do tema
 * mais fraco (`performance.mastery[0]`, já ordenado do mais fraco para o mais forte); o 3
 * é uma simulação completa, sempre futuro; o 4 é a prova em si. Sem nenhuma tentativa
 * ainda, o passo 1 fica "a fazer" em vez de "feito", e o 2 não avança à frente dele.
 */
export function buildStudyPlan(invitations: Invitation[], performance: Performance, now = Date.now()): StudyPlan | null {
  const pending = sortInvitations([...invitations]).filter((inv) => ['scheduled', 'lobby', 'live'].includes(phaseOf(inv, now)));
  if (pending.length === 0) return null;
  const exam = pending[0];
  const soon = upcomingInvitations(invitations, 1)[0];
  if (!soon) return null;

  const lastActivity = performance.activity[0] ?? null;
  const weakest = performance.mastery[0] ?? null;
  const diagnosticDone = lastActivity != null;

  const steps: StudyPlanStep[] = [
    {
      id: 'diagnostic',
      status: diagnosticDone ? 'done' : 'current',
      title: lastActivity ? lastActivity.title : 'Faz uma prova para começar',
      description: lastActivity ? `Feito, ${lastActivity.score} valores` : 'O tutor precisa de uma tentativa para saber onde começar.',
      href: lastActivity ? `/resultado?prova=${lastActivity.id}` : null,
      linkLabel: lastActivity ? 'Ver' : null,
    },
    {
      id: 'training',
      status: diagnosticDone ? 'current' : 'future',
      title: weakest ? `Treinar ${weakest.label}` : 'Treinar o tema mais fraco',
      description: weakest
        ? `É onde tens tido mais dificuldade (${weakest.value}%).`
        : 'Aparece aqui depois da primeira prova corrigida.',
      href: weakest ? `/tutor?statementId=${weakest.id}` : null,
      linkLabel: weakest ? 'Começar o treino' : null,
    },
    {
      id: 'simulation',
      status: 'future',
      title: 'Simulação completa',
      description: 'Uma prova inteira, com tempo, como no dia.',
      href: '/provas',
      linkLabel: null,
    },
    {
      id: 'exam',
      status: 'future',
      title: exam.statementTitle ?? 'Prova',
      description: soon.meta,
      href: null,
      linkLabel: null,
    },
  ];

  return { day: soon.day, month: soon.month, title: soon.title, meta: soon.meta, daysLabel: daysLabelOf(exam.startsAt, now), steps };
}
