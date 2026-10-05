'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { grantTeacherAccess, revokeTeacherAccess } from '@/app/actions/crud';
import type { Row } from '@/lib/crud/entities';

/** Gives a teacher a login (account with the TEACHER role) or takes it away. */
export function TeacherAccess({ teacher, onChange }: { teacher: Row; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ username: '', email: teacher.email ?? '', password: '' });

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) return toast.error('A palavra-passe precisa de pelo menos 8 caracteres.');
    setBusy(true);
    const res = await grantTeacherAccess(teacher.id, form);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success('Acesso concedido');
    setOpen(false);
    onChange();
  }
  async function revoke() {
    if (!confirm(`Retirar o acesso de ${teacher.firstName} ${teacher.lastName}?`)) return;
    setBusy(true);
    const res = await revokeTeacherAccess(teacher.id);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success('Acesso retirado');
    setOpen(false);
    onChange();
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label="Acesso à plataforma" title="Acesso à plataforma">
        <KeyRound size={16} />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acesso de {teacher.firstName} {teacher.lastName}</DialogTitle>
            <DialogDescription>Com acesso, o professor entra na plataforma e monta provas das escolas onde está afiliado.</DialogDescription>
          </DialogHeader>
          {teacher.hasAccess ? (
            <div className="grid gap-3">
              <p className="text-sm">Este professor já tem acesso à plataforma.</p>
              <Button variant="destructive" disabled={busy} onClick={revoke}>Retirar acesso</Button>
            </div>
          ) : (
            <form onSubmit={grant} className="grid gap-3">
              <div className="grid gap-1.5"><Label>Utilizador</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required minLength={3} /></div>
              <div className="grid gap-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
              <div className="grid gap-1.5"><Label>Palavra-passe inicial</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} /></div>
              <Button type="submit" disabled={busy}>Conceder acesso</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
