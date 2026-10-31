/** Contrato do plano do trimestre (kixi#523): P1, P2 e as avaliações de MAC, com o estado derivado pelo backend. */

export type AssessmentKind = 'P1' | 'P2' | 'MAC';
export type AssessmentStatus = 'PLANNED' | 'STATEMENT_READY' | 'ROOM_OPEN' | 'DONE' | 'GRADED' | 'DISPENSED';
export type ReminderLevel = 'LATE' | 'D2' | 'D7' | 'D14';
export type ReminderAction = 'BUILD_STATEMENT' | 'OPEN_ROOM';

export interface Assessment {
  id: number;
  kind: AssessmentKind;
  seq: number;
  title: string;
  plannedDate: string;
  statementId: number | null;
  roomId: number | null;
  status: AssessmentStatus;
  dispensedReason: string | null;
  daysLeft: number;
}

export interface TermPlan {
  id: number;
  classId: number;
  className: string;
  subjectId: number;
  subjectName: string;
  termId: number;
  termNumber: number;
  institutionId: number | null;
  approved: boolean;
  schedulingConcluded: boolean;
  readyForPauta: boolean;
  pautaOpened: boolean;
  pautaRef: string | null;
  assessments: Assessment[];
}

export interface Reminder {
  planId: number;
  assessmentId: number;
  kind: AssessmentKind;
  title: string;
  plannedDate: string;
  daysLeft: number;
  action: ReminderAction;
  level: ReminderLevel;
  className: string;
  subjectName: string;
}

export interface PlanDraft {
  classId: number;
  subjectId: number;
  termId: number;
  p1Date: string;
  p2Date: string;
  macCount: number;
  macDates: string[];
  macTitles: string[];
}
