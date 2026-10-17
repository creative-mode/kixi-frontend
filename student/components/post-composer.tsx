'use client';

import { useState, useTransition } from 'react';
import { BookOpen, MessageCircle } from 'lucide-react';
import { UserAvatar } from '@/components/user-avatar';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { canPublish } from '@/lib/feed-rules';
import { publishPostAction } from '@/lib/feed-actions';
import { useMe } from '@/lib/me-context';
import { fullName, photoUrl } from '@/lib/profile';

const SHORTCUTS = [
  { label: 'Fazer uma pergunta', icon: MessageCircle },
  { label: 'Dica de estudo', icon: BookOpen },
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

  return (
    <Card className="gap-3 py-4">
      <form className="grid gap-3 px-4" onSubmit={publish}>
        <div className="flex items-center gap-3">
          <UserAvatar name={fullName(me)} src={photoUrl(me)} size={40} />
          <Input className="h-11 rounded-full bg-secondary px-4" value={text} onChange={(e) => setText(e.target.value)} placeholder="Partilha uma dúvida ou um tema com a turma" aria-label="Nova publicação" />
          <Button type="submit" size="sm" disabled={!canPublish(text) || publishing}>Publicar</Button>
        </div>
        <div className="flex flex-wrap gap-1.5 md:pl-[52px]">
          {SHORTCUTS.map((a) => (
            <Button key={a.label} type="button" variant="ghost" size="sm" className="shrink-0 text-primary" onClick={() => setText((t) => t || a.label + ': ')}><a.icon />{a.label}</Button>
          ))}
        </div>
        {publishError && <Alert variant="destructive">{publishError}</Alert>}
      </form>
    </Card>
  );
}
