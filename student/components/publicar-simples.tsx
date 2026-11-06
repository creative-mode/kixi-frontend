'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { canPublish, MAX_POST_LENGTH } from '@/lib/feed-rules';
import { publishPostAction } from '@/lib/feed-actions';

const TIPOS = [
  { value: 'doubt', label: 'Pergunta', hint: 'Alunos da tua turma podem responder' },
  { value: 'topic', label: 'Dica de estudo', hint: 'Partilha algo que te ajudou' },
] as const;

/** O ecrã «Criar» do protótipo: cabeçalho com Cancelar/Publicar e uma caixa grande para a pergunta. */
export function PublicarSimples({ classId, turma }: { classId: number; turma: string }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [type, setType] = useState<'doubt' | 'topic'>('doubt');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const publish = () => {
    if (!canPublish(text)) return;
    setError(null);
    start(async () => {
      const r = await publishPostAction(classId, type, text.trim()).catch(() => ({ ok: false as const, message: 'Não foi possível publicar agora. O texto ficou no campo.' }));
      if (!r.ok) { setError(r.message); return; }
      router.push('/inicio');
    });
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); publish(); }} className="flex min-w-0 flex-col px-4 pt-3 pb-28 md:px-0 md:pt-7 md:pb-12">
      <header className="flex items-center justify-between">
        <Link href="/inicio" className="px-1 py-3 text-[15px] font-semibold text-[#3d4a41] no-underline">Cancelar</Link>
        <button type="submit" disabled={pending || !canPublish(text)} className="h-[42px] rounded-full bg-[#1f5a2c] px-5 text-sm font-bold text-white disabled:opacity-50">{pending ? 'A publicar…' : 'Publicar'}</button>
      </header>

      <label htmlFor="pergunta" className="mt-5 text-[13px] font-semibold text-[#617066]">{type === 'doubt' ? 'A tua pergunta' : 'A tua dica'}</label>
      <textarea
        id="pergunta"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_POST_LENGTH}
        placeholder={type === 'doubt' ? 'Na questão 3, porque é que…' : 'Um truque que me ajudou foi…'}
        className="mt-2 min-h-[150px] w-full resize-none border-0 bg-transparent text-[22px] leading-[1.45] font-medium outline-none placeholder:text-[#a5aea7]"
      />
      <span className="self-end text-[13px] text-[#617066] tabular-nums">{text.length}/{MAX_POST_LENGTH}</span>
      {error && <p role="alert" className="text-sm font-semibold text-[#c2383e]">{error}</p>}

      <div className="mt-3 border-t border-[#eef0ec]" role="radiogroup" aria-label="Tipo de publicação">
        {TIPOS.map((t) => (
          <button key={t.value} type="button" role="radio" aria-checked={type === t.value} onClick={() => setType(t.value)} className="flex min-h-[58px] w-full items-center justify-between gap-3 border-0 border-b border-[#eef0ec] bg-transparent py-2 text-left">
            <span className="flex flex-col"><span className="text-[13px] text-[#617066]">{t.hint}</span><span className="text-base font-bold">{t.label}</span></span>
            <span className={`size-[22px] rounded-full border-2 ${type === t.value ? 'border-[#1f5a2c] bg-[#1f5a2c] shadow-[inset_0_0_0_4px_#fff]' : 'border-[#cdd6c9]'}`} />
          </button>
        ))}
        <div className="flex min-h-[58px] items-center justify-between border-b border-[#eef0ec] py-2">
          <span className="flex flex-col"><span className="text-[13px] text-[#617066]">Quem pode responder</span><span className="text-base font-bold">Alunos da turma {turma}</span></span>
        </div>
      </div>
      <Link href="/publicar?avancado=1" className="mt-5 self-start text-sm font-bold text-[#1f5a2c] no-underline">Junta imagens, passos ou fórmulas</Link>
    </form>
  );
}
