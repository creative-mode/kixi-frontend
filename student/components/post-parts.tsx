import Link from 'next/link';
import { Ico } from '@/components/ui/ico';
import { PostBlocksView } from '@/components/post-blocks-view';
import { SimulationCard, type SimulationCardData } from '@/components/simulation-card';
import { UserAvatar } from '@/components/user-avatar';
import { VerifiedBadge } from '@/components/verified-badge';
import { CLASSMATE_LABEL, REFLECTION_LABEL } from '@/lib/feed-rules';
import type { PostBlock } from '@/lib/post-blocks';

/** O que uma publicação mostra: o do feed (`FeedPost`) e o de uma pré-visualização têm esta forma. */
export interface PostContent {
  title: string | null;
  content: string;
  simulation?: SimulationCardData | null;
  blocks?: PostBlock[] | null;
}

/**
 * As peças visuais de uma publicação, partilhadas pelo cartão do feed (`PostCard`) e pelas pré-visualizações
 * (construtor e «partilhar resultado»): o que o aluno vê antes de publicar é exatamente o que a turma vai ver.
 */

export interface HeaderAuthor {
  name: string;
  photo: string | null;
  verified?: boolean;
  classmate?: boolean;
  /** Ligação ao perfil; sem ela (o próprio, ou uma pré-visualização) o nome é texto. */
  href?: string;
}

export function PostHeader({ author, typeLabel, when, publishing = false }: { author: HeaderAuthor; typeLabel: string; when: string; publishing?: boolean }) {
  return (
    <header className="flex items-center gap-3">
      <UserAvatar name={author.name} src={author.photo} size={38} />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="flex flex-wrap items-center gap-x-1.5">
          {author.href ? (
            <Link prefetch={false} href={author.href} className="inline-flex min-h-6 items-center text-sm font-bold hover:underline focus-visible:underline">{author.name}<span className="sr-only">, ver perfil</span></Link>
          ) : (
            <span className="text-sm font-bold">{author.name}</span>
          )}
          {author.verified && <VerifiedBadge label="Perfil verificado" className="self-center" />}
          {author.classmate && <span title={CLASSMATE_LABEL} role="img" aria-label={CLASSMATE_LABEL} className="self-center text-muted-foreground"><Ico name="users" size={15} /></span>}
        </span>
        {publishing
          ? <span role="status" aria-live="polite" className="text-[13px] font-semibold text-muted-foreground">A publicar…</span>
          : <span className="lbl"><span role="img" aria-label={typeLabel}>{typeLabel}</span>, {when}</span>}
      </div>
    </header>
  );
}

export function PostBody({ post, correctionHref = null }: { post: PostContent; correctionHref?: string | null }) {
  return (
    <div className="mt-[11px] grid gap-2.5">
      {post.title && <h3 className="text-[15px] font-bold leading-normal">{post.title}</h3>}
      {post.simulation && <SimulationCard card={post.simulation} correctionHref={correctionHref} />}
      {post.simulation && post.content && (
        <p className="-mb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">{REFLECTION_LABEL}</p>
      )}
      {post.blocks && post.blocks.length > 0
        ? <PostBlocksView blocks={post.blocks} />
        : post.content && <p className="text-[15px] leading-normal break-words">{post.content}</p>}
    </div>
  );
}

/** As ações como aparecem no feed, mas inertes: numa pré-visualização ainda não há nada a que responder. */
export function PostActionsPreview() {
  const icon = (d: string) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
  return (
    <span className="acoes" aria-hidden="true">
      <span className="acao">{icon('M3 12a9 9 0 1 1 4 7.5L3 21l1.6-4.3A8.96 8.96 0 0 1 3 12Z')}0</span>
      <span className="acao">{icon('M7 11v9H4v-9zm0 0 4-7a2 2 0 0 1 3.6 1.7L13 10h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H9a2 2 0 0 1-2-2')}</span>
      <span className="acao ml-auto"><Ico name="flag" size={15} /></span>
    </span>
  );
}

/** A publicação inteira, como vai aparecer no feed da turma. */
export function PostPreview({ author, typeLabel, post }: { author: HeaderAuthor; typeLabel: string; post: PostContent }) {
  return (
    <article className="post" style={{ borderTop: 0, padding: 0 }}>
      <div className="min-w-0">
        <PostHeader author={author} typeLabel={typeLabel} when="agora" />
        <PostBody post={post} />
        <PostActionsPreview />
      </div>
    </article>
  );
}
