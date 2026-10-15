'use client';

import { useEffect, useState } from 'react';
import { School } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getTeacherOverview } from '@/app/actions/academic';
import type { TeacherOverview } from '@/lib/academic/types';
import { groupAssignments } from '@/lib/academic/structure';

/** Onde um professor dá aulas: por escola, curso e turma, com as disciplinas. Pode ser em várias escolas. */
export function OverviewList({ overview }: { overview: TeacherOverview }) {
  if (overview.institutions.length === 0) return <p className="py-4 text-sm text-muted-foreground">Ainda não está afiliado a nenhuma escola.</p>;
  return (
    <div className="grid gap-4">
      {overview.institutions.map((i) => (
        <section key={i.id} aria-label={i.name} data-testid={`overview-${i.code}`}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><School size={15} /> {i.name} <span className="font-normal text-muted-foreground">({i.code})</span></h3>
          {i.assignments.length === 0 ? <p className="text-sm text-muted-foreground">Afiliado, ainda sem disciplinas atribuídas.</p> : (
            <ul className="grid gap-1.5">
              {groupAssignments(i.assignments).map((g) => (
                <li key={g.key} className="rounded-md border p-2.5 text-sm">
                  <span className="font-medium">{g.classCode}</span> <span className="text-muted-foreground">· {g.grade}.ª · {g.courseName} · {g.schoolYear}</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">{g.subjects.map((s) => <span key={s} className="rounded-full bg-accent px-2.5 py-0.5 text-xs">{s}</span>)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

/** Cartão para o próprio professor (início do gestor). */
export function MyAssignmentsCard() {
  const [overview, setOverview] = useState<TeacherOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getTeacherOverview().then((r) => {
      if (!alive) return;
      if (r.ok) setOverview(r.data); else setError(r.error);
    });
    return () => { alive = false; };
  }, []);
  return (
    <Card data-testid="my-assignments">
      <CardContent className="grid gap-3 p-5">
        <h2 className="font-semibold">Escolas e disciplinas</h2>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : overview ? <OverviewList overview={overview} /> : (
          <div role="status" aria-label="A carregar" className="grid gap-2"><Skeleton className="h-5 w-48" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
        )}
      </CardContent>
    </Card>
  );
}

/** Para o ADMIN, na lista de professores: em que escolas e disciplinas este professor trabalha. */
export function TeacherSchools({ teacherId, name }: { teacherId: number; name: string }) {
  const [open, setOpen] = useState(false);
  const [overview, setOverview] = useState<TeacherOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function show() {
    setOpen(true);
    setOverview(null); setError(null);
    const r = await getTeacherOverview(teacherId);
    if (r.ok) setOverview(r.data); else setError(r.error);
  }
  return (
    <>
      <Button variant="ghost" size="sm" onClick={show} aria-label={`Escolas e disciplinas de ${name}`} title="Escolas e disciplinas"><School size={16} /></Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{name}</DialogTitle>
            <DialogDescription>Escolas em que dá aulas e as disciplinas por turma.</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : overview ? <OverviewList overview={overview} /> : <div role="status" aria-label="A carregar" className="grid gap-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-14" /></div>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
