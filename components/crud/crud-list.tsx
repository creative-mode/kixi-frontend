'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Archive, Edit, Network, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { deleteRow, listOptions, listRows } from '@/app/actions/crud';
import { ENTITIES, rowId, type EntityKey, type Row, gender, newLabel } from '@/lib/crud/entities';
import { answerInScope, classInScope, simulationInScope, useTeacherScope } from '@/hooks/use-teacher-scope';
import { isStructureEntity } from '@/lib/roles';
import { AccountRoles } from './account-roles';
import { ClassEnrollmentCodes } from './class-enrollment-codes';
import { InstitutionMembers } from './institution-members';
import { TeacherAccess } from './teacher-access';
import { TeacherSchools } from '@/components/academic/teacher-overview';
import { SubjectWhere } from '@/components/academic/subject-offerings';
import { Confirm, type ConfirmState } from './confirm';
import { PageHead } from './page-head';
import { TableRowsSkeleton } from './loading';

/** Generic list: search, rows, edit, move to trash. Accounts also get a roles dialog per row. */
export function CrudList({ entityKey }: { entityKey: EntityKey }) {
  const entity = ENTITIES[entityKey];
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  // id -> display name per FK field (entity.lookups), for flat API responses
  const [labels, setLabels] = useState<Record<string, string>>({});
  // Teachers only see records tied to their own classes/subjects (admins see all).
  const scope = useTeacherScope();
  // A estrutura académica (turmas incluídas) só o ADMIN altera: o professor só consulta, sem botões que falhariam com 403.
  const readOnly = isStructureEntity(entityKey) && !!scope?.restricted;

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
    const task = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(task);
  }, [load]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!entity.lookups) return;
      const maps: Record<string, string> = {};
      await Promise.all(
        Object.entries(entity.lookups).map(async ([field, from]) => {
          const r = await listOptions(from);
          if (r.ok && alive) for (const o of r.data) maps[`${field}:${o.value}`] = o.label;
        }),
      );
      if (alive) setLabels(maps);
    })();
    return () => {
      alive = false;
    };
  }, [entityKey, entity]);

  const scoped = useMemo(() => {
    // Sem scope resolvido fica null, e a lista continua no esqueleto: devolver
    // `rows` aqui mostrava a escola inteira até o scope chegar.
    if (!rows || !scope) return null;
    if (entityKey === 'classes') return rows.filter((r) => classInScope(scope, r));
    if (entityKey === 'simulations') return rows.filter((r) => simulationInScope(scope, r));
    if (entityKey === 'simulation-answers') return rows.filter((r) => answerInScope(scope, r));
    return rows;
  }, [rows, scope, entityKey]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !scoped) return scoped;
    return scoped.filter((r) => JSON.stringify(Object.values(r)).toLowerCase().includes(q));
  }, [scoped, query]);

  function askDelete(row: Row) {
    const copy = entity.deleteCopy;
    const title = entity.titleOf(row);
    setConfirm({
      title: copy?.title ?? `Mover para a lixeira?`,
      description: copy ? copy.description(`«${title}»`) : `${entity.singular} «${title}» sai da lista mas pode ser ${gender(entity, 'restaurado')} na lixeira.`,
      action: copy?.action ?? 'Mover para a lixeira',
      destructive: true,
      busyLabel: 'A mover para a lixeira…',
      run: async () => {
        const res = await deleteRow(entityKey, rowId(entity, row));
        if (res.ok) {
          toast.success(copy?.done ?? `${entity.singular} ${gender(entity, 'movido')} para a lixeira`, {
            duration: 10_000,
            action: {
              label: 'Desfazer',
              onClick: async () => {
                const { restoreRow } = await import('@/app/actions/crud');
                const restored = await restoreRow(entityKey, rowId(entity, row));
                if (restored.ok) { toast.success(`${entity.singular} ${gender(entity, 'restaurado')}`); void load(); }
                else toast.error(restored.error);
              },
            },
          });
          await load();
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
      <PageHead
        entity={entity}
        actions={
          <>
            {entity.trashable !== false && !readOnly ? (
              <Button asChild variant="outline">
                <Link href={`/${entity.path}/trash`}>
                  <Archive size={16} className="mr-2" /> Lixeira
                </Link>
              </Button>
            ) : null}
            {entity.canCreate && !readOnly ? (
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
          <span className="ml-auto text-sm text-muted-foreground">{rows ? `${shown?.length ?? 0} de ${scoped?.length ?? 0}` : ''}</span>
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
              {error ? (
                <TableRow>
                  <TableCell colSpan={cols} className="py-12 text-center">
                    <p className="mb-3 text-sm text-destructive">{error}</p>
                    <Button size="sm" variant="outline" onClick={load}>Tentar de novo</Button>
                  </TableCell>
                </TableRow>
              ) : scope?.error ? (
                <TableRow>
                  <TableCell colSpan={cols} className="py-12 text-center">
                    <p className="text-sm text-destructive">
                      Não foi possível determinar as suas turmas, por isso a lista fica vazia: {scope.error}
                    </p>
                  </TableCell>
                </TableRow>
              ) : shown === null ? (
                <TableRowsSkeleton cols={cols} />
              ) : shown.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={cols} className="py-16 text-center text-muted-foreground">
                    <p className="mb-3 text-sm">{query ? 'Nada corresponde à pesquisa.' : `Ainda não há ${entity.plural.toLowerCase()}.`}</p>
                    {!query && entity.canCreate && !readOnly ? (
                      <Button asChild size="sm">
                        <Link href={`/${entity.path}/new`}>
                          <Plus size={14} className="mr-1" /> Criar {entity.singular.toLowerCase()}
                        </Link>
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ) : (
                shown.map((row) => (
                  <TableRow key={rowId(entity, row)} className="border-border transition-colors hover:bg-accent/50">
                    {entity.columns.map((c) => (
                      <TableCell key={c.label} className={c.className}>{c.value(row, labels)}</TableCell>
                    ))}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {entityKey === 'accounts' ? <AccountRoles account={row} /> : null}
                        {entityKey === 'institutions' && !readOnly ? (
                          <Button variant="ghost" size="sm" asChild aria-label={`Estrutura de ${row.name}`} title="Cursos, turmas, disciplinas e professores">
                            <Link href={`/institutions/${row.id}/structure`}><Network size={16} /></Link>
                          </Button>
                        ) : null}
                        {entityKey === 'institutions' && !readOnly ? <InstitutionMembers institution={row} /> : null}
                        {entityKey === 'teachers' && !readOnly ? <TeacherSchools teacherId={row.id} name={`${row.firstName} ${row.lastName}`} /> : null}
                        {entityKey === 'teachers' ? <TeacherAccess teacher={row} onChange={load} /> : null}
                        {entityKey === 'classes' && !readOnly ? <ClassEnrollmentCodes classItem={row} /> : null}
                        {entityKey === 'subjects' && !readOnly ? <SubjectWhere code={row.code} name={row.name} /> : null}
                        {entityKey === 'courses' && !readOnly && row.institutionId ? (
                          <Button variant="ghost" size="sm" asChild aria-label={`Currículo e turmas de ${row.name}`} title="Currículo e turmas">
                            <Link href={`/institutions/${row.institutionId}/structure`}><Network size={16} /></Link>
                          </Button>
                        ) : null}
                        {entity.canEdit && !readOnly ? (
                          <Button variant="ghost" size="sm" asChild aria-label="Editar">
                            <Link href={`/${entity.path}/${rowId(entity, row)}/edit`}><Edit size={16} /></Link>
                          </Button>
                        ) : null}
                        {readOnly ? null : (
                          <Button variant="ghost" size="sm" aria-label="Mover para a lixeira" className="hover:bg-danger-soft hover:text-destructive" onClick={() => askDelete(row)}>
                            <Trash2 size={16} />
                          </Button>
                        )}
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
