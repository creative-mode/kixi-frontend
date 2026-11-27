'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { SIGNUP_URL } from '@/lib/content';
import { Cta } from './CtaLink';

/**
 * Uma questão de prova para responder já, no primeiro ecrã: o que o Kixi faz em cada prova
 * (simular e explicar), em pequeno. É uma demonstração, não dados: nada de notas nem alunos.
 * Opções em rádios verdadeiros (teclado e leitor de ecrã), resposta anunciada em `aria-live`.
 */
/** Expressão matemática na fonte mono: na Plus Jakarta o «x» entre algarismos vira «×». */
const M = ({ children }: { children: React.ReactNode }) => <span className="quiz__inline">{children}</span>;

const OPTIONS: readonly { key: string; text: string; why: React.ReactNode }[] = [
  { key: 'A', text: 'x = 3', why: <>Experimenta: <M>2 · 3 + 3</M> dá <M>9</M>, e não <M>11</M>.</> },
  { key: 'B', text: 'x = 4', why: null },
  { key: 'C', text: 'x = 7', why: <>Somaste o <M>3</M> em vez de o passar para o outro lado: <M>2x = 11 − 3</M>.</> },
  { key: 'D', text: 'x = 8', why: <>Quase: <M>2x = 8</M>, mas ainda falta dividir por <M>2</M>.</> },
];
const CORRECT = 'B';

export function TryQuestion() {
  const [choice, setChoice] = useState<string | null>(null);
  const name = useId();
  const tutor = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLInputElement>(null);
  const reset = useRef(false);
  const answered = choice !== null;
  const right = choice === CORRECT;
  const picked = OPTIONS.find((o) => o.key === choice);

  // Respondida, a questão fica desativada e o foco perdia-se: segue para a explicação.
  // Ao responder outra vez, volta à primeira opção.
  useEffect(() => {
    if (choice !== null) tutor.current?.focus();
    else if (reset.current) first.current?.focus();
  }, [choice]);

  return (
    <div className="quiz">
      <div className="quiz__sheet">
        <div className="quiz__head">
          <span>Matemática · 10.ª classe</span>
          <span>P1 · Questão 4</span>
        </div>
        <fieldset className="quiz__q" disabled={answered}>
          <legend className="quiz__stem">
            <span className="quiz__label">Experimenta: responde como na prova</span>
            Resolve a equação <span className="quiz__math">2x + 3 = 11</span>.
          </legend>
          <div className="quiz__options">
            {OPTIONS.map((o) => {
              const state = !answered ? '' : o.key === CORRECT ? ' is-right' : o.key === choice ? ' is-wrong' : ' is-dim';
              return (
                <label key={o.key} className={`quiz__opt${state}`}>
                  <input ref={o.key === 'A' ? first : undefined} type="radio" name={name} value={o.key} checked={choice === o.key} onChange={() => setChoice(o.key)} />
                  <span className="quiz__letter" aria-hidden="true">{o.key}</span>
                  <span className="quiz__text">{o.text}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div className="quiz__feedback" aria-live="polite">
        {answered ? (
          <div ref={tutor} tabIndex={-1} className={`quiz__tutor${right ? ' is-right' : ' is-wrong'}`}>
            <p className="quiz__who">Tutor do Kixi</p>
            <p className="quiz__verdict">{right ? 'Certo, é a B.' : <>Não é a {choice}. {picked?.why}</>}</p>
            <ol className="quiz__steps" aria-label="Resolução">
              <li>2x + 3 = 11</li>
              <li>2x = 11 − 3 = 8</li>
              <li>x = 8 ÷ 2 = <strong>4</strong></li>
            </ol>
            <div className="quiz__next">
              <Cta href={SIGNUP_URL} origem="hero" size="sm">Fazer a prova toda</Cta>
              <button type="button" className="quiz__again" onClick={() => { reset.current = true; setChoice(null); }}>Responder outra vez</button>
            </div>
          </div>
        ) : (
          <p className="quiz__hint">Escolhe uma opção. O tutor explica logo a seguir, certo ou errado.</p>
        )}
      </div>
    </div>
  );
}
