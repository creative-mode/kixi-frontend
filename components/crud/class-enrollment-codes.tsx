'use client';

import { useState } from 'react';
import { Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { classEnrollmentCodes, createEnrollmentCode, revokeEnrollmentCode } from '@/app/actions/crud';
import type { Row } from '@/lib/crud/entities';
import { formatLuandaDateTime, fromLuandaDateTimeLocal } from '@/lib/format';
import { Confirm, type ConfirmState } from './confirm';

const dateTime = (v?: string | null) => formatLuandaDateTime(v);

/** Códigos de matrícula de uma turma (#255): o aluno troca um destes por uma
 *  auto-matrícula em `POST /enrollments`, em vez de escolher a turma à mão. */
export function ClassEnrollmentCodes({ classItem }: { classItem: Row }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<Row[]>([]);
  const [maxUses, setMaxUses] = useState('1');
  const [expiresAt, setExpiresAt] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  async function show() {
    setOpen(true);
    setLoading(true);
    const res = await classEnrollmentCodes(classItem.id);
    if (res.ok) setCodes(res.data);
    else toast.error(res.error);
    setLoading(false);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const uses = Number(maxUses);
    if (!Number.isInteger(uses) || uses < 1) return toast.error('O número de usos tem de ser pelo menos 1.');
    const expiresAtIso = fromLuandaDateTimeLocal(expiresAt);
    if (expiresAt && (!expiresAtIso || new Date(expiresAtIso) <= new Date())) return toast.error('A data de expiração tem de ser no futuro.');
    setBusy(true);
    const res = await createEnrollmentCode(classItem.id, uses, expiresAtIso);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    setCodes((c) => [res.data, ...c]);
    setMaxUses('1');
    setExpiresAt('');
    toast.success(`Código ${res.data.code} criado`);
  }

  async function revoke(code: Row): Promise<boolean> {
    setBusy(true);
    const res = await revokeEnrollmentCode(code.id);
    setBusy(false);
    if (!res.ok) { toast.error(res.error); return false; }
    setCodes((c) => c.map((x) => (x.id === code.id ? res.data : x)));
    toast.success('Código revogado');
    return true;
  }
  function askRevoke(code: Row) {
    setConfirm({ title: 'Revogar código?', description: `O código ${code.code} deixa de poder ser usado.`, action: 'Revogar', destructive: true, run: async () => { await revoke(code); } });
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Código copiado');
    } catch {
      toast.error('Não foi possível copiar. Copie manualmente.');
    }
  }

  const statusOf = (code: Row) => {
    if (code.revokedAt) return { label: 'Revogado', variant: 'destructive' as const };
    if (code.expiresAt && new Date(code.expiresAt) <= new Date()) return { label: 'Expirado', variant: 'secondary' as const };
    if (code.uses >= code.maxUses) return { label: 'Esgotado', variant: 'secondary' as const };
    return { label: 'Ativo', variant: 'success' as const };
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={show} aria-label={`Códigos de matrícula de ${classItem.code}`} title="Códigos de matrícula">
        <Ticket size={16} />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Códigos de matrícula — {classItem.code}</DialogTitle>
            <DialogDescription>
              Um aluno troca um destes códigos por uma matrícula nesta turma. Sem código válido, a
              auto-matrícula é recusada.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={create} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="maxUses">Usos</Label>
              <Input id="maxUses" type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="expiresAt">Expira (opcional)</Label>
              <Input id="expiresAt" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy}>Gerar</Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Um código para um só aluno fica com «Usos» = 1; para uma turma inteira, ponha o número de alunos.
          </p>

          {loading ? (
            <div className="grid gap-2" aria-label="A carregar"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
          ) : codes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Ainda não há códigos para esta turma.</p>
          ) : (
            <ul className="space-y-2">
              {codes.map((code) => {
                const status = statusOf(code);
                return (
                  <li key={code.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copy(code.code)}
                          className="font-mono text-sm font-bold tracking-wider hover:underline"
                          title="Copiar código"
                        >
                          {code.code}
                        </button>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {code.uses}/{code.maxUses} usos
                        {code.expiresAt ? ` · expira ${dateTime(code.expiresAt)}` : ' · sem validade'}
                      </p>
                    </div>
                    {!code.revokedAt && (
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => askRevoke(code)} className="hover:bg-danger-soft hover:text-destructive">
                        Revogar
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>
      <Confirm state={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
