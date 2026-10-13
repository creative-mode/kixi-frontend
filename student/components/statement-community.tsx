'use client';

import { useState, useTransition } from 'react';
import { Share2, Users } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/states';
import { UserAvatar } from '@/components/user-avatar';
import { bucketLabel, compareToAverage, formatScore, pctCorrectLabel } from '@/lib/community-rules';
import { filterSharedSolutionsAction, shareSolutionAction, unshareSolutionAction } from '@/lib/community-actions';
import type { CommunityStats, SharedSolution } from '@/lib/community';
import type { Named } from '@/lib/catalog';

export function StatementCommunity({
  statementId,
  simulationId,
  stats,
  solutions,
  schools,
  locked = false,
}: {
  statementId: number;
  /** A tentativa terminada do aluno - quem ainda não terminou não vê esta secção. */
  simulationId: number;
  stats: CommunityStats | null;
  solutions: SharedSolution[];
  schools: Named[];
  /** A prova tem uma sala por fechar: o backend recusa a comunidade até ela fechar. */
  locked?: boolean;
}) {
  const [list, setList] = useState(solutions);
  const [institutionId, setInstitutionId] = useState<number | undefined>(undefined);
  const [shared, setShared] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!stats || stats.sampleSize === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Comunidade</CardTitle></CardHeader>
        <CardContent>
          {locked ? (
            <EmptyState title="A comunidade abre mais tarde" message="Esta prova ainda tem uma sala por fechar. Quando fechar, vês aqui como a turma se saiu." />
          ) : (
            <EmptyState title="Ainda não há dados da comunidade" message="Aparecem aqui quando outros alunos também terminarem esta prova." />
          )}
        </CardContent>
      </Card>
    );
  }

  const comparison = compareToAverage(stats.mine?.finalScore ?? null, stats.meanScore);

  const filterBySchool = (value: string) => {
    const id = value ? Number(value) : undefined;
    setInstitutionId(id);
    startTransition(async () => {
      const result = await filterSharedSolutionsAction(statementId, id);
      if (result.ok) setList(result.solutions);
    });
  };

  const share = () => {
    setShareError(null);
    startTransition(async () => {
      const result = await shareSolutionAction(statementId, simulationId, true);
      if (result.ok) setShared(true);
      else setShareError(result.message ?? 'Não foi possível partilhar agora.');
    });
  };

  const unshare = () => {
    startTransition(async () => {
      const result = await unshareSolutionAction(statementId, simulationId);
      if (result.ok) setShared(false);
    });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2"><Users className="size-[18px]" aria-hidden />Comunidade</CardTitle>
        <Button type="button" size="sm" variant={shared ? 'outline' : 'default'} disabled={pending} onClick={shared ? unshare : share}>
          <Share2 />{shared ? 'Deixar de partilhar' : 'Partilhar a minha resolução'}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-5">
        {shareError && <Alert variant="destructive">{shareError}</Alert>}
        {shared && <Alert variant="success">A tua resolução está partilhada, de forma anónima.</Alert>}

        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">{stats.sampleSize} aluno{stats.sampleSize === 1 ? '' : 's'} já terminou{stats.sampleSize === 1 ? '' : 'aram'} esta prova</p>
          {comparison && <p className="font-semibold">{comparison}</p>}
        </div>

        {stats.scoreDistribution.length > 0 && (
          <div className="grid gap-2">
            <h3 className="text-sm font-semibold">Distribuição de notas</h3>
            {stats.scoreDistribution.map((b) => (
              <div key={b.index} className="grid grid-cols-[80px_1fr_auto] items-center gap-2.5 text-sm">
                <span className="text-muted-foreground">{bucketLabel(b.from, b.to)}</span>
                <Progress value={stats.sampleSize ? (b.count / stats.sampleSize) * 100 : 0} />
                <span className="tabular-nums text-muted-foreground">{b.count}</span>
              </div>
            ))}
          </div>
        )}

        {stats.questions.length > 0 && (
          <div className="grid gap-2">
            <h3 className="text-sm font-semibold">% de acerto por questão</h3>
            {stats.questions.map((q) => (
              <div key={q.questionId} className="grid grid-cols-[80px_1fr_auto] items-center gap-2.5 text-sm">
                <span className="text-muted-foreground">Questão {q.number ?? '—'}</span>
                <Progress value={q.pctCorrect ?? 0} />
                <span className="text-muted-foreground">{pctCorrectLabel(q.pctCorrect)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Resoluções partilhadas</h3>
            {schools.length > 0 && (
              <NativeSelect
                className="h-9 w-auto" aria-label="Filtrar por escola"
                value={institutionId ?? ''} onChange={(e) => filterBySchool(e.target.value)}
              >
                <option value="">Todas as escolas</option>
                {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </NativeSelect>
            )}
          </div>
          {list.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Ainda ninguém partilhou a resolução desta prova.</p>
          ) : (
            <ul className="grid gap-3">
              {list.map((s) => (
                <li key={s.shareId} className="flex items-center gap-3 rounded-lg border px-4 py-3">
                  <UserAvatar name={s.authorName ?? 'Anónimo'} size={36} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <b className="block text-sm">{s.authorName ?? 'Aluno anónimo'}</b>
                    {s.institution && <span className="text-[13px] text-muted-foreground">{s.institution.code}</span>}
                  </div>
                  {s.finalScore != null && <Badge variant="secondary">{formatScore(s.finalScore)}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
