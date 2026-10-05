import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <section className="w-full max-w-lg space-y-5 rounded-xl border bg-card p-8 text-center shadow-xs">
        <p className="text-sm font-semibold text-muted-foreground">Erro 404</p>
        <h1 className="text-2xl font-bold tracking-tight">Página não encontrada</h1>
        <p className="text-muted-foreground">
          O endereço que procuraste não existe ou já não está disponível.
        </p>
        <Link className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" href="/inicio">
          Voltar ao início
        </Link>
      </section>
    </main>
  );
}
