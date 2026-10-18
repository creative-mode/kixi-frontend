'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Check, Heading, ImageIcon, Lightbulb, List, ListChecks, Sigma, Trash2, Type } from 'lucide-react';
import { PostBlocksView } from '@/components/post-blocks-view';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { enviarImagemPostAction, publishBuiltPostAction } from '@/lib/feed-actions';
import {
  BLOCK_LABEL, LIMITS, TEMPLATES, TONE_LABEL, emptyBlock, moved, payloadOf, problemOf, templateBlocks,
  type BlockDraft, type BlockType, type BuiltKind, type CalloutTone, type Template,
} from '@/lib/post-blocks';
import { cn } from '@/lib/utils';

const ICON: Record<BlockType, typeof Type> = {
  heading: Heading, text: Type, list: List, callout: Lightbulb, formula: Sigma, image: ImageIcon, choice: ListChecks,
};
const ADDABLE: BlockType[] = ['heading', 'text', 'list', 'callout', 'formula', 'image', 'choice'];
const LETTER = (i: number) => String.fromCharCode(65 + i);

function ImageField({ block, label, onChange }: { block: BlockDraft; label: string; onChange: (patch: Partial<BlockDraft>) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append('file', file);
    const result = await enviarImagemPostAction(form);
    setBusy(false);
    if (result.url) onChange({ url: result.url });
    else setError(result.error ?? 'Não foi possível enviar a imagem.');
    if (input.current) input.current.value = '';
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id={`${block.key}-file`} aria-label={`${label}: escolher imagem`} onChange={(e) => pick(e.target.files?.[0])} />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          <ImageIcon />{busy ? 'A enviar…' : block.url ? 'Trocar a imagem' : 'Escolher imagem'}
        </Button>
        {block.url && !busy && <span className="inline-flex items-center gap-1 text-[13px] text-muted-foreground"><Check className="size-3.5" aria-hidden />Imagem pronta</span>}
        <span className="text-[13px] text-muted-foreground">PNG, JPG ou WEBP, até 2 MB</span>
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
      <Input aria-label={`${label}: descrição da imagem`} placeholder="Descrição para quem não vê a imagem" maxLength={150} value={block.alt ?? ''} onChange={(e) => onChange({ alt: e.target.value })} />
      <Input aria-label={`${label}: legenda`} placeholder="Legenda (opcional)" maxLength={LIMITS.caption} value={block.caption ?? ''} onChange={(e) => onChange({ caption: e.target.value })} />
    </div>
  );
}

function BlockFields({ block, label, onChange }: { block: BlockDraft; label: string; onChange: (patch: Partial<BlockDraft>) => void }) {
  switch (block.type) {
    case 'heading':
      return <Input aria-label={label} placeholder="Um título curto" maxLength={LIMITS.heading} value={block.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />;
    case 'formula':
      return <Input aria-label={label} className="font-mono" placeholder="Por exemplo: M = C × (1 + i × t)" maxLength={LIMITS.formula} value={block.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />;
    case 'text':
      return <Textarea aria-label={label} placeholder="Escreve aqui" maxLength={LIMITS.text} rows={4} value={block.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />;
    case 'callout':
      return (
        <div className="grid gap-2">
          <NativeSelect aria-label={`${label}: tipo`} className="w-fit" value={block.tone ?? 'tip'} onChange={(e) => onChange({ tone: e.target.value as CalloutTone })}>
            {(Object.keys(TONE_LABEL) as CalloutTone[]).map((t) => <option key={t} value={t}>{TONE_LABEL[t]}</option>)}
          </NativeSelect>
          <Textarea aria-label={label} placeholder="O que não se pode esquecer" maxLength={LIMITS.callout} rows={2} value={block.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
        </div>
      );
    case 'list': {
      const items = block.items ?? [''];
      const set = (next: string[]) => onChange({ items: next });
      return (
        <div className="grid gap-2">
          <label className="flex w-fit items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={!!block.ordered} onChange={(e) => onChange({ ordered: e.target.checked })} />Numerada</label>
          {items.map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input aria-label={`${label}: linha ${i + 1}`} placeholder={`Linha ${i + 1}`} maxLength={LIMITS.item} value={item} onChange={(e) => set(items.map((x, j) => (j === i ? e.target.value : x)))} />
              {items.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label={`${label}: tirar a linha ${i + 1}`} onClick={() => set(items.filter((_, j) => j !== i))}><Trash2 /></Button>}
            </div>
          ))}
          {items.length < 10 && <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => set([...items, ''])}>Mais uma linha</Button>}
        </div>
      );
    }
    case 'image':
      return <ImageField block={block} label={label} onChange={onChange} />;
    case 'choice': {
      const items = block.items ?? ['', ''];
      const set = (next: string[], correct = block.correct ?? 0) => onChange({ items: next, correct });
      return (
        <div className="grid gap-2">
          <Textarea aria-label={`${label}: pergunta`} placeholder="A pergunta do desafio" maxLength={LIMITS.question} rows={2} value={block.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-[13px] text-muted-foreground">Opções (marca a certa)</legend>
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" className="size-5 shrink-0" name={`${block.key}-certa`} checked={(block.correct ?? 0) === i} onChange={() => onChange({ correct: i })} aria-label={`Opção ${LETTER(i)} é a certa`} />
                <Input aria-label={`${label}: opção ${LETTER(i)}`} placeholder={`Opção ${LETTER(i)}`} maxLength={LIMITS.option} value={item} onChange={(e) => set(items.map((x, j) => (j === i ? e.target.value : x)))} />
                {items.length > 2 && (
                  <Button type="button" variant="ghost" size="icon" aria-label={`Tirar a opção ${LETTER(i)}`} onClick={() => set(items.filter((_, j) => j !== i), i < (block.correct ?? 0) ? (block.correct ?? 0) - 1 : Math.min(block.correct ?? 0, items.length - 2))}><Trash2 /></Button>
                )}
              </div>
            ))}
          </fieldset>
          {items.length < 5 && <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => set([...items, ''])}>Mais uma opção</Button>}
          <Textarea aria-label={`${label}: explicação`} placeholder="Porque é que esta é a certa (aparece depois de responderem)" maxLength={LIMITS.explanation} rows={2} value={block.explanation ?? ''} onChange={(e) => onChange({ explanation: e.target.value })} />
        </div>
      );
    }
  }
}

