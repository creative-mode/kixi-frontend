import { cn } from '@/lib/utils';

/**
 * As três colunas do início e do perfil (como numa rede social): o aluno e os amigos à esquerda,
 * o conteúdo ao meio e os widgets à direita. Em ecrã estreito empilha por ordem de importância:
 * o cartão do aluno, o conteúdo, os amigos e os widgets (ver `.social-grid` em globals.css).
 */
export function SocialLayout({ identity, friends, rail, children, className }: {
  identity: React.ReactNode;
  friends: React.ReactNode;
  rail: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('social-grid mx-auto w-full max-w-[1320px] items-start gap-4 p-3 pb-24 md:p-5 md:pb-10', className)}>
      <div data-area="identity" className="grid content-start gap-4">{identity}</div>
      <div data-area="main" className="flex min-w-0 flex-col gap-4">{children}</div>
      <div data-area="friends" className="grid content-start gap-4">{friends}</div>
      <aside data-area="rail" aria-label="Destaques" className="social-rail grid content-start gap-4">{rail}</aside>
    </div>
  );
}
