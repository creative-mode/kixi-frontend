'use client';

import { useEffect, useRef, useState } from 'react';
import { SIGNUP_URL } from '@/lib/content';
import { Cartridge } from './Cartridge';
import { Cta } from './CtaLink';
import { GameDemo } from './GameDemo';
import { GameDemo } from './GameDemo';
import { Gameboy } from './Gameboy';
import { Prologue } from './Prologue';

/** Everything the landing has to say, one scene per layer of the cartridge. */
const SCENES = [
  { head: 'Fotografa a prova.', line: 'Em segundos fica no Kixi, pronta para estudares.' },
  { head: 'Faz a prova como se fosse a sério.', line: 'Vês a nota logo no fim e sabes onde errar.' },
  { head: 'Vê como os outros resolveram.', line: 'Aprendes novas formas de pensar, de qualquer escola.' },
  { head: 'Pergunta ao tutor.', line: 'Ele explica cada questão, a qualquer hora.' },
  { head: 'Acompanha o teu progresso.', line: 'Alunos e professores veem tudo num só lugar.' },
] as const;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t);

function Bridge() {
  return (
    <>
      <h2 className="pres__head">Tudo para estudares, num só lugar.</h2>
    </>
  );
}

function Inside() {
  return (
    <>
      <h2 className="pres__head">O que podes fazer no Kixi.</h2>
    </>
  );
}

function Outro() {
  return (
    <>
      <h2 className="pres__title pres__title--pixel">Do ITEL a toda a Angola e a África.</h2>
      <p className="pres__sub">Feito por alunos, para alunos.</p>
      <div className="actions">
        <Cta href={SIGNUP_URL} origem="outro">Começar a estudar</Cta>
      </div>
    </>
  );
}

function Scene({ i }: { i: number }) {
  const s = SCENES[i];
  return (
    <>
      <h2 className="pres__head">{s.head}</h2>
      <p className="pres__sub">{s.line}</p>
    </>
  );
}

/** Frase de valor do herói (#512): quem chega percebe o que é o Kixi sem descer. */
const HERO_SUB = 'Estuda o que vai mesmo sair: simulações, tutor de IA e a rede de estudo entre escolas.';

/** Saltar a apresentação (#512): uma âncora chega a rato, teclado e toque. Vive no
 *  fluxo do herói — em cima, longe do banner de cookies fixo — e some com ele.
 *  O clique leva o foco para o título de destino, para quem vai pelo teclado
 *  sentir a chegada (#608 re-revisão: a âncora sozinha não movia o foco). */
