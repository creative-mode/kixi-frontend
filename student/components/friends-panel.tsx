'use client';

import { useEffect, useState, useTransition } from 'react';
import { Check, UserPlus, X } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/user-avatar';
import {
  acceptFriendAction,
  loadConnectionsAction,
  removeFriendAction,
  requestFriendAction,
  searchColleaguesAction,
  type Connections,
} from '@/lib/friends-actions';
import type { Colleague } from '@/lib/friends';

/**
 * Quem o aluno segue, e quem quer segui-lo (kixi#121). O ranking de amigos só compara o aluno
 * com quem aceitou, por isso é aqui que se convida e se responde. A pesquisa só devolve colegas
 * do mesmo ano letivo; o backend decide quem aparece, o cliente não filtra nada.
 */
export function FriendsPanel({ onChange }: { onChange: () => void }) {
  const [connections, setConnections] = useState<Connections>({ friends: [], requests: [] });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Colleague[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reload = () =>
    startTransition(async () => {
      setConnections(await loadConnectionsAction());
    });

  useEffect(() => {
    reload();
  }, []);

  const run = (action: () => Promise<{ ok: true } | { ok: false; message: string }>, done?: string) =>
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? null : result.message);
      setNotice(result.ok ? (done ?? null) : null);
      setConnections(await loadConnectionsAction());
      if (result.ok) {
        setResults(null);
        setQuery('');
        onChange();
      }
    });

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      setResults(await searchColleaguesAction(query));
    });
  };

  const incoming = connections.requests.filter((r) => r.incoming && !r.accepted);
  const sent = connections.requests.filter((r) => !r.incoming && !r.accepted);

  return (
    <Card className="gap-4">
      <CardHeader><CardTitle>Os teus amigos</CardTitle></CardHeader>
      <CardContent className="grid gap-5">
        {message && <Alert variant="destructive">{message}</Alert>}
        {notice && <Alert role="status">{notice}</Alert>}

        {incoming.length > 0 && (
          <section className="grid gap-2" aria-label="Pedidos recebidos">
            <h3 className="text-sm font-semibold">Pedidos para ti</h3>
            {incoming.map((r) => (
              <div key={r.friendshipId} className="flex items-center gap-3 text-sm">
                <UserAvatar name={r.displayName} src={r.photo} size={28} />
                <span className="min-w-0 flex-1 truncate">{r.displayName}</span>
                <Button size="sm" disabled={pending} onClick={() => run(() => acceptFriendAction(r.friendshipId))}><Check />Aceitar</Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => removeFriendAction(r.friendshipId))} aria-label={`Recusar ${r.displayName}`}><X /></Button>
              </div>
            ))}
          </section>
        )}

        <section className="grid gap-2" aria-label="Amigos">
          {connections.friends.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não tens amigos. Procura um colega da tua turma para te comparares só com ele.</p>
          ) : (
            connections.friends.map((f) => (
              <div key={f.friendshipId} className="flex items-center gap-3 text-sm">
                <UserAvatar name={f.displayName} src={f.photo} size={28} />
                <span className="min-w-0 flex-1 truncate">{f.displayName}</span>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => removeFriendAction(f.friendshipId))}>Remover</Button>
              </div>
            ))
          )}
          {sent.map((r) => (
            <div key={r.friendshipId} className="flex items-center gap-3 text-sm text-muted-foreground">
              <UserAvatar name={r.displayName} src={r.photo} size={28} />
              <span className="min-w-0 flex-1 truncate">{r.displayName} · pedido enviado</span>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => removeFriendAction(r.friendshipId))}>Cancelar</Button>
            </div>
          ))}
        </section>

        <section className="grid gap-2" aria-label="Procurar colegas">
          <form className="flex gap-2" onSubmit={search}>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Procurar um colega da turma" aria-label="Procurar um colega" />
            <Button type="submit" variant="outline" disabled={pending}>Procurar</Button>
          </form>
          {results && results.length === 0 && <p className="text-sm text-muted-foreground">Nenhum colega encontrado.</p>}
          {results?.map((c) => (
            <div key={c.accountId} className="flex items-center gap-3 text-sm">
              <UserAvatar name={c.displayName} src={c.photo} size={28} />
              <span className="min-w-0 flex-1 truncate">{c.displayName}</span>
              <Button size="sm" disabled={pending} onClick={() => run(() => requestFriendAction(c.accountId), `Pedido enviado a ${c.displayName}. Aparece nos amigos quando aceitar.`)}><UserPlus />Convidar</Button>
            </div>
          ))}
        </section>
      </CardContent>
    </Card>
  );
}
