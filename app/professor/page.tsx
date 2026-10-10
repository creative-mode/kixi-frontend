'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, FilePen, ScanText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableRowsSkeleton } from '@/components/crud/loading';
import { listRows, listStatements } from '@/app/actions/crud';
import { ENTITIES, type Row } from '@/lib/crud/entities';
import { simulationInScope, statementInScope, useTeacherScope } from '@/hooks/use-teacher-scope';

const simulations = ENTITIES.simulations;
const statements = ENTITIES.statements;

const SHORTCUTS = [
  {
    href: '/statements/import',
    label: 'Carregar prova',
    description: 'Importe o enunciado por foto ou PDF (OCR).',
    icon: ScanText,
  },
  {
    href: '/exam-builder',
    label: 'Criar sala',
    description: 'Monte a prova no modelo da escola, pronta a imprimir.',
    icon: FilePen,
  },
] as const;

/** A listagem de simulações não vem ordenada (`findByDeletedAtIsNull` não tem
 * ORDER BY), por isso "últimas" tem de ser uma ordenação nossa — e tem de
 * acontecer antes do `slice`, senão os cinco primeiros são cinco quaisquer. */
function byMostRecent(rows: Row[]): Row[] {
  const time = (r: Row) => {
    const raw = r.createdAt ?? r.startedAt;
    const value = raw ? Date.parse(String(raw)) : Number.NaN;
    return Number.isFinite(value) ? value : 0;
  };
  return [...rows].sort((a, b) => time(b) - time(a) || Number(b.id) - Number(a.id));
}

export default function TeacherHome() {
  const [rooms, setRooms] = useState<Row[] | null>(null);
  const [pending, setPending] = useState<Row[] | null>(null);
  // Teachers only see their own classes/subjects (admins see all).
  const scope = useTeacherScope();

  const load = useCallback(async () => {
    const [roomRes, reviewRes] = await Promise.all([
      listRows('simulations'),
      listStatements('review'),
    ]);
    setRooms(roomRes.ok ? roomRes.data : []);
    setPending(reviewRes.ok ? reviewRes.data : []);
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(task);
  }, [load]);

  // O scope tem de estar resolvido antes de filtrar: enquanto não está, o
  // filtro esconde tudo e as listas ficariam vazias num piscar.
  const latestRooms =
    rooms && scope
      ? byMostRecent(rooms.filter((r) => simulationInScope(scope, r))).slice(0, 5)
      : null;
  const toReview =
    pending && scope
      ? byMostRecent(pending.filter((r) => statementInScope(scope, r))).slice(0, 5)
      : null;
  const scopeError = scope?.error ?? null;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-8 lg:p-10">
      <div>
        <h1 className="text-2xl leading-tight tracking-tight text-foreground">Início</h1>
        <p className="mt-1 text-muted-foreground">Atalhos e resumo da sua atividade.</p>
      </div>

      <section aria-label="Atalhos rápidos" className="grid gap-4 sm:grid-cols-2">
        {SHORTCUTS.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-4 rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-primary"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block font-semibold text-foreground">{label}</span>
              <span className="text-sm text-muted-foreground">{description}</span>
            </span>
            <ArrowRight
              className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
              aria-hidden
            />
          </Link>
        ))}
      </section>

      {scopeError ? (
        <p
          role="status"
          className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          Não foi possível determinar as suas turmas, por isso as listas abaixo ficam vazias: {scopeError}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">
                Últimas salas
              </CardTitle>
              <CardDescription>Simulações mais recentes dos estudantes.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/simulations">
                Ver todas <ArrowRight size={14} aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  {simulations.columns.map((c) => (
                    <TableHead
                      key={c.label}
                      className={`font-medium text-muted-foreground ${c.className ?? ''}`}
                    >
                      {c.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestRooms === null ? (
                  <TableRowsSkeleton cols={simulations.columns.length} rows={3} />
                ) : latestRooms.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={simulations.columns.length}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      Ainda não há salas.
                    </TableCell>
                  </TableRow>
                ) : (
                  latestRooms.map((row) => (
                    <TableRow key={row.id} className="border-border hover:bg-accent/50">
                      {simulations.columns.map((c) => (
                        <TableCell key={c.label} className={c.className}>
                          {c.value(row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">
                Enunciados por rever
              </CardTitle>
              <CardDescription>Importados pelo OCR e ainda não aprovados.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/statements">
                Ver todos <ArrowRight size={14} aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  {statements.columns.map((c) => (
                    <TableHead
                      key={c.label}
                      className={`font-medium text-muted-foreground ${c.className ?? ''}`}
                    >
                      {c.label}
                    </TableHead>
                  ))}
                  <TableHead className="text-right font-medium text-muted-foreground">
                    Ação
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {toReview === null ? (
                  <TableRowsSkeleton cols={statements.columns.length + 1} rows={3} />
                ) : toReview.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={statements.columns.length + 1}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      Tudo em dia: nenhum enunciado à espera de revisão.
                    </TableCell>
                  </TableRow>
                ) : (
                  toReview.map((row) => (
                    <TableRow key={row.id} className="border-border hover:bg-accent/50">
                      {statements.columns.map((c) => (
                        <TableCell key={c.label} className={c.className}>
                          {c.value(row)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/statements/${row.id}`}>Rever</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
