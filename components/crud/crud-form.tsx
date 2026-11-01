'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ImageField } from './image-field';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { createRow, getRow, listOptions, listRows, updateRow } from '@/app/actions/crud';
import { ENTITIES, gender, newLabel, type EntityKey, type Field, type Row } from '@/lib/crud/entities';
import { errorSummary, fieldError, validate, type FieldErrors } from '@/lib/crud/validation';
import { PageHead } from './page-head';
import { FormSkeleton } from './loading';

const blankValues = (fields: Field[]): Row => Object.fromEntries(fields.map((f) => [f.name, '']));

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
  const [errors, setErrors] = useState<FieldErrors>({});
  /** Só depois de um envio inválido: o resumo não aparece enquanto o utilizador ainda está a preencher. */
  const [attempted, setAttempted] = useState(false);
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
        initial = blankValues(entity.fields);
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

  /** Ao sair do campo diz-se logo o que está mal, em vez de deixar tudo para o envio. */
  const checkOnBlur = (f: Field) => setErrors((e) => ({ ...e, [f.name]: fieldError(f, values[f.name]) }));

  const firstField = fields.find((f) => f.type !== 'image');
  const focusField = (name: string | undefined) => { if (name) document.getElementById(name)?.focus(); };
  const summary = attempted ? errorSummary(fields, errors) : null;

  async function save(another: boolean) {
    if (saving) return;
    const errs = { ...validate(fields, values), ...(entity.validate?.(values) ?? {}) };
    setErrors(errs);
    const invalid = errorSummary(fields, errs);
    setAttempted(invalid !== null);
    if (invalid) return focusField(invalid.first);
    setSaving(true);
    const payload = entity.toPayload ? entity.toPayload(values, lookups) : values;
    const res = editing ? await updateRow(entityKey, id!, payload) : await createRow(entityKey, payload);
    setSaving(false);
    if (res.ok) {
      toast.success(editing ? `${entity.singular} ${gender(entity, 'atualizado')}` : `${entity.singular} ${gender(entity, 'criado')}`);
      if (another) {
        // Fica no formulário: limpo, sem erros e com o foco no primeiro campo, pronto para o registo seguinte.
        setValues(blankValues(entity.fields));
        setErrors({});
        setAttempted(false);
        router.refresh();
        requestAnimationFrame(() => focusField(firstField?.name));
        return;
      }
      // Uma escola nova ainda está vazia: leva direto ao assistente de estrutura (cursos, turmas, professores).
      const createdId = !editing && entityKey === 'institutions' ? Number((res.data as Row | undefined)?.id) : NaN;
      router.push(Number.isInteger(createdId) && createdId > 0 ? `/institutions/${createdId}/structure?nova=1` : `/${entity.path}`);
      router.refresh();
    } else toast.error(res.error);
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void save(false);
  };

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
            <form onSubmit={onSubmit} className="space-y-5" noValidate aria-busy={saving}>
              {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}
              {summary ? <p role="alert" className="rounded-md border border-destructive/40 bg-danger-soft px-3 py-2 text-sm text-destructive">{summary.text}</p> : null}
              {fields.map((f) => {
                const err = errors[f.name];
                const hintId = f.hint ? `${f.name}-dica` : undefined;
                const describedBy = err ? `${f.name}-erro` : hintId;
                const common = { id: f.name, name: f.name, 'aria-invalid': !!err, 'aria-describedby': describedBy, disabled: saving, onBlur: () => checkOnBlur(f) } as const;
                return (
                  <div key={f.name} className="space-y-1.5">
                    <Label htmlFor={f.name}>
                      {f.label}{f.required ? <span className="text-destructive"> *</span> : null}
                    </Label>
                    {f.type === 'image' ? (
                      <ImageField id={f.name} name={f.name} kind={f.imageKind ?? 'avatar'} value={values[f.name] ?? ''} onChange={(url) => set(f.name, url)} disabled={saving} />
                    ) : f.type === 'textarea' ? (
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
                        inputMode={f.type === 'number' ? (f.step !== undefined && !Number.isInteger(f.step) ? 'decimal' : 'numeric') : undefined}
                        step={f.type === 'number' ? (f.step ?? 1) : undefined}
                        min={f.type === 'number' ? f.min : undefined}
                        max={f.type === 'number' ? f.max : undefined}
                        autoComplete={f.type === 'password' ? 'new-password' : 'off'}
                        value={values[f.name] ?? ''}
                        onChange={(e) => set(f.name, e.target.value)}
                        placeholder={f.placeholder}
                      />
                    )}
                    {err ? <p id={`${f.name}-erro`} className="text-xs text-destructive">{err}</p> : f.hint ? <p id={hintId} className="text-xs text-muted-foreground">{f.hint}</p> : null}
                  </div>
                );
              })}
              {/* O rato não tira o foco ao campo: senão o blur insere o erro, o botão desce e o clique perde-se. */}
              <div className="flex justify-end gap-3 pt-2" onMouseDown={(e) => e.preventDefault()}>
                <Button type="button" variant="outline" onClick={() => router.push(`/${entity.path}`)} disabled={saving}>Cancelar</Button>
                {/* Uma escola nova leva ao assistente da estrutura: não há «criar outro» para ela. */}
                {!editing && entityKey !== 'institutions' ? <Button type="button" variant="outline" onClick={() => void save(true)} disabled={saving}>Guardar e criar outro</Button> : null}
                <Button type="submit" disabled={saving}>{saving ? 'A guardar…' : editing ? 'Guardar alterações' : `Criar ${entity.singular.toLowerCase()}`}</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
