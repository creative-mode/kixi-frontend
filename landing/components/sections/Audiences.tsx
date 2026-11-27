'use client';

import { useRef, useState } from 'react';
import { AUDIENCES, SIGNUP_URL } from '@/lib/content';
import { Cta, TrackedLink } from './CtaLink';

/** O próximo passo de cada público: o aluno cria conta; professores e escolas falam connosco. */
const NEXT: Record<(typeof AUDIENCES)[number]['id'], { href: string; label: string; note: string }> = {
  alunos: { href: SIGNUP_URL, label: 'Criar conta de aluno', note: 'Na primeira entrada, usas o código de matrícula da tua turma.' },
  professores: { href: '/contact', label: 'Pedir acesso de professor', note: 'A escola dá-te a conta de professor; nós ajudamos a começar.' },
  instituicoes: { href: '/contact', label: 'Levar o Kixi à escola', note: 'Funciona ao lado do sistema que a escola já usa.' },
};

/**
 * Para quem: um separador por público (padrão ARIA de tabs). As setas mudam de separador,
 * Home e End vão às pontas. Sem JS fica o primeiro painel, que é o do aluno.
 */
export function Audiences() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKey(e: React.KeyboardEvent, i: number) {
    const last = AUDIENCES.length - 1;
    const to = e.key === 'ArrowRight' ? (i === last ? 0 : i + 1)
      : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1)
      : e.key === 'Home' ? 0 : e.key === 'End' ? last : null;
    if (to === null) return;
    e.preventDefault();
    setActive(to);
    tabs.current[to]?.focus();
  }

  return (
    <section className="sec sec--soft" id="para-quem" aria-labelledby="aud-title">
      <div className="wrap">
        <header className="sec__head">
          <p className="sec__kicker">Para quem</p>
          <h2 id="aud-title" className="h2">Cada um ganha o seu tempo de volta.</h2>
        </header>
        <div className="aud">
          <div className="aud__tabs" role="tablist" aria-label="Escolhe quem és">
            {AUDIENCES.map((a, i) => (
              <button
                key={a.id}
                ref={(el) => { tabs.current[i] = el; }}
                id={`tab-${a.id}`}
                type="button"
                role="tab"
                aria-selected={active === i}
                aria-controls={`painel-${a.id}`}
                tabIndex={active === i ? 0 : -1}
                className="aud__tab"
                onClick={() => setActive(i)}
                onKeyDown={(e) => onKey(e, i)}
              >
                Sou {a.id === 'alunos' ? 'aluno' : a.id === 'professores' ? 'professor' : 'escola'}
              </button>
            ))}
          </div>
          {AUDIENCES.map((a, i) => {
            const next = NEXT[a.id];
            return (
              <div
                key={a.id}
                id={`painel-${a.id}`}
                role="tabpanel"
                aria-labelledby={`tab-${a.id}`}
                hidden={active !== i}
                className="aud__panel"
                tabIndex={0}
              >
                <div className="aud__intro">
                  <h3 className="aud__line">{a.line}</h3>
                  <div className="aud__next">
                    {a.id === 'alunos'
                      ? <Cta href={next.href} origem="outro">{next.label}</Cta>
                      : (
                        <TrackedLink href={next.href} origem="outro" className="kx-btn kx-btn--lg">
                          <span className="kx-btn__label">{next.label}</span>
                        </TrackedLink>
                      )}
                    <p className="aud__note">{next.note}</p>
                  </div>
                </div>
                <ul className="aud__list">
                  {a.items.map((it) => <li key={it}>{it}</li>)}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
