'use client';

import { useState } from 'react';
import { Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { accountRoles, listRows, setAccountRole } from '@/app/actions/crud';
import type { Row } from '@/lib/crud/entities';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';

/** Which roles an account has: each checkbox assigns or removes the role straight away. */
export function AccountRoles({ account }: { account: Row }) {
  const [open, setOpen] = useState(false);
  const [roles, setRoles] = useState<Row[]>([]);
  const [mine, setMine] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function show() {
    setOpen(true);
    setLoading(true);
    const [all, has] = await Promise.all([listRows('roles'), accountRoles(account.id)]);
    if (all.ok) setRoles(all.data);
    else toast.error(all.error);
    if (has.ok) setMine(new Set(has.data.map((r) => Number(r.id))));
    setLoading(false);
  }

  async function toggle(role: Row, checked: boolean) {
    setBusy(role.id);
    const res = await setAccountRole(account.id, role.id, checked);
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    setMine((s) => {
      const n = new Set(s);
      if (checked) n.add(role.id);
      else n.delete(role.id);
      return n;
    });
    toast.success(checked ? `Papel ${role.name} atribuído` : `Papel ${role.name} removido`);
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={show} aria-label="Papéis da conta" title="Papéis">
        <Shield size={16} />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Papéis de {account.username}</DialogTitle>
            <DialogDescription>O que a conta pode fazer na plataforma. As alterações aplicam-se de imediato.</DialogDescription>
          </DialogHeader>
          {loading ? (
            <div className="grid gap-2" aria-label="A carregar"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
          ) : (
            <ul className="space-y-2">
              {roles.map((r) => (
                <li key={r.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-accent/50">
                    <Checkbox
                      className="mt-0.5"
                      checked={mine.has(r.id)}
                      disabled={busy === r.id}
                      onCheckedChange={(v) => toggle(r, v === true)}
                    />
                    <span>
                      <span className="block font-mono text-xs font-bold">{r.name}</span>
                      <span className="text-sm text-muted-foreground">{r.description}</span>
                    </span>
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
