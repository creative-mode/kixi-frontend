'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
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
  BLOCK_LABEL, LIMITS, TEMPLATES, TONE_LABEL, emptyBlock, imagesWithoutAlt, moved, payloadOf, problemOf, templateBlocks,
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
      <Input id={`${block.key}-alt`} aria-label={`${label}: descrição da imagem`} placeholder="Descrição para quem não vê a imagem" maxLength={150} value={block.alt ?? ''} onChange={(e) => onChange({ alt: e.target.value })} />
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
  /** O aviso das imagens sem descrição foi mostrado nesta tentativa de publicar. */
  const [altWarning, setAltWarning] = useState(false);

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

  // As posições contam na lista do construtor (a mesma numeração dos rótulos «Imagem 5»).
  const withoutAlt = imagesWithoutAlt(blocks);
  const showAltWarning = altWarning && withoutAlt.length > 0;

  const send = () => {
    setError(null);
    setAltWarning(false);
    startTransition(async () => {
      const result = await publishBuiltPostAction(classId, kind, title, blocks);
      if (result.ok) router.push('/inicio');
      else setError(result.message);
    });
  };

  /**
   * Uma imagem sem descrição não impede de publicar, mas só se publica assim por «Publicar mesmo assim»: enquanto
   * faltar uma descrição, «Publicar» (de novo, ou com Enter) volta sempre ao aviso, em vez de o contornar.
   */
  const publish = (e: React.FormEvent) => {
    e.preventDefault();
    if (problem) { setError(problem); return; }
    if (withoutAlt.length > 0) { setError(null); setAltWarning(true); return; }
    send();
  };

  const writeAlt = () => {
    setAltWarning(false);
    document.getElementById(`${blocks[withoutAlt[0]!]!.key}-alt`)?.focus();
  };

  return (
    <form className="mx-auto flex w-full max-w-[640px] flex-col px-4 pt-3 pb-28 md:px-0 md:pt-7 md:pb-12" onSubmit={publish} noValidate>
      <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-white/95 px-4 py-2 backdrop-blur md:mx-0 md:px-0">
        <Link href="/publicar" className="px-1 py-3 text-[15px] font-semibold text-[#3d4a41] no-underline">&larr; Simples</Link>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => router.push('/inicio')} className="h-[42px] rounded-full px-4 text-[15px] font-semibold text-[#3d4a41]">Cancelar</button>
          <button type="submit" disabled={pending || !!problem} className="h-[42px] rounded-full bg-[#1f5a2c] px-5 text-sm font-bold text-white disabled:opacity-50">{pending ? 'A publicar…' : 'Publicar'}</button>
        </div>
      </header>

      <fieldset className="m-0 mt-4 flex flex-wrap gap-2 border-0 p-0"><legend className="sr-only">Que publicação queres criar?</legend>
        {TEMPLATES.map((t) => (
          <label key={t.kind} title={t.hint} className={cn('flex h-10 cursor-pointer items-center rounded-full border px-4 text-sm font-bold has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40', template.kind === t.kind ? 'border-[#1f5a2c] bg-[#1f5a2c] text-white' : 'border-[#dde3da] bg-white text-[#3d4a41]')}>
            <input type="radio" name="modelo" className="sr-only" checked={template.kind === t.kind} onChange={() => choose(t)} />
            {t.label}
          </label>
        ))}
      </fieldset>
      <p className="mt-2 text-[13px] text-[#617066]">{template.hint}</p>

      <label className="sr-only" htmlFor="pb-titulo">Título (opcional)</label>
      <input id="pb-titulo" maxLength={LIMITS.title} placeholder="Título (opcional)" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-5 w-full border-0 border-b border-[#eef0ec] bg-transparent pb-3 text-[24px] leading-tight font-extrabold tracking-[-0.02em] outline-none placeholder:text-[#a5aea7] focus:border-[#1f5a2c]" />

      <ol className="m-0 mt-2 flex list-none flex-col p-0" aria-label="Blocos da publicação">
        {blocks.map((b, i) => {
          const Icon = ICON[b.type];
          const label = `${BLOCK_LABEL[b.type]} ${i + 1}`;
          return (
            <li key={b.key} className="group flex flex-col gap-2 border-b border-[#eef0ec] py-4">
              <div className="flex items-center gap-1">
                <Icon className="size-4 text-[#617066]" aria-hidden />
                <h2 className="m-0 flex-1 text-[13px] font-bold tracking-[.04em] text-[#617066] uppercase">{label}</h2>
                <div className="flex items-center opacity-60 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  <Button type="button" variant="ghost" size="icon" className="size-9" aria-label={`Subir: ${label}`} disabled={i === 0} onClick={() => setBlocks((l) => moved(l, i, i - 1))}><ArrowUp /></Button>
                  <Button type="button" variant="ghost" size="icon" className="size-9" aria-label={`Descer: ${label}`} disabled={i === blocks.length - 1} onClick={() => setBlocks((l) => moved(l, i, i + 1))}><ArrowDown /></Button>
                  <Button type="button" variant="ghost" size="icon" className="size-9" aria-label={`Tirar: ${label}`} onClick={() => setBlocks((l) => l.filter((x) => x.key !== b.key))}><Trash2 /></Button>
                </div>
              </div>
              <BlockFields block={b} label={label} onChange={(patch) => update(b.key, patch)} />
            </li>
          );
        })}
      </ol>

      <section className="mt-4" aria-label="Acrescentar um bloco">
        <h2 className="m-0 mb-2 text-[13px] font-bold tracking-[.04em] text-[#617066] uppercase">Acrescentar</h2>
        <div className="flex flex-wrap gap-2">
          {ADDABLE.map((type) => {
            const Icon = ICON[type];
            return <button key={type} type="button" disabled={blocks.length >= LIMITS.blocks} onClick={() => add(type)} className="flex h-10 items-center gap-1.5 rounded-full bg-[#f5f6f4] px-3.5 text-sm font-semibold text-[#3d4a41] disabled:opacity-50"><Icon className="size-4" aria-hidden />{BLOCK_LABEL[type]}</button>;
          })}
        </div>
      </section>

      <details className="mt-6 rounded-2xl border border-[#e9ebe7]" aria-label="Pré-visualização">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-[15px] font-bold [&::-webkit-details-marker]:hidden">Pré-visualização<span className="text-[13px] font-semibold text-[#617066]">como vai aparecer na turma</span></summary>
        <div className="grid gap-3 border-t border-[#eef0ec] p-4">
          {title.trim() && <h3 className="m-0 font-bold">{title.trim()}</h3>}
          {filled.length > 0 ? <PostBlocksView blocks={filled} /> : <p className="text-sm text-[#617066]">Preenche os blocos e vê aqui o resultado.</p>}
        </div>
      </details>

      <div aria-live="polite" className="mt-4 empty:hidden">{error && <Alert variant="destructive">{error}</Alert>}</div>
      {showAltWarning && (
        <div role="alert" className="mt-4 grid gap-3 rounded-2xl bg-[#fbf1d6] p-4 text-sm text-[#8a5a00]">
          <p className="m-0">
            {withoutAlt.length === 1 ? 'Há 1 imagem sem descrição' : `Há ${withoutAlt.length} imagens sem descrição`}{' '}
            ({withoutAlt.map((i) => `${BLOCK_LABEL.image} ${i + 1}`).join(', ')}). Quem usa um leitor de ecrã não vai saber o que mostra{withoutAlt.length === 1 ? '' : 'm'}.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={writeAlt}>Escrever a descrição</Button>
            <Button type="button" onClick={send} disabled={pending}>Publicar mesmo assim</Button>
          </div>
        </div>
      )}
      {problem && filled.length > 0 && <p className="mt-3 text-[13px] text-[#617066]">{problem}</p>}
    </form>
  );
}
