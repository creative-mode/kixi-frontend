'use client';

import { useEffect, useRef, useState } from 'react';
import { APP_URL } from '@/lib/content';
import { Sprite } from './Bug';
import { Cartridge, LAYERS } from './Cartridge';

/** Everything the landing has to say, one scene per layer of the cartridge. */
const SCENES = [
  { before: 'Provas espalhadas', after: 'Um repositório central', head: 'Fotografa a prova. O Kixi lê-a.', line: 'Foto ou PDF viram texto editável, com perguntas, opções e pontuações separadas.' },
  { before: 'Estudo sem feedback', after: 'Notas na hora', head: 'Salas de prova em tempo real.', line: 'O professor carrega o enunciado e a chave. As notas saem em segundos, em decimais.' },
  { before: 'Estudar sozinho', after: 'Social learning', head: 'Estudar deixa de ser solitário.', line: 'Compara resoluções e desempenho com alunos de outras escolas.' },
  { before: 'Dúvidas sem resposta', after: 'Tutor 24 h', head: 'Um tutor que conhece cada questão.', line: 'Responde só com o conteúdo oficial da prova e diz de onde vem.' },
  { before: null, after: 'Complementa o sistema escolar', head: 'O centro de comando.', line: 'Tempo de entrega e desempenho, do aluno à instituição, com regras definidas pelo professor.' },
] as const;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t);

function Cta({ href, children, secondary }: { href: string; children: React.ReactNode; secondary?: boolean }) {
  return (
    <span className="kx-btn-wrap kx-scope">
      <a href={href} className={`kx-btn kx-btn--lg${secondary ? ' kx-btn--secondary' : ''}`} style={{ textDecoration: 'none' }}>
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
      <p className="pres__sub">Simula a prova, estuda com um tutor de IA e compara com alunos de outras escolas.</p>
      <div className="actions">
        <Cta href={APP_URL}>Começar a estudar</Cta>
        <Cta href="#para-quem" secondary>Sou professor</Cta>
      </div>
    </>
  );
}

function Outro() {
  return (
    <>
      <h2 className="pres__title pres__title--pixel">Do ITEL a toda a Angola e a África.</h2>
      <p className="pres__sub">Feito por alunos, para alunos.</p>
      <div className="actions">
        <Cta href={APP_URL}>Começar a estudar</Cta>
      </div>
    </>
  );
}

function Scene({ i, k }: { i: number; k: number }) {
  const s = SCENES[i];
  return (
    <>
      <p className="pres__tag">Camada {i + 1} de 5</p>
      <div className="pres__chip">
        <Sprite kind={i % 2 ? 'fly' : 'moth'} width={i % 2 ? 30 : 36} />
        {s.before ? (
          <>
            <span className="pres__strike" style={{ ['--k' as string]: `${Math.round(k * 100)}%` }}>{s.before}</span>
            <span className="pres__arrow" aria-hidden="true" style={{ opacity: k }}>→</span>
          </>
        ) : null}
        <span className="pres__after" style={{ opacity: s.before ? clamp((k - 0.6) / 0.4) : 1 }}>{s.after}</span>
      </div>
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
                <span>{s.before ? `${s.before} → ` : ''}{s.after}. {s.head} {s.line}</span>
              </li>
            ))}
          </ol>
          <Outro />
        </div>
      </section>
    );
  }

  // Timeline: intro → open → camera in → five layers (each turns and is shown large) → everything reunites → outro
  const open = smooth(clamp((p - 0.05) / 0.1)) * (1 - smooth(clamp((p - 0.78) / 0.1)));
  const zoom = smooth(clamp((p - 0.16) / 0.07)) * (1 - smooth(clamp((p - 0.76) / 0.1)));
  const sc = clamp(((p - 0.23) / 0.52) * 5, 0, 5); // scene clock: 0..5
  const sj = Math.min(4, Math.floor(sc));
  const f = sj === 0 ? 0 : sj - 1 + smooth(clamp((sc - sj) / 0.25)); // camera focus travels to the next layer first
  const turn = smooth(clamp((p - 0.78) / 0.12)) * 360; // the whole cartridge spins once as it closes
  const yaws = [0, 1, 2, 3, 4].map((j) => ((smooth(clamp((sc - j - 0.1) / 0.5)) * 360 + turn) * Math.PI) / 180);
  const acts = [0, 1, 2, 3, 4].map((j) => smooth(clamp((sc - j - 0.3) / 0.4)) * clamp((j + 1.1 - sc) / 0.2) * (open > 0.9 ? 1 : 0));
  const vis = {
    intro: 1 - clamp((p - 0.04) / 0.05),
    outro: clamp((p - 0.85) / 0.05),
    scene: (j: number) => clamp((sc - j - 0.12) / 0.12) * clamp((j + 1 - sc) / 0.1),
  };
  const layerText = (v: number) => ({ opacity: v, transform: `translateY(${(1 - v) * 18}px)`, pointerEvents: (v > 0.6 ? 'auto' : 'none') as 'auto' | 'none' });

  return (
    <section ref={ref} className="pres" id="solucao" aria-labelledby="hero-title">
      <div className="pres__stick">
        <div className="pres__text">
          <div className="pres__scene" style={layerText(vis.intro)} aria-hidden={vis.intro < 0.5}><Intro /></div>
          {SCENES.map((s, i) => {
            const v = vis.scene(i);
            return (
              <div key={s.head} className="pres__scene" style={layerText(v)} aria-hidden={v < 0.5}>
                <Scene i={i} k={clamp((sc - i - 0.25) / 0.3)} />
              </div>
            );
          })}
          <div className="pres__scene" style={layerText(vis.outro)} aria-hidden={vis.outro < 0.5}><Outro /></div>
        </div>
        <Cartridge explode={open} focus={f} zoom={zoom} acts={acts} yaws={yaws} callouts className="pres__svg" />
        <div className="pres__rail" aria-hidden="true"><span style={{ transform: `scaleY(${p})` }} /></div>
      </div>
    </section>
  );
}
