'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { BookOpen, LayoutTemplate, MessageCircle } from 'lucide-react';
import { UserAvatar } from '@/components/user-avatar';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { canPublish } from '@/lib/feed-rules';
import { publishPostAction } from '@/lib/feed-actions';
import { useMe } from '@/lib/me-context';
import { fullName, photoUrl } from '@/lib/profile';

const SHORTCUTS = [
  { label: 'Fazer uma pergunta', short: 'Pergunta', icon: MessageCircle },
  { label: 'Dica de estudo', short: 'Dica', icon: BookOpen },
];

/** O compositor de publicações da turma, igual no início e no perfil. */
export function PostComposer({ classId }: { classId: number }) {
  const me = useMe();
  const [text, setText] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const publish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPublish(text)) return;
    setPublishing(true);
    setPublishError(null);
    startTransition(async () => {
      const result = await publishPostAction(classId, 'doubt', text);
      setPublishing(false);
      if (result.ok) setText('');
      else setPublishError(result.message);
    });
  };

  // `#publicar` (botão Publicar da barra lateral) leva o foco para aqui.
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const focusIfHash = () => { if (window.location.hash === '#publicar') field.current?.focus(); };
    focusIfHash();
    window.addEventListener('hashchange', focusIfHash);
    return () => window.removeEventListener('hashchange', focusIfHash);
  }, []);

  return (
    <form id="publicar" className="flex gap-3 border-b px-4 py-3" onSubmit={publish}>
      <UserAvatar name={fullName(me)} src={photoUrl(me)} size={44} />
      <div className="grid min-w-0 flex-1 gap-2">
        <Input ref={field} className="h-11 border-0 bg-transparent px-0 text-base shadow-none sm:text-lg focus-visible:ring-0" value={text} onChange={(e) => setText(e.target.value)} placeholder="Partilha uma dúvida ou uma dica" aria-label="Nova publicação" />
        <div className="flex items-center justify-between gap-2 border-t pt-2">
          <div className="-ml-3 flex flex-wrap gap-0.5">
            {SHORTCUTS.map((a) => (
              <Button key={a.label} type="button" aria-label={a.label} variant="ghost" size="sm" className="shrink-0 text-primary" onClick={() => setText((t) => t || a.label + ': ')}><a.icon /><span className="hidden sm:inline">{a.label}</span><span className="sm:hidden">{a.short}</span></Button>
            ))}
            <Button asChild variant="ghost" size="sm" className="shrink-0 text-primary">
              <Link href="/publicar" aria-label="Criar publicação com imagens e blocos"><LayoutTemplate /><span className="hidden sm:inline">Criar publicação</span><span className="sm:hidden">Criar</span></Link>
            </Button>
          </div>
          <Button type="submit" size="sm" disabled={!canPublish(text) || publishing}>Publicar</Button>
        </div>
        {publishError && <Alert variant="destructive">{publishError}</Alert>}
      </div>
    </form>
  );
}
