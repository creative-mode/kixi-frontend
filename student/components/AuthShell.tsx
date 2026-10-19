import { ArrowLeft, CircleAlert } from 'lucide-react';
import { Logo } from './brand';
import { appOrigin } from '@/lib/origin';

/**
 * A landing vive na raiz do gateway, fora do basePath `/aluno`. Um `<Link href="/">` do
 * Next acrescentava o basePath e dava `/aluno`, por isso estes links são `<a>` simples.
 * Com `APP_ORIGIN` configurado vai para lá; sem ele (desenvolvimento atrás do gateway),
 * `/` na mesma origem chega à landing.
 */
function landingHref(): string {
  const origin = appOrigin();
  return origin ? `${origin}/` : '/';
}

export function AuthShell({
  title,
  lead,
  notice,
  backToLanding = false,
  children,
}: {
  title: string;
  lead: string;
  notice?: string;
  /** Só para quem ainda não entrou (entrar, criar conta). No onboarding há sessão e a
   *  landing mandava o aluno de volta para dentro, por isso lá o link não aparece. */
  backToLanding?: boolean;
  children: React.ReactNode;
}) {
  const landing = backToLanding ? landingHref() : null;
  const logo = <Logo size={28} wordmark />;
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-10">
      {landing ? (
        <a
          href={landing}
          className="absolute top-4 left-4 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:top-6 sm:left-6"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Voltar ao início
        </a>
      ) : null}
      {landing ? (
        <a href={landing} aria-label="Kixi, página inicial" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
          {logo}
        </a>
      ) : logo}
      <div className="grid w-full max-w-[400px] gap-6 px-box p-6 sm:p-8">
        <div className="grid gap-1.5">
          <h1 className="text-2xl leading-tight font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{lead}</p>
        </div>
        {notice ? (
          <div role="status" className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{notice}</span>
          </div>
        ) : null}
        {children}
      </div>
    </main>
  );
}
