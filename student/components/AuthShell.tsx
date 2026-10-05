import { Logo } from './brand';

/** Ecrã das páginas de entrada: uma coluna centrada, só com a marca e o formulário. */
export function AuthShell({ title, lead, children }: { title: string; lead: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-10">
      <Logo size={28} wordmark />
      <div className="grid w-full max-w-[400px] gap-6 rounded-xl border bg-card p-6 shadow-xs sm:p-8">
        <div className="grid gap-1.5">
          <h1 className="text-2xl leading-tight font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{lead}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
