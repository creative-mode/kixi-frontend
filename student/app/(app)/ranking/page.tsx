'use client';

import { useState } from 'react';
import { Column, Page, PageHeader } from '@/components/page';
import { UserAvatar } from '@/components/user-avatar';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ranking } from '@/lib/data';

const SCOPES = ['Turma', 'Escola', 'Amigos'] as const;

export default function Turma() {
  const [scope, setScope] = useState<(typeof SCOPES)[number]>('Turma');
  const data = ranking[scope];
  return (
    <Page variant="wide">
      <Column className="gap-5">
        <PageHeader title={data.title} description="Média das simulações deste período. Vês o topo e quem está perto de ti." />
        <Tabs value={scope} onValueChange={(v) => setScope(v as (typeof SCOPES)[number])}>
          <TabsList aria-label="Comparar com">{SCOPES.map((s) => <TabsTrigger key={s} value={s}>{s}</TabsTrigger>)}</TabsList>
        </Tabs>
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="w-12">#</TableHead><TableHead>Aluno</TableHead><TableHead className="hidden text-right sm:table-cell">Provas</TableHead><TableHead className="text-right">Média</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.rows.map((r) => {
                const you = 'you' in r && r.you;
                return (
                  <TableRow key={r.name} className={you ? 'bg-accent font-bold hover:bg-accent' : undefined}>
                    <TableCell className="font-semibold text-muted-foreground tabular-nums">{r.rank}</TableCell>
                    <TableCell><span className="flex items-center gap-3"><UserAvatar name={r.name} size={32} />{r.name}{you ? ' (tu)' : ''}<span className="hidden font-normal text-muted-foreground sm:inline">{r.school}</span></span></TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{r.exams}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.score}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </Column>
    </Page>
  );
}
