import { Logo } from './brand';

const SHIP =
  'M12 0h1v1h-1zM10 1h3v1h-3zM8 2h5v1h-5zM8 3h5v1h-5zM8 4h5v1h-5zM8 5h5v1h-5zM8 6h5v1h-5zM8 7h5v1h-5zM8 8h5v1h-5zM8 9h6v1h-6zM7 10h7v1h-7zM7 11h8v1h-8zM6 12h10v1h-10zM6 13h11v1h-11zM5 14h14v1h-14zM4 15h18v1h-18zM3 16h21v1h-21zM3 17h4v1h-4zM14 17h9v1h-9zM1 18h2v1h-2zM17 18h5v1h-5zM19 19h1v1h-1z';

/** A nave da marca, a disparar um tiro amarelo para o cartão: o único toque de cor viva do ecrã. */
export function ShipShot() {
  return (
    <div aria-hidden className="relative -mb-3 flex flex-col items-center">
      <svg viewBox="0 0 24 20" width="72" height="60" shapeRendering="crispEdges" className="text-primary drop-shadow-[0_3px_0_rgba(27,36,19,.25)]">
        <path d={SHIP} fill="currentColor" />
      </svg>
      <span className="mt-1.5 grid gap-1.5">
        <i className="block h-3 w-1.5 bg-highlight shadow-[0_0_0_1.5px_var(--primary)]" />
        <i className="block h-3 w-1.5 bg-highlight shadow-[0_0_0_1.5px_var(--primary)]" />
      </span>
    </div>
  );
}

/** Cartão das páginas de entrada: borda de tinta, sombra dura e faixa hachurada, como na landing. */
export function AuthCard({ title, lead, children }: { title: string; lead: string; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[400px] overflow-hidden rounded-xl border-[1.6px] border-primary bg-card shadow-[5px_5px_0_0_var(--primary)]">
      <div aria-hidden className="h-3.5 border-b-[1.6px] border-primary [background:repeating-linear-gradient(60deg,var(--primary)_0_1px,transparent_1px_5px)]" />
      <div className="grid gap-6 p-6 sm:p-8">
        <div className="grid gap-1.5">
          <h1 className="text-2xl leading-tight font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{lead}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Ecrã das páginas de entrada: uma coluna centrada, só com a marca e o formulário. */
export function AuthShell({ title, lead, children }: { title: string; lead: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-7 px-6 py-10">
      <ShipShot />
      <AuthCard title={title} lead={lead}>{children}</AuthCard>
      <Logo size={18} wordmark />
    </main>
  );
}
