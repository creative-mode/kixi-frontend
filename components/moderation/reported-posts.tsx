'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Flag } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { listReportedPosts, setPostHidden } from '@/app/actions/moderation';
import { denunciasLabel, preview, splitByVisibility, type ReportedPost } from '@/lib/moderation/posts';
import { formatLuandaDateTime } from '@/lib/format';

/**
 * As publicações denunciadas pelos alunos (S2). Antes só existiam na API: o botão «Denunciar publicação» do aluno enviava para uma
 * fila que nenhum ecrã lia. O ADMIN vê as de todas as escolas e o professor as das suas turmas.
 *
 * Ocultar retira a publicação a toda a turma (também ao autor) e repor devolve-a; as duas coisas se desfazem, por isso não há
 * nota nem confirmação, ao contrário da moderação de perfis.
 */
export function ReportedPosts() {
  const [posts, setPosts] = useState<ReportedPost[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aTratar, setATratar] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    const r = await listReportedPosts();
    if (r.ok) {
      setPosts(r.data);
      setErro(null);
    } else {
      setErro(r.error);
    }
  }, []);

  // O mesmo desvio da fila de perfis: o lint recusa um `setState` directo dentro de um efeito.
  useEffect(() => {
    const task = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(task);
  }, [carregar]);

  const { visiveis, ocultas } = useMemo(() => splitByVisibility(posts ?? []), [posts]);

  async function alternar(post: ReportedPost) {
    setATratar(post.postId);
    setErro(null);
    try {
      const r = await setPostHidden(post.postId, !post.isHidden);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      await carregar();
    } catch (e: unknown) {
      setErro(e instanceof Error && e.message ? e.message : 'Não foi possível contactar o servidor.');
    } finally {
      setATratar(null);
    }
  }

  const cabecalho = (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[26px] font-extrabold text-foreground md:text-3xl">Publicações denunciadas</h1>
        <p className="text-sm text-muted-foreground">
          Publicações do feed que os alunos denunciaram. Ocultar retira-a a toda a turma, incluindo ao autor; pode repô-la quando quiser.
        </p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link href="/moderacao">
          <Flag size={16} aria-hidden /> Denúncias de perfis
        </Link>
      </Button>
    </header>
  );

  if (!posts) {
    return (
      <div className="grid gap-6">
        {cabecalho}
        {erro ? <p className="text-sm text-destructive" role="alert">{erro}</p> : <p className="text-sm text-muted-foreground">A carregar publicações…</p>}
      </div>
    );
  }

  const cartao = (post: ReportedPost) => (
    <Card key={post.postId} data-testid={`post-denunciado-${post.postId}`}>
      <CardContent className="grid gap-3 py-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Flag className="size-4 text-muted-foreground" aria-hidden />
          <span className="font-medium">{denunciasLabel(post.reportCount)}</span>
          <Badge variant="outline">Turma {post.classId}</Badge>
          {post.isHidden && <Badge variant="secondary">Oculta</Badge>}
          <span className="text-muted-foreground">· publicada {formatLuandaDateTime(post.createdAt)} · conta {post.authorAccountId}</span>
        </div>
        <p className="whitespace-pre-line text-sm">{preview(post.content)}</p>
        <div>
          <Button
            size="sm"
            variant={post.isHidden ? 'outline' : 'destructive'}
            disabled={aTratar !== null}
            onClick={() => void alternar(post)}
            data-testid={`${post.isHidden ? 'post-repor' : 'post-ocultar'}-${post.postId}`}
          >
            {post.isHidden ? <Eye size={16} aria-hidden /> : <EyeOff size={16} aria-hidden />}
            {aTratar === post.postId ? 'A guardar…' : post.isHidden ? 'Repor publicação' : 'Ocultar publicação'}
            <span className="sr-only"> da conta {post.authorAccountId}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid gap-6">
      {cabecalho}
      {erro && <p className="text-sm text-destructive" role="alert">{erro}</p>}

      <section aria-label="Publicações à vista" className="grid gap-3">
        <h2 className="text-lg font-semibold">À vista na turma ({visiveis.length})</h2>
        {visiveis.length === 0 ? <p className="text-sm text-muted-foreground">Não há publicações denunciadas por tratar.</p> : visiveis.map(cartao)}
      </section>

      {ocultas.length > 0 && (
        <section aria-label="Publicações ocultas" className="grid gap-3">
          <h2 className="text-lg font-semibold">Ocultas ({ocultas.length})</h2>
          {ocultas.map(cartao)}
        </section>
      )}
    </div>
  );
}
