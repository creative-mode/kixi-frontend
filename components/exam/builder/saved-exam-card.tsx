'use client';

import Link from 'next/link';
import { Check, DoorOpen, FileText, Plus } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PendingFigurePublication, SavedExam } from './types';

/** O aviso de «prova guardada» / «prova publicada»: onde a prova ficou e como a pôr numa sala. */
export function SavedExamCard({
  saved, pendingPublication, onResume, onNewExam, saving,
}: {
  saved: SavedExam;
  pendingPublication: PendingFigurePublication | null;
  onResume: () => void;
  onNewExam: () => void;
  saving: boolean;
}) {
  return (
    <Card className="mb-6 border-primary/40 bg-accent/40 print:hidden" role="status" aria-live="polite">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Check className="size-4 text-primary" aria-hidden />{saved.published ? 'Prova publicada' : 'Prova guardada'}</CardTitle>
        <CardDescription>
          «{saved.title}» {pendingPublication ? 'continua oculta enquanto os recortes OCR não forem anexados e confirmados.' : saved.published ? 'já está disponível para os alunos simularem sozinhos.' : 'ficou oculta: publique-a para a poder dar a uma turma.'} A prova é dada a partir de um enunciado, numa sala: os alunos entram na sala e fazem a simulação.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {pendingPublication ? <Button onClick={onResume} disabled={saving}>{saving ? <Spinner className="size-4" /> : <Check aria-hidden />}{saving ? 'A retomar…' : 'Retomar anexação e publicação'}</Button> : null}
        {saved.published ? (
          <Button asChild><Link href={`/exam-rooms/new?statementId=${saved.id}`}><DoorOpen aria-hidden />Criar sala com esta prova</Link></Button>
        ) : null}
        {!pendingPublication ? <Button asChild variant="outline"><Link href={`/statements/${saved.id}`}><FileText aria-hidden />Ver o enunciado</Link></Button> : null}
        <Button variant="ghost" disabled={pendingPublication !== null} onClick={onNewExam}>
          <Plus aria-hidden />Nova prova
        </Button>
      </CardContent>
    </Card>
  );
}
