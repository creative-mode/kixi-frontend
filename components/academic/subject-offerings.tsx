'use client';

import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getSubjectOfferings } from '@/app/actions/academic';
import type { SubjectOfferings } from '@/lib/academic/types';
import { gradeLabel } from '@/lib/academic/structure';

/** «Onde é lecionada»: as escolas e cursos que têm esta disciplina no currículo, e as turmas que a dão. */
export function SubjectWhere({ code, name }: { code: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SubjectOfferings | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function show() {
    setOpen(true);
    setData(null); setError(null);
    const r = await getSubjectOfferings(code);
    if (r.ok) setData(r.data); else setError(r.error);
  }
  return (
    <>
      <Button variant="ghost" size="sm" onClick={show} aria-label={`Onde ${name} é lecionada`} title="Onde é lecionada"><MapPin size={16} /></Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{name}</DialogTitle>
            <DialogDescription>Escolas e cursos que a têm no currículo.</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto" data-testid="offerings">
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : !data ? (
              <div role="status" aria-label="A carregar" className="grid gap-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-14" /></div>
            ) : data.institutions.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Ainda não está no currículo de nenhum curso.</p> : (
              <div className="grid gap-4">
                {data.institutions.map((i) => (
                  <section key={i.id}>
                    <h3 className="mb-1 text-sm font-semibold">{i.name} <span className="font-normal text-muted-foreground">({i.code})</span></h3>
                    <ul className="grid gap-1.5">
                      {i.courses.map((c) => (
                        <li key={c.id} className="rounded-md border p-2.5 text-sm">
                          <span className="font-medium">{c.name}</span> <span className="text-muted-foreground">· {gradeLabel(c.grade)}</span>
                          <div className="mt-1 text-xs text-muted-foreground">{c.classes.length ? `Turmas: ${c.classes.map((k) => k.code).join(', ')}` : 'Sem turmas'}</div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
