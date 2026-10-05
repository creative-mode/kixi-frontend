import { Icon, Logo } from './ui';

const POINTS = ['Simulações com as provas da tua escola', 'Um tutor que explica cada erro e cita a prova', 'A tua turma por perto, para perguntar e partilhar'];

export function AuthShell({ title, lead, children }: { title: string; lead: string; children: React.ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth__aside">
        <Logo size={30} wordmark />
        <div>
          <h2>Estuda com as provas da tua escola.</h2>
          <p>Faz simulações, tira dúvidas e vê como a tua turma está a evoluir.</p>
        </div>
        <ul className="auth__points">{POINTS.map((p) => <li key={p}><Icon name="check" size={18} />{p}</li>)}</ul>
      </aside>
      <main className="auth__main">
        <div className="auth__box">
          <Logo size={24} wordmark className="auth__logo-m" />
          <div><h1>{title}</h1><p style={{ marginTop: 6 }} className="muted">{lead}</p></div>
          {children}
        </div>
      </main>
    </div>
  );
}
