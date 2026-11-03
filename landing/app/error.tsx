'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Footer } from '@/components/sections/Footer';
import { Header } from '@/components/sections/Header';

/** Fronteira de erro da landing: a mesma identidade do 404 — cabeçalho,
 *  tipografia e botões — em vez do ecrã em branco. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="wrap nf">
      <a href="#conteudo" className="skip">Saltar para o conteúdo</a>
      <Header />
      <main id="conteudo" tabIndex={-1} className="lp-stack">
        <div role="alert">
          <p className="nf__code">ERRO</p>
          <h1 className="nf__title">Algo falhou, mas não perdeste nada</h1>
          <p className="nf__message">
            Tenta de novo. Se continuar, volta ao início e continua a estudar.
          </p>
        </div>
        <div className="actions nf__actions">
          <span className="kx-btn-wrap kx-scope">
            <button type="button" onClick={reset} className="kx-btn kx-btn--lg">
              <span className="kx-btn__label">Tentar de novo</span>
            </button>
          </span>
          <span className="kx-btn-wrap kx-scope">
            <Link href="/" className="kx-btn kx-btn--lg" style={{ textDecoration: 'none' }}>
              <span className="kx-btn__label">Ir para o início</span>
            </Link>
          </span>
        </div>
      </main>
      <div style={{ paddingBottom: 128 }} />
      <Footer />
    </div>
  );
}
