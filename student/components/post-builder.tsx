'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Check, ChevronDown, Eye, Heading, ImageIcon, Lightbulb, List, ListChecks, PenLine, Sigma, Trash2, Type, Users } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/user-avatar';
import { enviarImagemPostAction, publishBuiltPostAction, publishPostAction, updatePostAction } from '@/lib/feed-actions';
import { PostPreview } from '@/components/post-parts';
import { assetUrl } from '@/lib/assets';
import { useMe } from '@/lib/me-context';
import { useToast } from '@/components/ui/toast';
import { fullName, photoUrl } from '@/lib/profile';
import { canPublish } from '@/lib/feed-rules';
import {
  BLOCK_LABEL, LIMITS, TEMPLATES, TONE_LABEL, draftsFromBlocks, emptyBlock, imagesWithoutAlt, moved, payloadOf, problemOf, templateBlocks,
  type BlockDraft, type BlockType, type BuiltKind, type CalloutTone, type PostBlock, type Template,
} from '@/lib/post-blocks';
import { cn } from '@/lib/utils';

const ICON: Record<BlockType, typeof Type> = {
  heading: Heading, text: Type, list: List, callout: Lightbulb, formula: Sigma, image: ImageIcon, choice: ListChecks,
};
/** A barra de ferramentas: o que se acrescenta a uma publicação, pela ordem em que mais se usa. */
const TOOLBAR: BlockType[] = ['image', 'formula', 'list', 'callout', 'choice', 'heading', 'text'];
const LETTER = (i: number) => String.fromCharCode(65 + i);

/** O que se escreve primeiro, por tipo de publicação: a pergunta certa em vez de «Escreve aqui». */
const PROMPT: Record<BuiltKind, string> = {
  doubt: 'Qual é a tua dúvida? Conta o que já tentaste.',
  topic: 'Que dica de estudo queres partilhar com a turma?',
  study_card: 'Resume o essencial: o que se tem de saber.',
  solution: 'Explica a resolução, passo a passo.',
  challenge: 'Escreve o desafio e as opções.',
};

const TYPE_ICON: Record<BuiltKind, typeof Type> = { doubt: PenLine, topic: Lightbulb, study_card: List, solution: Sigma, challenge: ListChecks };

async function uploadImage(file: File): Promise<{ url?: string; error?: string }> {
  const form = new FormData();
  form.append('file', file);
  return enviarImagemPostAction(form);
}

function ImageField({ block, label, onChange }: { block: BlockDraft; label: string; onChange: (patch: Partial<BlockDraft>) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const result = await uploadImage(file);
    setBusy(false);
    if (result.url) onChange({ url: result.url });
    else setError(result.error ?? 'Não foi possível enviar a imagem.');
    if (input.current) input.current.value = '';
  };

  return (
    <div className="grid gap-3">
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id={`${block.key}-file`} aria-label={`${label}: escolher imagem`} onChange={(e) => pick(e.target.files?.[0])} />
      {block.url ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={assetUrl(block.url, 96)} alt="" width={64} height={64} className="size-16 rounded-xl border border-[#e4e7e1] object-cover" />
          <div className="grid gap-1">
            <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#1f5a2c]"><Check className="size-3.5" aria-hidden />Imagem pronta</span>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'A enviar…' : 'Trocar a imagem'}</Button>
          </div>
        </div>
      ) : (
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-[#cdd6c9] bg-white text-[#3d4a41] disabled:opacity-60">
          <ImageIcon className="size-6 text-[#1f5a2c]" aria-hidden />
          <span className="text-sm font-bold">{busy ? 'A enviar…' : 'Escolher imagem'}</span>
          <span className="text-[12px] text-[#617066]">PNG, JPG ou WEBP, até 2 MB. Também podes colar.</span>
        </button>
      )}
      {error && <Alert variant="destructive">{error}</Alert>}
      {block.url && (
        <>
          <Input id={`${block.key}-alt`} aria-label={`${label}: descrição da imagem`} placeholder="Descrição para quem não vê a imagem" maxLength={150} value={block.alt ?? ''} onChange={(e) => onChange({ alt: e.target.value })} />
          <Input aria-label={`${label}: legenda`} placeholder="Legenda (opcional)" maxLength={LIMITS.caption} value={block.caption ?? ''} onChange={(e) => onChange({ caption: e.target.value })} />
        </>
      )}
    </div>
  );
}

