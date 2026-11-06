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
  const logo = <Logo size={33} wordmark />;
  return (
    <main className="relative flex above-banner-min-h flex-col items-center justify-center gap-6 px-6 pt-6 pb-32 sm:px-12 sm:pt-10">
      {landing ? (
        <a
          href={landing}
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-[#5f6b63] no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:absolute sm:top-8 sm:left-12"
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
      <div className="grid w-full max-w-[380px] gap-6">
        <div className="grid gap-1.5 text-center">
          <h1 className="text-[26px] leading-tight font-extrabold tracking-tight">{title}</h1>
          <p className="text-[15px] text-[#5f6b63]">{lead}</p>
        </div>
        {notice ? (
          <div role="status" className="flex items-start gap-2 rounded-xl border border-primary/30 bg-accent p-3 text-sm text-foreground">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{notice}</span>
          </div>
        ) : null}
        {children}
      </div>
    </main>
  );
}
