/** Contrato de leitura das salas da instituição para o coordenador (kixi#529). */

export interface CoordinationRoom {
  id: number;
  status: 'DRAFT' | 'OPEN' | 'RUNNING' | 'CLOSED';
  /** A fase derivada (kixi#592/#750); o mock e o backend devolvem-na sempre. */
  phase?: 'SCHEDULED' | 'ONGOING' | 'ENDED' | null;
  startsAt: string;
  endsAt: string;
  className: string;
  statementTitle: string;
  teacherAccountId: number;
  teacherName: string | null;
  participants: number;
  finished: number;
  pendingAnswers: number;
}

export interface CoordinationGrade {
  accountId: number;
  name: string | null;
  status: string | null;
  finalScore: number | null;
  pendingAnswers: number;
}
