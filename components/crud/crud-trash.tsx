'use client';

import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listRows, listStatements, purgeRow, restoreRow } from '@/app/actions/crud';
import { ENTITIES, rowId, type EntityKey, type Row } from '@/lib/crud/entities';
import { Confirm, type ConfirmState } from './confirm';
import { PageHead } from './page-head';

export function CrudTrash({ entityKey }: { entityKey: EntityKey }) {
  const entity = ENTITIES[entityKey];
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = entityKey === 'statements' ? await listStatements('trash') : await listRows(entityKey, true);
    if (res.ok) setRows(res.data);
    else {
      setRows([]);
      setError(res.error);
    }
  }, [entityKey]);
  useEffect(() => {
    load();
  }, [load]);

  async function restore(row: Row) {
    const res = await restoreRow(entityKey, rowId(entity, row));
    if (res.ok) {
      toast.success(`${entity.singular} restaurado`);
      load();
    } else toast.error(res.error);
  }
  function askPurge(row: Row) {
    setConfirm({
      title: 'Eliminar definitivamente?',
      description: `${entity.singular} «${entity.titleOf(row)}» desaparece para sempre. Esta ação não pode ser desfeita.`,
      action: 'Eliminar definitivamente',
      destructive: true,
      run: async () => {
        const res = await purgeRow(entityKey, rowId(entity, row));
        if (res.ok) {
          toast.success('Eliminado definitivamente');
          load();
        } else toast.error(res.error);
      },
    });
  }

  const cols = entity.columns.length + 1;
  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <PageHead entity={entity} title="Lixeira" subtitle={`${entity.plural} eliminados`} back={{ href: `/${entity.path}`, label: 'Voltar à lista' }} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {entity.columns.map((c) => (
                  <TableHead key={c.label} className={`font-medium text-muted-foreground ${c.className ?? ''}`}>{c.label}</TableHead>
                ))}
                <TableHead className="text-right font-medium text-muted-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows === null ? (
                <TableRow><TableCell colSpan={cols} className="py-16 text-center text-muted-foreground">A carregar…</TableCell></TableRow>
              ) : error ? (
                <TableRow><TableCell colSpan={cols} className="py-12 text-center text-sm text-destructive">{error}</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={cols} className="py-16 text-center text-sm text-muted-foreground">A lixeira está vazia.</TableCell></TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={rowId(entity, row)} className="border-border">
                    {entity.columns.map((c) => (
                      <TableCell key={c.label} className={c.className}>{c.value(row)}</TableCell>
                    ))}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => restore(row)} aria-label="Restaurar"><RotateCcw size={16} /></Button>
                        <Button variant="ghost" size="sm" className="hover:bg-alvo-tint hover:text-alvo-ink" onClick={() => askPurge(row)} aria-label="Eliminar definitivamente"><Trash2 size={16} /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Confirm state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
