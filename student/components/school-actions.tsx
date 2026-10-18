'use client';

import { useCallback } from 'react';

import { ReportBlock } from './report-block';
import { reportSchoolAction } from '@/lib/moderation-actions';

/** Liga a denúncia de escola à server action. Sem bloqueio: uma escola bloqueia-se
 *  a si própria, e não há nada de simétrico para fazer. */
export function SchoolActions({ institutionId, nome }: { institutionId: number; nome: string }) {
  const denunciar = useCallback(
    (reason: string, note: string) => reportSchoolAction(institutionId, reason, note),
    [institutionId],
  );

  return (
    <div className="border-t pt-4">
      <ReportBlock target="INSTITUTION" targetId={institutionId} nome={nome} onReport={denunciar} />
    </div>
  );
}