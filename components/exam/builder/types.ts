/** Tipos partilhados entre o construtor de provas e os seus painéis. */
import type { figuresOf } from '@/lib/exam/draft';

/** A prova que acabou de ser guardada: serve para dizer onde está e para a poder dar a uma turma. */
export interface SavedExam { id: number; title: string; published: boolean; snapshot: string; savedAt: string }

/** Recorte do OCR que ficou por anexar; a publicação fica pendente até anexar e confirmar. */
export interface PendingFigurePublication extends SavedExam { figures: ReturnType<typeof figuresOf>; publish: boolean }
