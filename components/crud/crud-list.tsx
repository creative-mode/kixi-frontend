'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Archive, Edit, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { deleteRow, listRows } from '@/app/actions/crud';
import { ENTITIES, rowId, type EntityKey, type Row, gender, newLabel } from '@/lib/crud/entities';
import { AccountRoles } from './account-roles';
import { Confirm, type ConfirmState } from './confirm';
import { PageHead } from './page-head';

/** Generic list: search, rows, edit, move to trash. Accounts also get a roles dialog per row. */
export function CrudList({ entityKey }: { entityKey: EntityKey }) {
  const entity = ENTITIES[entityKey];
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await listRows(entityKey);
    if (res.ok) setRows(res.data);
    else {
      setRows([]);
      setError(res.error);
    }
  }, [entityKey]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !rows) return rows;
    return rows.filter((r) => JSON.stringify(Object.values(r)).toLowerCase().includes(q));
  }, [rows, query]);

  function askDelete(row: Row) {
    setConfirm({
      title: `Mover para a lixeira?`,
      description: `${entity.singular} «${entity.titleOf(row)}» sai da lista mas pode ser ${gender(entity, 'restaurado')} na lixeira.`,
      action: 'Mover para a lixeira',
      destructive: true,
      run: async () => {
        const res = await deleteRow(entityKey, rowId(entity, row));
        if (res.ok) {
          toast.success(`${entity.singular} ${gender(entity, 'movido')} para a lixeira`);
          load();
        } else toast.error(res.error);
      },
    });
  }

  const cols = entity.columns.length + 1;

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <PageHead
        entity={entity}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/${entity.path}/trash`}>
                <Archive size={16} className="mr-2" /> Lixeira
              </Link>
            </Button>
            {entity.canCreate ? (
              <Button asChild>
                <Link href={`/${entity.path}/new`}>
                  <Plus size={16} className="mr-2" /> {newLabel(entity)}
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <div className="flex items-center gap-3 border-b border-border p-4">
          <div className="relative w-full max-w-sm">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Pesquisar em ${entity.plural.toLowerCase()}…`} className="pl-9" aria-label="Pesquisar" />
          </div>
          <span className="ml-auto text-sm text-muted-foreground">{rows ? `${shown?.length ?? 0} de ${rows.length}` : ''}</span>
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
                <TableRow>
                  <TableCell colSpan={cols} className="py-16 text-center text-muted-foreground">
                    <span className="mx-auto mb-2 block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    A carregar…
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={cols} className="py-12 text-center">
                    <p className="mb-3 text-sm text-destructive">{error}</p>
                    <Button size="sm" variant="outline" onClick={load}>Tentar de novo</Button>
                  </TableCell>
                </TableRow>
              ) : shown && shown.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={cols} className="py-16 text-center text-muted-foreground">
                    <p className="mb-3 text-sm">{query ? 'Nada corresponde à pesquisa.' : `Ainda não há ${entity.plural.toLowerCase()}.`}</p>
                    {!query && entity.canCreate ? (
                      <Button asChild size="sm">
                        <Link href={`/${entity.path}/new`}>
                          <Plus size={14} className="mr-1" /> Criar {entity.singular.toLowerCase()}
                        </Link>
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ) : (
                shown?.map((row) => (
                  <TableRow key={rowId(entity, row)} className="border-border transition-colors hover:bg-accent/50">
                    {entity.columns.map((c) => (
                      <TableCell key={c.label} className={c.className}>{c.value(row)}</TableCell>
                    ))}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {entityKey === 'accounts' ? <AccountRoles account={row} /> : null}
                        {entity.canEdit ? (
                          <Button variant="ghost" size="sm" asChild aria-label="Editar">
                            <Link href={`/${entity.path}/${rowId(entity, row)}/edit`}><Edit size={16} /></Link>
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="sm" aria-label="Mover para a lixeira" className="hover:bg-danger-soft hover:text-destructive" onClick={() => askDelete(row)}>
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {entityKey === 'classes' ? (
        <p className="mt-3 text-xs text-muted-foreground">As turmas não se editam: para mudar uma, mova-a para a lixeira e crie outra.</p>
      ) : null}
      <Confirm state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