function SkipShow() {
  const saltar = () => {
    const alvo = document.querySelector<HTMLElement>('#modulos h2');
    if (!alvo) return;
    if (!alvo.hasAttribute('tabindex')) alvo.setAttribute('tabindex', '-1');
    window.setTimeout(() => alvo.focus({ preventScroll: true }), 50);
  };
  return (
    <a href="#modulos" className="pres__skip" onClick={saltar}>
      <span>Saltar a apresentação</span>
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <polyline points="4,7 10,13 16,7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

export function Presentation() {
  const ref = useRef<HTMLElement>(null);
  const [p, setP] = useState(0);
  // Movimento reduzido (#513): só decide atributos de acessibilidade (o que o
  // leitor de ecrã ouve, o que o teclado alcança). O desenho — compacto ou
  // 1800 ecrãs — é decidido pelo CSS com `@media (prefers-reduced-motion)`,
  // que já vale na primeira tinta; por JS chegava tarde e a página saltava.
  const [reduced, setReduced] = useState(false);
  // Espelho para o `onScroll` (efeito de montagem, sem `reduced` nas deps): em
  // modo reduzido o progresso não muda nada no desenho, por isso nem se mede.
  const reducedRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const upd = () => {
      reducedRef.current = mq.matches;
      setReduced(mq.matches);
    };
    upd();
    mq.addEventListener('change', upd);
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (reducedRef.current) return;
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        // Quantizado a sério, 1/200 do percurso (#514): scrolls lentos e médios
        // ficam vários frames na mesma casa e não re-renderizam; só flings mexem
        // a cada frame — e aí é o movimento que o pede. O `memo` não poupava nada:
        // quando a casa muda, os números que o cartucho recebe mudam mesmo.
        const next = Math.round(clamp(-r.top / (r.height - window.innerHeight)) * 200) / 200;
        setP((prev) => (prev === next ? prev : next));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      mq.removeEventListener('change', upd);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  },

  // As setas andam com o browser (#513): o passo nativo é o que o teclado, o
  // leitor de ecrã e o próprio utilizador esperam. O passo de meio ecrã por
  // `preventDefault` sequestrava as setas enquanto a apresentação estava visível.

  // Timeline: prologue (logo → ship → book shatters) → cartridge: open → camera in → five layers → reunite → outro
  const P0 = 0.35; // the last stretch of the prologue (q 0.84 → 0.92) holds the closing words
  const q = clamp(p / P0);
  const p2 = clamp((p - P0) / (1 - P0));
  const open = smooth(clamp((p2 - 0.05) / 0.1)) * (1 - smooth(clamp((p2 - 0.78) / 0.1)));
  const zoom = smooth(clamp((p2 - 0.16) / 0.07)) * (1 - smooth(clamp((p2 - 0.76) / 0.1)));
  const sc = clamp(((p2 - 0.23) / 0.52) * 5, 0, 5); // scene clock: 0..5
  const sj = Math.min(4, Math.floor(sc));
  const f = sj === 0 ? 0 : sj - 1 + smooth(clamp((sc - sj) / 0.25)); // camera focus travels to the next layer first
  const turn = smooth(clamp((p2 - 0.78) / 0.12)) * 360; // the whole cartridge spins once as it closes
  const yaws = [0, 1, 2, 3, 4].map((j) => ((smooth(clamp((sc - j - 0.1) / 0.5)) * 360 + turn) * Math.PI) / 180);
  const acts = [0, 1, 2, 3, 4].map((j) => smooth(clamp((sc - j - 0.3) / 0.4)) * clamp((j + 1.1 - sc) / 0.2) * (open > 0.9 ? 1 : 0));
  const hero = 1 - smooth(clamp(p / 0.03)); // first screen: the console is big and half out of frame, then rises into place
  const off = smooth(clamp((q - 0.87) / 0.06)); // the console powers off first…
  const reveal = smooth(clamp((q - 0.95) / 0.05)); // the cartridge appears out of the debris
  const eject = smooth(clamp((q - 0.93) / 0.07)); // …then slips away downwards
  const vis = {
    bridge: clamp((q - 0.94) / 0.06) * (1 - clamp((p2 - 0.03) / 0.03)),
    inside: clamp((p2 - 0.07) / 0.04) * clamp((0.205 - p2) / 0.03),
    outro: clamp((p2 - 0.85) / 0.05),
    scene: (j: number) => clamp((sc - j - 0.12) / 0.12) * clamp((j + 1 - sc) / 0.1),
  };
  // Cena apagada, cena intocável (#513): `aria-hidden` sem `inert` deixava o CTA
  // do fim focável no escuro — o Tab andava por botões invisíveis (WCAG 4.1.2).
  // O mesmo limiar (0.6) decide as três coisas; com movimento reduzido está
  // tudo aceso, porque o CSS mostra tudo empilhado.
  const sceneAttrs = (v: number) => {
    const on = reduced || v > 0.6;
    return {
      style: {
        opacity: reduced ? 1 : v,
        transform: reduced ? 'none' : `translateY(${(1 - v) * 18}px)`,
        pointerEvents: (on ? 'auto' : 'none') as 'auto' | 'none',
      },
      'aria-hidden': !on,
      inert: !on,
    };
  };

  return (
    <section ref={ref} className="pres" id="solucao" aria-labelledby="hero-title">
      <div className="pres__stick">
        <div className="pres__hero" style={{ opacity: reduced ? 1 : hero, transform: reduced ? 'none' : `translateY(${(1 - hero) * -24}px)`, visibility: reduced || hero > 0.01 ? 'visible' : 'hidden' }}>
          <h1 id="hero-title" className="pres__hero-title">E se estudar fosse... divertido?</h1>
          <p className="pres__hero-sub">{HERO_SUB}</p>
          {/* Fora do herói não há salto focável: apagado não entra no Tab. */}
          {hero > 0.5 && <SkipShow />}
        </div>
        <div className="pres__text">
          <div className="pres__scene" {...sceneAttrs(vis.bridge)}><Bridge /></div>
          <div className="pres__scene" {...sceneAttrs(vis.inside)}><Inside /></div>
          {SCENES.map((s, i) => (
            <div key={s.head} className="pres__scene" {...sceneAttrs(vis.scene(i))}>
              <Scene i={i} />
            </div>
          ))}
          <div className="pres__scene" {...sceneAttrs(vis.outro)}><Outro /></div>
        </div>
        <div className="pres__art">
          {eject < 1 ? (
            <Gameboy eject={eject} off={off} hero={hero} center={1} label="Ecrã de uma Game Boy: a história de uma prova que correu mal e do Kixi a chegar">
              {p < 0.004 ? <GameDemo /> : <Prologue q={Math.min(1, q / 0.84)} />}
            </Gameboy>
          ) : null}
          <div className="pres__block" style={{ opacity: reveal }} aria-hidden="true" />
          <div className="pres__cart pres__art--cart" style={{ opacity: reveal, transform: `scale(${0.7 + 0.3 * reveal})` }}>
            <Cartridge explode={open} focus={f} zoom={zoom} acts={acts} yaws={yaws} callouts className="pres__svg" />
          </div>
          {/* Com movimento reduzido o palco animado esconde-se e este cartucho
              parado aparece: a mesma peça, sem viajar (#513). */}
          <div className="pres__cart pres__cart--flat" aria-hidden="true">
            <Cartridge explode={1} callouts className="pres__svg" />
          </div>
        </div>
      </div>
    </section>
  );
}