/** O construtor de publicações (#388): escolhe-se um modelo, montam-se os blocos e vê-se o resultado ao lado. */
export function PostBuilder({ classId }: { classId: number }) {
  const router = useRouter();
  const [template, setTemplate] = useState<Template>(TEMPLATES[0]);
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<BlockDraft[]>(() => templateBlocks(TEMPLATES[0]));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filled = payloadOf(blocks);
  const kind: BuiltKind = template.kind;
  const problem = problemOf(kind, title, filled);

  const choose = (next: Template) => {
    setTemplate(next);
    // Trocar de modelo só refaz os blocos quando o aluno ainda não escreveu nada.
    if (filled.length === 0) setBlocks(templateBlocks(next));
  };
  const update = (key: string, patch: Partial<BlockDraft>) => setBlocks((list) => list.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  const add = (type: BlockType) => setBlocks((list) => (list.length >= LIMITS.blocks ? list : [...list, emptyBlock(type)]));

  const publish = (e: React.FormEvent) => {
    e.preventDefault();
    if (problem) { setError(problem); return; }
    setError(null);
    startTransition(async () => {
      const result = await publishBuiltPostAction(classId, kind, title, blocks);
      if (result.ok) router.push('/inicio');
      else setError(result.message);
    });
  };

  return (
    <form className="grid gap-5 lg:grid-cols-2 lg:items-start" onSubmit={publish} noValidate>
      <div className="grid gap-5">
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold">Que publicação queres criar?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {TEMPLATES.map((t) => (
              <label key={t.kind} className={cn('flex min-h-14 cursor-pointer flex-col justify-center rounded-xl border px-3 py-2 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40', template.kind === t.kind ? 'border-primary bg-accent' : 'hover:bg-secondary')}>
                <input type="radio" name="modelo" className="sr-only" checked={template.kind === t.kind} onChange={() => choose(t)} />
                <span className="text-[15px] font-semibold">{t.label}</span>
                <span className="text-[13px] text-muted-foreground">{t.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="grid gap-1 text-sm font-semibold">
          Título (opcional)
          <Input maxLength={LIMITS.title} placeholder="Dá um nome à publicação" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <ol className="grid gap-3" aria-label="Blocos da publicação">
          {blocks.map((b, i) => {
            const Icon = ICON[b.type];
            const label = `${BLOCK_LABEL[b.type]} ${i + 1}`;
            return (
              <li key={b.key} className="grid gap-2.5 rounded-xl border bg-card p-3">
                <div className="flex items-center gap-1">
                  <Icon className="size-4 text-muted-foreground" aria-hidden />
                  <h2 className="flex-1 text-sm font-semibold">{label}</h2>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Subir: ${label}`} disabled={i === 0} onClick={() => setBlocks((l) => moved(l, i, i - 1))}><ArrowUp /></Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Descer: ${label}`} disabled={i === blocks.length - 1} onClick={() => setBlocks((l) => moved(l, i, i + 1))}><ArrowDown /></Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Tirar: ${label}`} onClick={() => setBlocks((l) => l.filter((x) => x.key !== b.key))}><Trash2 /></Button>
                </div>
                <BlockFields block={b} label={label} onChange={(patch) => update(b.key, patch)} />
              </li>
            );
          })}
        </ol>

        <section className="grid gap-2" aria-label="Acrescentar um bloco">
          <h2 className="text-sm font-semibold">Acrescentar</h2>
          <div className="flex flex-wrap gap-2">
            {ADDABLE.map((type) => {
              const Icon = ICON[type];
              return <Button key={type} type="button" variant="outline" size="sm" disabled={blocks.length >= LIMITS.blocks} onClick={() => add(type)}><Icon />{BLOCK_LABEL[type]}</Button>;
            })}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:sticky lg:top-20">
        <section className="grid gap-3 rounded-xl border bg-card p-4" aria-label="Pré-visualização">
          <h2 className="text-sm font-semibold text-muted-foreground">Pré-visualização</h2>
          {title.trim() && <h3 className="font-semibold">{title.trim()}</h3>}
          {filled.length > 0 ? <PostBlocksView blocks={filled} /> : <p className="text-sm text-muted-foreground">Preenche os blocos e vê aqui como a publicação vai aparecer na turma.</p>}
        </section>
        <div aria-live="polite">{error && <Alert variant="destructive">{error}</Alert>}</div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push('/inicio')}>Cancelar</Button>
          <Button type="submit" disabled={pending || !!problem}>{pending ? 'A publicar…' : 'Publicar'}</Button>
        </div>
        {problem && filled.length > 0 && <p className="text-right text-[13px] text-muted-foreground">{problem}</p>}
      </div>
    </form>
  );
}
