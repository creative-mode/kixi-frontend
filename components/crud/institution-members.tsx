'use client';

import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { institutionLinks, listRows, setInstitutionLink, setStudentProcessNumber, type LinkKind } from '@/app/actions/crud';
import { Input } from '@/components/ui/input';
import { parseProcessNumber, PROCESS_NUMBER_MAX } from '@/lib/crud/process-number';
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
  /** userId → número de processo guardado (kixi#512), só no separador dos alunos. */
  const [numbers, setNumbers] = useState<Map<number, string>>(new Map());

  async function load(index: number) {
    setTab(index);
    setLoading(true);
    const t = TABS[index];
    const [all, has] = await Promise.all([listRows(t.source), institutionLinks(institution.id, t.kind)]);
    if (all.ok) setOptions(all.data);
    else toast.error(all.error);
    if (has.ok) {
      setLinked(new Set(has.data.map((r) => Number(r[t.linkId]))));
      setNumbers(new Map(has.data.filter((r) => r.processNumber).map((r) => [Number(r.userId), String(r.processNumber)])));
    }
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
    if (!checked) setNumbers((m) => { const n = new Map(m); n.delete(row.id); return n; });
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
                  {TABS[tab].kind === 'students' && linked.has(r.id) ? (
                    <ProcessNumberField
                      key={`${institution.id}-${r.id}`}
                      studentName={TABS[tab].name(r)}
                      saved={numbers.get(r.id) ?? ''}
                      onSave={async (value) => {
                        const res = await setStudentProcessNumber(institution.id, r.id, value);
                        if (!res.ok) return res.error;
                        setNumbers((m) => { const n = new Map(m); if (value) n.set(r.id, value); else n.delete(r.id); return n; });
                        toast.success(value ? 'Número de processo guardado' : 'Número de processo removido');
                        return null;
                      }}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * O número de processo do aluno nesta escola (kixi#512): guarda ao sair do campo ou com Enter, só se mudou. Vazio apaga-o.
 * O erro (formato, ou «já pertence a outro aluno») fica escrito por baixo, ligado ao campo, e o valor mantém-se para corrigir.
 */
function ProcessNumberField({ studentName, saved, onSave }: { studentName: string; saved: string; onSave: (value: string | null) => Promise<string | null> }) {
  const [value, setValue] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const errorId = `pn-err-${studentName.replace(/\W+/g, '-')}`;

  async function commit() {
    const parsed = parseProcessNumber(value);
    if (!parsed.ok) return setError(parsed.error);
    if ((parsed.value ?? '') === saved) return setError(null);
    setSaving(true);
    const failure = await onSave(parsed.value);
    setSaving(false);
    setError(failure);
    if (!failure) setValue(parsed.value ?? '');
  }

  return (
    <div className="mt-1 grid gap-1 pl-10">
      <Input
        value={value}
        maxLength={PROCESS_NUMBER_MAX}
        disabled={saving}
        placeholder="Nº de processo (opcional)"
        aria-label={`Número de processo de ${studentName}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="h-8 max-w-60 text-sm"
        onChange={(e) => { setValue(e.target.value); setError(null); }}
        onBlur={() => void commit()}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void commit(); } }}
      />
      {error ? <p id={errorId} role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
