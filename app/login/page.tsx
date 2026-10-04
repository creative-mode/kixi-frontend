'use client';

import { useState } from 'react';
import { loginAction } from '@/app/actions/auth';
import { useRouter } from 'next/navigation';
import './login.css';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    setUser(String(formData.get('usernameOrEmail') ?? ''));

    try {
      const result = await loginAction(formData);

      if (result.success) {
        router.push('/');
        router.refresh();
      } else {
        setError(result.error || 'Utilizador ou palavra-passe incorretos.');
      }
    } catch (error) {
      console.error('Erro no login:', error);
      setError('Não foi possível contactar o servidor. Tenta de novo.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth">
      <header className="auth__bar">
        <a href="/" className="auth__back">← Voltar ao início</a>
      </header>
      <main className="auth__main">
        <section className="auth__card">
          <h1 className="auth__title">Kixi Manager</h1>
          <p className="auth__sub">Painel de gestão do Banco de Enunciados.</p>
          <form onSubmit={handleSubmit} className="stack" style={{ gap: 12 }} noValidate>
            {error && <p role="alert" className="auth__error">{error}</p>}
            <div className="kx-field">
              <label className="kx-field__label" htmlFor="usernameOrEmail">Utilizador ou email</label>
              <input id="usernameOrEmail" name="usernameOrEmail" className="kx-field__input" placeholder="ex.: admin" autoComplete="username" defaultValue={user} required disabled={isLoading} autoFocus />
            </div>
            <div className="kx-field">
              <label className="kx-field__label" htmlFor="password">Palavra-passe</label>
              <input id="password" name="password" type="password" className="kx-field__input" autoComplete="current-password" required disabled={isLoading} />
            </div>
            <button type="submit" className="auth__submit" disabled={isLoading} aria-busy={isLoading}>
              <span>{isLoading ? 'A processar…' : 'Entrar'}</span>
            </button>
          </form>
          <p className="auth__foot">Problemas no acesso? Contacta o suporte técnico.</p>
        </section>
      </main>
    </div>
  );
}
