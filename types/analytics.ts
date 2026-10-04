// Mirrors ao.creativemode.kixi.analytics.dto.* of the backend (GET /api/v1/analytics/*).
// Percentages are 0–100 with one decimal; null means "no data yet" (never 0).

export interface OverviewStatements {
  total: number;
  published: number;
  needingReview: number;
  missingAnswerKey: number;
}

export interface OverviewSimulations {
  total: number;
  finished: number;
  inProgress: number;
  cancelled: number;
  uniqueStudents: number;
}

export interface Overview {
  scope: 'ADMIN' | 'TEACHER';
  institutions: number;
  classes: number;
  students: number;
  teachers: number;
  statements: OverviewStatements;
  simulations: OverviewSimulations;
  averageScorePercent: number | null;
  passRatePercent: number | null;
  averageTimeSeconds: number | null;
}

export interface ActivityPoint {
  date: string; // yyyy-MM-dd (UTC)
  finished: number;
  averageScorePercent: number | null;
}

export interface InstitutionStats {
  id: number;
  code: string;
  name: string;
  courses: number;
  classes: number;
  students: number;
  finishedSimulations: number;
  averageScorePercent: number | null;
  averageTimeSeconds: number | null;
}

export interface ClassStats {
  id: number;
  code: string | null;
  grade: number;
  course: string;
  institution: string | null;
  students: number;
  teachers: number;
  statements: number;
  finishedSimulations: number;
  averageScorePercent: number | null;
  averageTimeSeconds: number | null;
}

export interface StatementStats {
  id: number;
  title: string | null;
  examType: string | null;
  classCode: string | null;
  subject: string | null;
  published: boolean;
  needsReview: boolean;
  answerKeyComplete: boolean;
  questions: number;
  finishedSimulations: number;
  uniqueStudents: number;
  averageScorePercent: number | null;
  passRatePercent: number | null;
  averageTimeSeconds: number | null;
}

export interface QuestionStats {
  id: number;
  number: number;
  text: string;
  questionType: string;
  maxScore: number | null;
  attempts: number;
  answered: number;
  correct: number;
  /** Unanswered counts as wrong; null for questions that are not auto-graded. */
  correctPercent: number | null;
}

/** A dashboard section either loaded or failed on its own; one failure must not blank the page. */
export type Section<T> = { ok: true; data: T } | { ok: false; error: string };

export interface Dashboard {
  overview: Section<Overview>;
  activity: Section<ActivityPoint[]>;
  institutions: Section<InstitutionStats[]>;
  classes: Section<ClassStats[]>;
  statements: Section<StatementStats[]>;
  loadedAt: string;
}
