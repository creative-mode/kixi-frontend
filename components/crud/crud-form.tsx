'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { createRow, getRow, listOptions, listRows, updateRow } from '@/app/actions/crud';
import { ENTITIES, gender, newLabel, type EntityKey, type Field, type Row } from '@/lib/crud/entities';
import { PageHead } from './page-head';
import { FormSkeleton } from './loading';

type Errors = Record<string, string>;

function validate(fields: Field[], values: Row): Errors {
  const errors: Errors = {};
  for (const f of fields) {
    const v = values[f.name];
    const empty = v === undefined || v === null || String(v).trim() === '';
    if (f.required && empty) {
      errors[f.name] = 'Campo obrigatório';
      continue;
    }
    if (empty) continue;
    const s = String(v).trim();
    if (f.type === 'number') {
      const n = Number(s);
      if (!Number.isFinite(n) || !Number.isInteger(n)) errors[f.name] = 'Introduza um número inteiro';
      else if (f.min != null && n < f.min) errors[f.name] = `Mínimo ${f.min}`;
      else if (f.max != null && n > f.max) errors[f.name] = `Máximo ${f.max}`;
    } else if (f.type === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) errors[f.name] = 'Email inválido';
    } else if (f.type !== 'select') {
      if (f.min != null && s.length < f.min) errors[f.name] = `Mínimo ${f.min} caracteres`;
      if (f.max != null && s.length > f.max) errors[f.name] = `Máximo ${f.max} caracteres`;
    }
  }
  return errors;
}

/** Generic create/edit form built from the entity's field list. */
export function CrudForm({ entityKey, id }: { entityKey: EntityKey; id?: string }) {
  const entity = ENTITIES[entityKey];
  const router = useRouter();
  const editing = id !== undefined;
  const fields = useMemo(() => entity.fields.filter((f) => !(editing && f.createOnly)), [entity, editing]);

  const [values, setValues] = useState<Row>({});
  const [options, setOptions] = useState<Record<string, { value: number; label: string }[]>>({});
  // full rows of deriveFrom entities (to build derived payloads, e.g. year from class)
  const [lookups, setLookups] = useState<Record<string, Map<number, Row>>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');

  useEffect(() => {
    let alive = true;
    (async () => {
      // selects that point at other entities
      const sources = [...new Set(entity.fields.flatMap((f) => (f.optionsFrom ? [f.optionsFrom] : [])))];
      const loaded = await Promise.all(sources.map(async (k) => [k, await listOptions(k)] as const));
      const opts: Record<string, { value: number; label: string }[]> = {};
      for (const [k, r] of loaded) {
        if (r.ok) opts[k] = r.data;
        else if (alive) setLoadError(r.error);
      }
      if (entity.deriveFrom?.length && alive) {
        const maps: Record<string, Map<number, Row>> = {};
        await Promise.all(
          entity.deriveFrom.map(async (k) => {
            const r = await listRows(k);
            if (r.ok) maps[k] = new Map(r.data.map((row: Row) => [Number(row.id), row]));
            else if (alive) setLoadError(r.error);
          }),
        );
        if (alive) setLookups(maps);
      }
      let initial: Row = {};
      if (editing) {
        const res = await getRow(entityKey, id!);
        if (!res.ok) {
          if (alive) { setLoadError(res.error); setLoading(false); }
          return;
        }
        initial = entity.toForm ? entity.toForm(res.data) : res.data;
        setTitle(entity.titleOf(res.data));
      } else {
        for (const f of entity.fields) initial[f.name] = '';
      }
      if (!alive) return;
      setOptions(opts);
      setValues(initial);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [entity, entityKey, editing, id]);

  const set = (name: string, v: string) => {
    setValues((s) => ({ ...s, [name]: v }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: '' }));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(fields, values);
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setSaving(true);
    const payload = entity.toPayload ? entity.toPayload(values, lookups) : values;
    const res = editing ? await updateRow(entityKey, id!, payload) : await createRow(entityKey, payload);
    setSaving(false);
    if (res.ok) {
      toast.success(editing ? `${entity.singular} ${gender(entity, 'atualizado')}` : `${entity.singular} ${gender(entity, 'criado')}`);
      router.push(`/${entity.path}`);
      router.refresh();
    } else toast.error(res.error);
  }

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <PageHead
        entity={entity}
        title={editing ? `Editar ${entity.singular.toLowerCase()}` : `${newLabel(entity)} ${entity.singular.toLowerCase()}`}
        subtitle={editing ? title : entity.description}
        back={{ href: `/${entity.path}`, label: 'Voltar à lista' }}
      />
      <Card>
        <CardContent className="p-6">
          {loading ? (
            <FormSkeleton fields={Math.max(2, fields.length)} />
          ) : loadError && editing && Object.keys(values).length === 0 ? (
            <p className="py-8 text-center text-sm text-destructive">{loadError}</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5" noValidate>
              {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}
              {fields.map((f) => {
                const err = errors[f.name];
                const common = { id: f.name, name: f.name, 'aria-invalid': !!err, disabled: saving } as const;
                return (
                  <div key={f.name} className="space-y-1.5">
                    <Label htmlFor={f.name}>
                      {f.label}{f.required ? <span className="text-destructive"> *</span> : null}
                    </Label>
                    {f.type === 'textarea' ? (
                      <Textarea {...common} rows={4} value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} />
                    ) : f.type === 'select' ? (
                      <NativeSelect
                        {...common}
                        value={values[f.name] ?? ''}
                        onChange={(e) => set(f.name, e.target.value)}
                      >
                        <option value="">Escolher…</option>
                        {(options[f.optionsFrom ?? ''] ?? []).map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </NativeSelect>
                    ) : (
                      <Input
                        {...common}
                        type={f.type === 'number' ? 'number' : f.type === 'datetime' ? 'datetime-local' : f.type}
                        inputMode={f.type === 'number' ? 'numeric' : undefined}
                        autoComplete={f.type === 'password' ? 'new-password' : 'off'}
                        value={values[f.name] ?? ''}
                        onChange={(e) => set(f.name, e.target.value)}
                        placeholder={f.placeholder}
                      />
                    )}
                    {err ? <p className="text-xs text-destructive">{err}</p> : f.hint ? <p className="text-xs text-muted-foreground">{f.hint}</p> : null}
                  </div>
                );
              })}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => router.push(`/${entity.path}`)} disabled={saving}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? 'A guardar…' : editing ? 'Guardar alterações' : `Criar ${entity.singular.toLowerCase()}`}</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
