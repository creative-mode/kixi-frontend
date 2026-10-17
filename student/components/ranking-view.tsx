'use client';

import { useState, useTransition } from 'react';
import { Users } from 'lucide-react';
import { Column, Page, PageHeader } from '@/components/page';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/states';
import { UserAvatar } from '@/components/user-avatar';
import { fetchLeaderboardAction, setConsentAction } from '@/lib/ranking-actions';
import { FriendsPanel } from '@/components/friends-panel';
import { Button } from '@/components/ui/button';
import { formatAverage, myPositionLabel, smallGroupNote, SCOPE_LABEL } from '@/lib/ranking-rules';
import type { Leaderboard, RankingScope } from '@/lib/ranking';

const SCOPES: RankingScope[] = ['class', 'school', 'friends', 'global'];

/** O ranking real (#117/#121/#31): turma, escola, amigos e global. O global cruza escolas e
 *  só abre depois de o aluno consentir (403 até lá); retirar o consentimento volta a fechá-lo. */
export function RankingView({
  initial,
  error,
}: {
  initial: Leaderboard | null;
  error: string | null;
}) {
  const [scope, setScope] = useState<RankingScope>('class');
  const [board, setBoard] = useState(initial);
  const [boardError, setBoardError] = useState(error);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [pending, startTransition] = useTransition();

  const load = (next: RankingScope) =>
    startTransition(async () => {
      const result = await fetchLeaderboardAction(next);
      if (result.ok) {
        setBoard(result.data);
        setBoardError(null);
        setNeedsConsent(false);
      } else {
        setBoard(null);
        // O 403 do scope global é "falta o consentimento", não uma falha.
        setNeedsConsent(next === 'global' && result.status === 403);
        setBoardError(next === 'global' && result.status === 403 ? null : result.message);
      }
    });

  const changeScope = (next: RankingScope) => {
    setScope(next);
    load(next);
  };

  const consent = (crossInstitution: boolean) =>
    startTransition(async () => {
      const result = await setConsentAction(crossInstitution);
      if (!result.ok) {
        setBoardError(result.message);
        return;
      }
      load('global');
    });

  return (
    <Page variant="wide">
      <Column className="gap-5">
        <PageHeader
          title={`Ranking · ${SCOPE_LABEL[scope]}`}
          description="Média das simulações deste período. Vês o topo e quem está perto de ti."
        />
        <Tabs value={scope} onValueChange={(v) => changeScope(v as RankingScope)}>
          <TabsList aria-label="Comparar com">
            {SCOPES.map((s) => <TabsTrigger key={s} value={s} aria-controls={undefined}>{SCOPE_LABEL[s]}</TabsTrigger>)}
          </TabsList>
        </Tabs>

        {scope === 'global' && needsConsent ? (
          <Card className="gap-3 px-5 py-6">
            <b>Comparar-te com alunos de outras escolas</b>
            <p className="text-sm text-muted-foreground">
              Só entras neste ranking se disseres que sim. Mostramos a tua posição dentro da tua própria
              escola e o nome abreviado; podes retirar o consentimento quando quiseres.
            </p>
            <div><Button disabled={pending} onClick={() => consent(true)}>Quero participar</Button></div>
          </Card>
        ) : boardError ? (
          <Alert variant="destructive">{boardError}</Alert>
        ) : !board || board.entries.length === 0 ? (
          <Card>
            <EmptyState
              title={scope === 'friends' ? 'Ainda não há dados dos teus amigos' : 'Ainda não há dados'}
              message={scope === 'friends'
                ? 'Aparecem aqui quando os teus amigos tiverem provas corrigidas. Convida colegas abaixo.'
                : 'Aparecem aqui quando houver provas corrigidas neste grupo.'}
            />
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4" aria-hidden />
              {myPositionLabel(board.myPosition, board.totalStudents) ?? 'Ainda sem nota para te posicionar'}
              {board.myAverage != null && <span>· A tua média: {formatAverage(board.myAverage)}</span>}
              {scope === 'global' && board.myPercentile != null && <span>· Percentil na tua escola: {formatAverage(board.myPercentile)}</span>}
            </div>
            {smallGroupNote(board.smallGroup) && (
              <p className="text-sm text-muted-foreground">{smallGroupNote(board.smallGroup)}</p>
            )}
            <Card className={pending ? 'overflow-hidden py-0 opacity-60' : 'overflow-hidden py-0'}>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Aluno</TableHead>
                    <TableHead className="text-right">Média</TableHead>
                    {scope === 'global' && <TableHead className="text-right">Percentil</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {board.entries.map((entry) => (
                    <TableRow key={entry.position} className={entry.me ? 'bg-accent font-bold hover:bg-accent' : undefined}>
                      <TableCell className="font-semibold text-muted-foreground tabular-nums">{entry.position}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-3">
                          <UserAvatar name={entry.displayName} size={32} />
                          {entry.displayName}{entry.me ? ' (tu)' : ''}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatAverage(entry.average)}</TableCell>
                      {scope === 'global' && <TableCell className="text-right tabular-nums">{formatAverage(entry.percentile ?? null)}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </>
        )}

        {scope === 'global' && !needsConsent && !boardError && (
          <div><Button variant="outline" size="sm" disabled={pending} onClick={() => consent(false)}>Deixar de participar no ranking global</Button></div>
        )}

        {scope === 'friends' && <FriendsPanel onChange={() => load('friends')} />}
      </Column>
    </Page>
  );
}
