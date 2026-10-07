import { CircleAlert } from 'lucide-react';
import { Logo } from './brand';

export function AuthShell({
  title,
  lead,
  notice,
  children,
}: {
  title: string;
  lead: string;
  notice?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-10">
      <Logo size={28} wordmark />
      <div className="grid w-full max-w-[400px] gap-6 rounded-xl border bg-card p-6 shadow-xs sm:p-8">
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
