/** Auth screens share the landing page's look: olive paper, hatch rules, compact controls. */
export function AuthShell({ title, sub, wide, children }: { title: string; sub?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="auth">
      <header className="auth__bar">
        <a href="/" className="auth__back">← Voltar ao início</a>
      </header>
      <main className="auth__main">
        <section className={wide ? 'auth__card auth__card--wide' : 'auth__card'}>
          <h1 className="auth__title">{title}</h1>
          {sub && <p className="auth__sub">{sub}</p>}
          {children}
        </section>
      </main>
    </div>
  );
}
