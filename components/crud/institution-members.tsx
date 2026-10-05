'use client';

import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { institutionLinks, listRows, setInstitutionLink, type LinkKind } from '@/app/actions/crud';
import type { Row } from '@/lib/crud/entities';

const TABS: { kind: LinkKind; label: string; source: 'subjects' | 'teachers' | 'users'; linkId: string; name: (r: Row) => string }[] = [
  { kind: 'subjects', label: 'Disciplinas', source: 'subjects', linkId: 'id', name: (r) => `${r.name}${r.code ? ` (${r.code})` : ''}` },
  { kind: 'teachers', label: 'Professores', source: 'teachers', linkId: 'id', name: (r) => `${r.firstName} ${r.lastName}` },
  { kind: 'students', label: 'Alunos', source: 'users', linkId: 'userId', name: (r) => `${r.firstName} ${r.lastName}` },
];

/** Which subjects, teachers and students belong to a school: each checkbox links or unlinks straight away. */
export function InstitutionMembers({ institution }: { institution: Row }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const [options, setOptions] = useState<Row[]>([]);
  const [linked, setLinked] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  async function load(index: number) {
    setTab(index);
    setLoading(true);
    const t = TABS[index];
    const [all, has] = await Promise.all([listRows(t.source), institutionLinks(institution.id, t.kind)]);
    if (all.ok) setOptions(all.data);
    else toast.error(all.error);
    if (has.ok) setLinked(new Set(has.data.map((r) => Number(r[t.linkId]))));
    setLoading(false);
  }

  async function toggle(row: Row, checked: boolean) {
    const t = TABS[tab];
    setBusy(row.id);
    const res = await setInstitutionLink(institution.id, t.kind, row.id, checked);
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    setLinked((s) => {
      const n = new Set(s);
      if (checked) n.add(row.id);
      else n.delete(row.id);
      return n;
    });
    toast.success(checked ? 'Afiliação adicionada' : 'Afiliação removida');
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => { setOpen(true); load(0); }} aria-label="Afiliações" title="Disciplinas, professores e alunos">
        <Link2 size={16} />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{institution.name}</DialogTitle>
            <DialogDescription>Quem e o que pertence a esta escola. Professores e alunos podem estar em várias escolas.</DialogDescription>
          </DialogHeader>
          <div role="tablist" className="flex gap-1 rounded-md bg-muted p-1">
            {TABS.map((t, i) => (
              <button key={t.kind} role="tab" aria-selected={tab === i} onClick={() => load(i)}
                className={`flex-1 rounded px-3 py-1.5 text-sm ${tab === i ? 'bg-card font-semibold shadow-xs' : 'text-muted-foreground'}`}>
                {t.label}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="grid gap-2" aria-label="A carregar"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
          ) : options.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nada para associar ainda.</p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {options.map((r) => (
                <li key={r.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-accent/50">
                    <Checkbox checked={linked.has(r.id)} disabled={busy === r.id} onCheckedChange={(v) => toggle(r, v === true)} />
                    <span className="text-sm">{TABS[tab].name(r)}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
