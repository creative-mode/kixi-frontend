'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RotateCcw, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listRows, listStatements, purgeRow, restoreRow } from '@/app/actions/crud';
import { ENTITIES, rowId, type EntityKey, type Row, gender } from '@/lib/crud/entities';
import { Confirm, type ConfirmState } from './confirm';
import { PageHead } from './page-head';
import { TableRowsSkeleton } from './loading';
import { Input } from '@/components/ui/input';

export function CrudTrash({ entityKey }: { entityKey: EntityKey }) {
  const entity = ENTITIES[entityKey];
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [query, setQuery] = useState('');
  const [busyIds, setBusyIds] = useState<Set<string | number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

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
    const task = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(task);
  }, [load]);

  async function restore(row: Row) {
    const id = rowId(entity, row);
    setBusyIds((ids) => new Set(ids).add(id));
    const res = await restoreRow(entityKey, id);
    setBusyIds((ids) => { const next = new Set(ids); next.delete(id); return next; });
    if (res.ok) {
      toast.success(`${entity.singular} ${gender(entity, 'restaurado')}`);
      load();
    } else toast.error(res.error);
  }
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !q ? rows : rows?.filter((row) => JSON.stringify(Object.values(row)).toLowerCase().includes(q));
  }, [rows, query]);
  async function restoreAll() {
    if (!shown?.length) return;
    setBulkBusy(true);
    const results = await Promise.all(shown.map((row) => restoreRow(entityKey, rowId(entity, row))));
    setBulkBusy(false);
    const failed = results.filter((r) => !r.ok);
    if (failed.length) toast.error(`${failed.length} ${entity.plural.toLowerCase()} não foram restaurados.`);
    else toast.success(`${shown.length} ${entity.plural.toLowerCase()} restaurados.`);
    void load();
  }
  function askPurge(row: Row) {
    setConfirm({
      title: 'Eliminar definitivamente?',
      description: `${entity.singular} «${entity.titleOf(row)}» desaparece para sempre. Esta ação não pode ser desfeita.`,
      action: 'Eliminar definitivamente',
      destructive: true,
      busyLabel: 'A eliminar definitivamente…',
      run: async () => {
        const res = await purgeRow(entityKey, rowId(entity, row));
        if (res.ok) {
          toast.success('Eliminado definitivamente');
          load();
          return true;
        }
        toast.error(res.error);
        return false;
      },
    });
  }

  const cols = entity.columns.length + 1;
  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <PageHead entity={entity} title="Lixeira" subtitle={`${entity.plural} ${entity.fem ? 'eliminadas' : 'eliminados'}`} back={{ href: `/${entity.path}`, label: 'Voltar à lista' }} />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative w-full max-w-sm">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" aria-label="Pesquisar na lixeira" placeholder="Pesquisar na lixeira…" />
          </div>
          <Button variant="outline" size="sm" onClick={() => void restoreAll()} disabled={!shown?.length || bulkBusy}>
            <RotateCcw size={16} /> {bulkBusy ? 'A restaurar…' : 'Restaurar resultados'}
          </Button>
        </div>
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
                <TableRowsSkeleton cols={cols} />
              ) : error ? (
                <TableRow><TableCell colSpan={cols} className="py-12 text-center text-sm text-destructive">{error}</TableCell></TableRow>
              ) : !shown?.length ? (
                <TableRow><TableCell colSpan={cols} className="py-16 text-center text-sm text-muted-foreground">A lixeira está vazia.</TableCell></TableRow>
              ) : (
                shown.map((row) => (
                  <TableRow key={rowId(entity, row)} className="border-border">
                    {entity.columns.map((c) => (
                      <TableCell key={c.label} className={c.className}>{c.value(row)}</TableCell>
                    ))}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" disabled={busyIds.has(rowId(entity, row)) || bulkBusy} onClick={() => void restore(row)} aria-label="Restaurar"><RotateCcw size={16} /></Button>
                        <Button variant="ghost" size="sm" disabled={busyIds.has(rowId(entity, row)) || bulkBusy} className="hover:bg-danger-soft hover:text-destructive" onClick={() => askPurge(row)} aria-label="Eliminar definitivamente"><Trash2 size={16} /></Button>
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
