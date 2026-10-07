import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <section className="w-full max-w-lg space-y-5 rounded-xl border bg-card p-8 text-center shadow-xs">
        <p className="text-sm font-semibold text-muted-foreground">Erro 403</p>
        <h1 className="text-2xl font-bold tracking-tight">Acesso não permitido</h1>
        <p className="text-muted-foreground">
          A tua conta não tem permissão para ver esta área.
        </p>
        <Link className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" href="/">
          Voltar ao início
        </Link>
      </section>
    </main>
  );
}
