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
import { fetchLeaderboardAction } from '@/lib/ranking-actions';
import { formatAverage, myPositionLabel, smallGroupNote, SCOPE_LABEL } from '@/lib/ranking-rules';
import type { Leaderboard, RankingScope } from '@/lib/ranking';

const SCOPES: RankingScope[] = ['class', 'school', 'friends'];

/** O ranking real (#117/#31), em vez das linhas fixas de lib/data.ts. "Amigos"
 *  não pede nada ao backend: chega com o kixi#121 (PR #204, ainda em revisão),
 *  e até lá o próprio endpoint responde 404 a esse scope. */
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
  const [pending, startTransition] = useTransition();

  const changeScope = (next: RankingScope) => {
    setScope(next);
    if (next === 'friends') return;
    startTransition(async () => {
      const result = await fetchLeaderboardAction(next);
      if (result.ok) {
        setBoard(result.data);
        setBoardError(null);
      } else {
        setBoard(null);
        setBoardError(result.message);
      }
    });
  };

  return (
    <Page variant="wide">
      <Column className="gap-5">
        <PageHeader
          title={`Ranking · ${SCOPE_LABEL[scope]}`}
          description="Média das simulações deste período. Vês o topo e quem está perto de ti."
        />
        <Tabs value={scope} onValueChange={(v) => changeScope(v as RankingScope)}>
          <TabsList aria-label="Comparar com">
            {SCOPES.map((s) => <TabsTrigger key={s} value={s}>{SCOPE_LABEL[s]}</TabsTrigger>)}
          </TabsList>
        </Tabs>

        {scope === 'friends' ? (
          <Card>
            <EmptyState
              title="O ranking de amigos chega em breve"
              message="Esta aba abre quando puderes adicionar amigos e comparar-te só com eles."
            />
          </Card>
        ) : boardError ? (
          <Alert variant="destructive">{boardError}</Alert>
        ) : !board || board.entries.length === 0 ? (
          <Card>
            <EmptyState
              title="Ainda não há dados"
              message="Aparecem aqui quando houver provas corrigidas nesta turma ou escola."
            />
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4" aria-hidden />
              {myPositionLabel(board.myPosition, board.totalStudents) ?? 'Ainda sem nota para te posicionar'}
              {board.myAverage != null && <span>· A tua média: {formatAverage(board.myAverage)}</span>}
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </Column>
    </Page>
  );
}