function BlockFields({ block, label, placeholder, onChange }: { block: BlockDraft; label: string; placeholder?: string; onChange: (patch: Partial<BlockDraft>) => void }) {
  switch (block.type) {
    case 'heading':
      return <input aria-label={label} placeholder="Um título curto" maxLength={LIMITS.heading} value={block.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} className="w-full border-0 bg-transparent p-0 text-[21px] leading-tight font-extrabold tracking-[-0.02em] text-[#121c15] outline-none placeholder:text-[#a5aea7]" />;
    case 'formula':
      return <Input aria-label={label} className="font-mono" placeholder="Por exemplo: M = C × (1 + i × t)" maxLength={LIMITS.formula} value={block.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />;
    case 'text':
      return <textarea aria-label={label} placeholder={placeholder ?? 'Escreve aqui'} maxLength={LIMITS.text} rows={placeholder ? 4 : 2} value={block.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} className="field-sizing-content min-h-12 w-full resize-none border-0 bg-transparent p-0 text-[17px] leading-relaxed text-[#121c15] outline-none placeholder:text-[#8a958d]" />;
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

/** Uma publicação que já existe, reaberta no construtor para ser editada (#753). */
export type EditingPost = {
  id: number;
  kind: BuiltKind;
  title: string | null;
  blocks: PostBlock[] | null;
  content: string;
};

/**
 * O construtor de publicações (#388), no desenho dos compositores que já conhecemos (X, LinkedIn): escreve-se logo, num só
 * campo; o tipo de publicação é uma escolha discreta; o que se acrescenta (imagem, fórmula, lista, destaque, desafio) está
 * numa barra de ferramentas em baixo; a pré-visualização é um botão, não um bloco permanente.
 *
 * Com `editing`, o mesmo construtor reabre a publicação com o conteúdo dela (#753): o tipo fica
 * fixo (não se transforma uma pergunta num desafio) e o botão passa a «Guardar».
 */
export function PostBuilder({ classId, editing }: { classId: number; editing?: EditingPost }) {
  const router = useRouter();
  const toast = useToast();
  const me = useMe();
  const firstTemplate = editing ? TEMPLATES.find((t) => t.kind === editing.kind) ?? TEMPLATES[0] : TEMPLATES[0];
  const [template, setTemplate] = useState<Template>(firstTemplate);
  const [typeOpen, setTypeOpen] = useState(false);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [showTitle, setShowTitle] = useState(Boolean(editing?.title));
  const [blocks, setBlocks] = useState<BlockDraft[]>(() => (editing
    ? draftsFromBlocks(editing.blocks, editing.content)
    : templateBlocks(TEMPLATES[0])));
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  /** O aviso das imagens sem descrição foi mostrado nesta tentativa de publicar. */
  const [altWarning, setAltWarning] = useState(false);
  const typeButton = useRef<HTMLButtonElement>(null);
  const typeMenu = useRef<HTMLFieldSetElement>(null);

  const filled = payloadOf(blocks);
  const kind: BuiltKind = template.kind;
  const name = fullName(me) || 'Tu';
  // Uma pergunta ou dica só de texto, sem título, publica-se como sempre (um texto simples): o feed mostra-a igual.
  const plainText = (kind === 'doubt' || kind === 'topic') && !title.trim() && filled.length === 1 && filled[0].type === 'text' ? (filled[0].text ?? '') : null;
  const problem = plainText !== null ? (canPublish(plainText) ? null : 'Escreve pelo menos 5 caracteres.') : problemOf(kind, title, filled);
  const total = blocks.reduce((n, b) => n + (b.text?.length ?? 0) + (b.items ?? []).reduce((m, i) => m + i.length, 0), 0);

  const choose = (next: Template) => {
    setTemplate(next);
    setTypeOpen(false);
    typeButton.current?.focus();
    // Trocar de tipo só refaz os blocos quando o aluno ainda não escreveu nada.
    if (filled.length === 0) setBlocks(templateBlocks(next));
  };
  const update = (key: string, patch: Partial<BlockDraft>) => setBlocks((list) => list.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  const add = (type: BlockType) => {
    setPreview(false);
    setBlocks((list) => (list.length >= LIMITS.blocks ? list : [...list, emptyBlock(type)]));
  };

  // Colar uma imagem (captura de ecrã, foto) acrescenta-a logo à publicação, como no X ou no LinkedIn.
  const paste = async (e: React.ClipboardEvent) => {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    const block = emptyBlock('image');
    setBlocks((list) => (list.length >= LIMITS.blocks ? list : [...list, block]));
    const result = await uploadImage(file);
    if (result.url) update(block.key, { url: result.url });
    else { setBlocks((list) => list.filter((b) => b.key !== block.key)); setError(result.error ?? 'Não foi possível enviar a imagem.'); }
  };

  // As posições contam na lista do construtor (a mesma numeração dos rótulos «Imagem 5»).
  const withoutAlt = imagesWithoutAlt(blocks);
  const showAltWarning = altWarning && withoutAlt.length > 0;

  const send = () => {
    setError(null);
    setAltWarning(false);
    startTransition(async () => {
      const result = editing
        ? await updatePostAction(editing.id, kind, title, blocks)
        : plainText !== null
          ? await publishPostAction(classId, kind as 'doubt' | 'topic', plainText.trim())
          : await publishBuiltPostAction(classId, kind, title, blocks);
      if (result.ok) {
        if (editing) toast('Publicação editada.');
        router.push('/inicio');
      } else setError(result.message);
    });
  };

  /**
   * Uma imagem sem descrição não impede de publicar, mas só se publica assim por «Publicar mesmo assim»: enquanto
   * faltar uma descrição, «Publicar» (de novo, ou com Enter) volta sempre ao aviso, em vez de o contornar.
   */
  const publish = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (problem) { setError(problem); return; }
    if (withoutAlt.length > 0) { setError(null); setAltWarning(true); return; }
    send();
  };

  const writeAlt = () => {
    setAltWarning(false);
    setPreview(false);
    window.setTimeout(() => document.getElementById(`${blocks[withoutAlt[0]!]!.key}-alt`)?.focus(), 0);
  };

  // Ctrl/Cmd + Enter publica, como nos outros compositores.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !pending) publish();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // Um clique fora do menu do tipo fecha-o.
  useEffect(() => {
    if (!typeOpen) return;
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!typeMenu.current?.contains(t) && !typeButton.current?.contains(t)) setTypeOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [typeOpen]);

  const TypeIcon = TYPE_ICON[kind];
  const firstTextKey = blocks.find((b) => b.type === 'text')?.key;

  return (
    <form className="mx-auto flex w-full max-w-[640px] flex-col px-4 pt-3 pb-52 md:px-0 md:pt-7 md:pb-12" onSubmit={publish} onPaste={paste} noValidate>
      <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-white/95 px-4 py-2 backdrop-blur md:mx-0 md:px-0">
        <button type="button" onClick={() => router.push('/inicio')} className="px-1 py-3 text-[15px] font-semibold text-[#3d4a41]">Cancelar</button>
        <div className="flex items-center gap-2">
          <button type="button" aria-pressed={preview} disabled={filled.length === 0} onClick={() => setPreview((v) => !v)} className={cn('flex h-[42px] items-center gap-1.5 rounded-full border px-4 text-sm font-bold disabled:opacity-40', preview ? 'border-[#1f5a2c] bg-[#f1f6ee] text-[#1f5a2c]' : 'border-[#dde3da] bg-white text-[#3d4a41]')}>
            <Eye className="size-4" aria-hidden />Pré-visualizar
          </button>
          <button type="submit" disabled={pending || !!problem} className="h-[42px] rounded-full bg-[#1f5a2c] px-5 text-sm font-bold text-white disabled:opacity-50">{pending ? (editing ? 'A guardar…' : 'A publicar…') : (editing ? 'Guardar' : 'Publicar')}</button>
        </div>
      </header>

      {preview && filled.length > 0 && (
        <section className="mt-4 rounded-2xl border border-[#e9ebe7] p-4" aria-label="Pré-visualização">
          <h2 className="m-0 mb-3 text-[13px] font-bold tracking-[.04em] text-[#617066] uppercase">Pré-visualização <span className="font-semibold normal-case tracking-normal">como vai aparecer na turma</span></h2>
          <PostPreview
            author={{ name, photo: photoUrl(me) }}
            typeLabel={template.label}
            post={{ title: title.trim() || null, content: plainText ?? '', simulation: null, blocks: plainText !== null ? null : filled }}
          />
          <Button type="button" variant="outline" className="mt-4" onClick={() => setPreview(false)}>Voltar a escrever</Button>
        </section>
      )}

      <div hidden={preview && filled.length > 0} className="mt-3 flex gap-3">
        <UserAvatar name={name} src={photoUrl(me)} size={44} className="mt-1" />
        <div className="min-w-0 flex-1">
          <div className="relative flex flex-wrap items-center gap-2">
            <strong className="mr-1 text-[15px]">{name}</strong>
            {editing ? (
              <span className="flex h-8 items-center gap-1.5 rounded-full border border-[#cdd6c9] bg-[#f1f6ee] px-3 text-[13px] font-bold text-[#1f5a2c]">
                <TypeIcon className="size-3.5" aria-hidden />{template.label}
              </span>
            ) : (
              <button ref={typeButton} type="button" aria-haspopup="true" aria-expanded={typeOpen} aria-label={`Tipo de publicação: ${template.label}`} onClick={() => setTypeOpen((v) => !v)} className="flex h-8 items-center gap-1.5 rounded-full border border-[#cdd6c9] bg-[#f1f6ee] pr-2.5 pl-3 text-[13px] font-bold text-[#1f5a2c]">
                <TypeIcon className="size-3.5" aria-hidden />{template.label}<ChevronDown className="size-3.5" aria-hidden />
              </button>
            )}
            <span className="flex h-8 items-center gap-1.5 rounded-full border border-[#e4e7e1] px-3 text-[13px] font-semibold text-[#617066]"><Users className="size-3.5" aria-hidden />Para a turma</span>
            {!editing && typeOpen && (
              <fieldset ref={typeMenu} className="absolute top-10 left-0 z-40 m-0 grid w-[min(340px,100%)] gap-0.5 rounded-2xl border border-[#e4e7e1] bg-white p-2 shadow-[0_12px_32px_rgba(18,28,21,0.14)]" onKeyDown={(e) => { if (e.key === 'Escape') { setTypeOpen(false); typeButton.current?.focus(); } }}>
                <legend className="sr-only">Que publicação queres criar?</legend>
                {TEMPLATES.map((t) => {
                  const Icon = TYPE_ICON[t.kind];
                  return (
                    <label key={t.kind} className={cn('flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40', template.kind === t.kind ? 'bg-[#f1f6ee]' : 'hover:bg-[#f5f6f4]')}>
                      <input type="radio" name="modelo" className="sr-only" checked={template.kind === t.kind} onChange={() => choose(t)} />
                      <Icon className="mt-0.5 size-[18px] shrink-0 text-[#1f5a2c]" aria-hidden />
                      <span className="grid"><span className="text-[14px] font-bold">{t.label}</span><span className="text-[12.5px] leading-snug text-[#617066]">{t.hint}</span></span>
                    </label>
                  );
                })}
              </fieldset>
            )}
          </div>

          {showTitle && (
            <>
              <label className="sr-only" htmlFor="pb-titulo">Título (opcional)</label>
              <input id="pb-titulo" autoFocus maxLength={LIMITS.title} placeholder="Título (opcional)" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-3 w-full border-0 bg-transparent text-[22px] leading-tight font-extrabold tracking-[-0.02em] outline-none placeholder:text-[#a5aea7]" />
            </>
          )}

          <ol className="m-0 mt-3 flex list-none flex-col gap-3 p-0" aria-label="Blocos da publicação">
            {blocks.map((b, i) => {
              const Icon = ICON[b.type];
              const label = `${BLOCK_LABEL[b.type]} ${i + 1}`;
              const plain = b.type === 'text' || b.type === 'heading';
              return (
                <li key={b.key} className={cn('group relative', !plain && 'rounded-2xl border border-[#e4e7e1] bg-[#fbfcfa] p-4')}>
                  {!plain && (
                    <div className="mb-2 flex items-center gap-1.5 text-[#617066]">
                      <Icon className="size-4" aria-hidden />
                      <h2 className="m-0 text-[12px] font-bold tracking-[.05em] uppercase">{BLOCK_LABEL[b.type]}</h2>
                    </div>
                  )}
                  <BlockFields block={b} label={label} placeholder={plain && b.key === firstTextKey && i === 0 ? PROMPT[kind] : undefined} onChange={(patch) => update(b.key, patch)} />
                  {blocks.length > 1 && (
                    <div className={cn('absolute flex items-center rounded-full bg-white/90 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100', plain ? '-top-1 right-0' : 'top-2 right-2')}>
                      <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Subir: ${label}`} disabled={i === 0} onClick={() => setBlocks((l) => moved(l, i, i - 1))}><ArrowUp /></Button>
                      <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Descer: ${label}`} disabled={i === blocks.length - 1} onClick={() => setBlocks((l) => moved(l, i, i + 1))}><ArrowDown /></Button>
                      <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Tirar: ${label}`} onClick={() => setBlocks((l) => l.filter((x) => x.key !== b.key))}><Trash2 /></Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

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
        </div>
      </div>

      {/* A barra de ferramentas fica sempre à mão: por cima da navegação no telemóvel, por baixo do texto no computador. */}
      <div role="toolbar" aria-label="Acrescentar à publicação" className="fixed inset-x-0 bottom-[calc(var(--ck-banner-h,0px)+84px)] z-20 border-t border-[#e9ece6] bg-white/95 px-3 py-2 backdrop-blur md:sticky md:inset-x-auto md:bottom-4 md:mt-6 md:rounded-full md:border md:px-3 md:shadow-[0_8px_30px_rgba(18,28,21,0.08)]">
        <div className="mx-auto flex max-w-[640px] items-center gap-1">
          {TOOLBAR.map((type) => {
            const Icon = ICON[type];
            return (
              <button key={type} type="button" aria-label={BLOCK_LABEL[type]} title={BLOCK_LABEL[type]} disabled={blocks.length >= LIMITS.blocks} onClick={() => add(type)} className="grid size-11 place-items-center rounded-full text-[#1f5a2c] transition-colors hover:bg-[#f1f6ee] focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-40">
                <Icon className="size-[22px]" aria-hidden />
              </button>
            );
          })}
          <button type="button" aria-pressed={showTitle} aria-label="Título da publicação" title="Título da publicação" onClick={() => setShowTitle((v) => !v)} className={cn('ml-1 flex h-9 items-center rounded-full px-3 text-[13px] font-bold', showTitle ? 'bg-[#f1f6ee] text-[#1f5a2c]' : 'text-[#617066] hover:bg-[#f5f6f4]')}>Título</button>
          <span className={cn('ml-auto text-[12px] tabular-nums', total > LIMITS.totalText * 0.9 ? 'font-bold text-[#c2383e]' : 'text-[#8a958d]')} aria-live="polite">{total > LIMITS.totalText * 0.6 ? `${LIMITS.totalText - total}` : ''}</span>
        </div>
      </div>
    </form>
  );
}
