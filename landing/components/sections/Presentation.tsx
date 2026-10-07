'use client';

import { useEffect, useRef, useState } from 'react';
import { SIGNUP_URL } from '@/lib/content';
import { Cartridge, LAYERS } from './Cartridge';
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

function Cta({ href, children, secondary }: { href: string; children: React.ReactNode; secondary?: boolean }) {
  return (
    <span className="kx-btn-wrap kx-scope">
      <a href={href} className={`kx-btn kx-btn--lg${secondary ? ' kx-btn--secondary' : ' kx-btn--gold'}`} style={{ textDecoration: 'none' }}>
        <span className="kx-btn__label">{children}</span>
      </a>
    </span>
  );
}

function Intro() {
  return (
    <>
      <h1 id="hero-title" className="pres__title">
        A prova não é o fim.
        <span>É onde o estudo começa.</span>
      </h1>
      <p className="pres__sub">Treina com provas a sério, tira dúvidas e vê como os outros resolveram.</p>
      <div className="actions">
        <Cta href={SIGNUP_URL}>Começar a estudar</Cta>
        <Cta href="#para-quem" secondary>Sou professor</Cta>
      </div>
    </>
  );
}

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
        <Cta href={SIGNUP_URL}>Começar a estudar</Cta>
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

export function Presentation() {
  const ref = useRef<HTMLElement>(null);
  const [p, setP] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const upd = () => setStill(mq.matches);
    upd();
    mq.addEventListener('change', upd);
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        setP(clamp(-r.top / (r.height - window.innerHeight)));
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
  }, []);

  // The page runs from night to day while the prologue plays; everything coloured with --mood follows.
  const moodNow = still ? 1 : smooth(clamp((clamp(p / 0.35) - 0.9) / 0.08));
  useEffect(() => {
    document.documentElement.style.setProperty('--mood', String(moodNow));
  }, [moodNow]);
  useEffect(() => () => { document.documentElement.style.removeProperty('--mood'); }, []);

  if (still) {
    return (
      <section className="pres pres--still" id="solucao" aria-labelledby="hero-title">
        <div className="wrap">
          <Intro />
          <Cartridge explode={1} callouts className="pres__svg" />
          <ol className="pres__list">
            {SCENES.map((s, i) => (
              <li key={s.head}>
                <strong>{LAYERS[i].label}</strong>
                <span>{s.head} {s.line}</span>
              </li>
            ))}
          </ol>
          <Outro />
        </div>
      </section>
    );
  }

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
  const reveal = smooth(clamp((q - 0.92) / 0.08)); // the cartridge appears out of the debris
  const vis = {
    bridge: clamp((q - 0.94) / 0.06) * (1 - clamp((p2 - 0.03) / 0.03)),
    inside: clamp((p2 - 0.07) / 0.04) * clamp((0.205 - p2) / 0.03),
    outro: clamp((p2 - 0.85) / 0.05),
    scene: (j: number) => clamp((sc - j - 0.12) / 0.12) * clamp((j + 1 - sc) / 0.1),
  };
  const layerText = (v: number) => ({ opacity: v, transform: `translateY(${(1 - v) * 18}px)`, pointerEvents: (v > 0.6 ? 'auto' : 'none') as 'auto' | 'none' });

  return (
    <section ref={ref} className="pres" id="solucao" aria-labelledby="hero-title">
      <div className="pres__stick">
        <h1 id="hero-title" className="sr-only">A prova não é o fim. É onde o estudo começa.</h1>
        <div className="pres__prolog" style={{ ['--px' as string]: smooth(clamp((q - 0.92) / 0.08)) }} aria-hidden="true">
          {q < 1 || p2 < 0.001 ? <Prologue q={q / 0.84} /> : null}
        </div>
        <div className="pres__text">
          <div className="pres__scene" style={layerText(vis.bridge)} aria-hidden={vis.bridge < 0.5}><Bridge /></div>
          <div className="pres__scene" style={layerText(vis.inside)} aria-hidden={vis.inside < 0.5}><Inside /></div>
          {SCENES.map((s, i) => {
            const v = vis.scene(i);
            return (
              <div key={s.head} className="pres__scene" style={layerText(v)} aria-hidden={v < 0.5}>
                <Scene i={i} />
              </div>
            );
          })}
          <div className="pres__scene" style={layerText(vis.outro)} aria-hidden={vis.outro < 0.5}><Outro /></div>
        </div>
        <div className="pres__art">
          <div className="pres__block" style={{ opacity: open }} aria-hidden="true" />
          <div className="pres__cart" style={{ opacity: reveal, transform: `scale(${0.7 + 0.3 * reveal})` }}>
            <Cartridge explode={open} focus={f} zoom={zoom} acts={acts} yaws={yaws} callouts className="pres__svg" />
          </div>
        </div>
        <div className="pres__hint" style={{ opacity: 0.72 * (1 - clamp((q - 0.01) / 0.05)) }} aria-hidden="true">
          <svg viewBox="0 0 11 7" width="32" height="20" shapeRendering="crispEdges" fill="currentColor"><path d="M0 0h3v1h1v1h1v1h1V2h1V1h1V0h3v1h-1v1h-1v1h-1v1h-1v1h-1v1H5V6H4V5H3V4H2V3H1V2H0z" /></svg>
        </div>
        <div className="pres__rail" aria-hidden="true"><span style={{ transform: `scaleY(${p})` }} /></div>
      </div>
    </section>
  );
}
