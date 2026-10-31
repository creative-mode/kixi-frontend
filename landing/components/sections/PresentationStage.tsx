'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SIGNUP_URL } from '@/lib/content';
import { deriveFrame, progressFromRect } from '@/lib/presentation-timeline';
import { Cartridge } from './Cartridge';
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

function Cta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <span className="kx-btn-wrap kx-scope">
      <a href={href} className="kx-btn kx-btn--lg kx-btn--a" style={{ textDecoration: 'none' }}>
        <span className="kx-btn__label">{children}</span>
      </a>
    </span>
  );
}

function Bridge() {
  return <h2 className="pres__head">Tudo para estudares, num só lugar.</h2>;
}

function Inside() {
  return <h2 className="pres__head">O que podes fazer no Kixi.</h2>;
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

/**
 * Island cliente: o scroll só escreve `--p` e atributos no DOM (sem `setState`).
 * Cartridge/Prologue pintam-se em roots à parte (hosts criados à mão) para a
 * árvore principal não reconciliar ~12 KB de SVG a cada frame (#514).
 */
export function PresentationStage({ hero }: { hero: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const cartWrapRef = useRef<HTMLDivElement>(null);
  const [demoPaused, setDemoPaused] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setDemoPaused(true);
      return;
    }
    const id = window.setTimeout(() => setDemoPaused(true), 5000);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const el = ref.current;
    const cartWrap = cartWrapRef.current;
    if (!el || !cartWrap) return;

    const heroEl = el.querySelector<HTMLElement>('[data-pres-hero]');
    const scenes = [...el.querySelectorAll<HTMLElement>('[data-pres-scene]')];
    const gb = el.querySelector<HTMLElement>('[data-pres-gb]');
    const demo = el.querySelector<HTMLElement>('[data-pres-demo]');
    const lcd = gb?.querySelector<HTMLElement>('.gb__lcd') ?? null;
    const block = el.querySelector<HTMLElement>('[data-pres-block]');

    // Hosts fora do controlo do reconciler: um re-render do stage (pausa) não os apaga.
    const prolHost = document.createElement('div');
    prolHost.dataset.presProl = '';
    prolHost.hidden = true;
    lcd?.appendChild(prolHost);

    const cartHost = document.createElement('div');
    cartWrap.appendChild(cartHost);

    const cartRoot: Root = createRoot(cartHost);
    const prolRoot: Root = createRoot(prolHost);

    let raf = 0;
    let lastProlQ = -1;
    let lastCartKey = '';

    const paint = () => {
      const box = el.getBoundingClientRect();
      const p = progressFromRect(box.top, box.height, window.innerHeight);
      el.style.setProperty('--p', String(p));

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const frame = deriveFrame(p);

      if (heroEl) {
        if (reduced) {
          heroEl.style.opacity = '1';
          heroEl.style.transform = 'none';
          heroEl.style.visibility = 'visible';
        } else {
          heroEl.style.opacity = String(frame.hero);
          heroEl.style.transform = `translateY(${(1 - frame.hero) * -24}px)`;
          heroEl.style.visibility = frame.hero > 0.01 ? 'visible' : 'hidden';
        }
      }

      scenes.forEach((node, i) => {
        const v = frame.vis[i] ?? 0;
        const on = reduced || v > 0.6;
        if (reduced) {
          node.style.opacity = '1';
          node.style.transform = 'none';
        } else {
          node.style.opacity = String(v);
          node.style.transform = `translateY(${(1 - v) * 18}px)`;
        }
        node.style.pointerEvents = on ? 'auto' : 'none';
        node.setAttribute('aria-hidden', on ? 'false' : 'true');
        if (on) node.removeAttribute('inert');
        else node.setAttribute('inert', '');
      });

      if (gb) {
        gb.style.setProperty('--ej', String(frame.eject));
        gb.style.setProperty('--off', String(frame.off));
        gb.style.setProperty('--hero', String(frame.hero));
        gb.style.setProperty('--ctr', '1');
        gb.hidden = reduced || !frame.showGameboy;
      }

      if (demo) demo.hidden = !frame.showDemo;
      prolHost.hidden = frame.showDemo;
      el.dataset.phase = frame.showDemo ? 'demo' : frame.showGameboy ? 'prologue' : 'cart';

      if (block) block.style.opacity = reduced ? '0' : String(frame.reveal);
      cartWrap.style.opacity = reduced ? '0' : String(frame.reveal);
      cartWrap.style.transform = reduced ? 'none' : `scale(${0.7 + 0.3 * frame.reveal})`;

      if (!reduced && !frame.showDemo) {
        const q = frame.prologueQ;
        if (Math.abs(q - lastProlQ) > 0.0005) {
          lastProlQ = q;
          prolRoot.render(<Prologue q={q} />);
        }
      }

      if (!reduced) {
        const key = [
          frame.open.toFixed(3),
          frame.f.toFixed(3),
          frame.zoom.toFixed(3),
          frame.acts.map((a) => a.toFixed(2)).join(','),
          frame.yaws.map((y) => y.toFixed(3)).join(','),
        ].join('|');
        if (key !== lastCartKey) {
          lastCartKey = key;
          cartRoot.render(
            <Cartridge
              explode={frame.open}
              focus={frame.f}
              zoom={frame.zoom}
              acts={frame.acts}
              yaws={frame.yaws}
              callouts
              className="pres__svg"
            />,
          );
        }
      }
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(paint);
    };

    paint();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
      queueMicrotask(() => {
        cartRoot.unmount();
        prolRoot.unmount();
        prolHost.remove();
        cartHost.remove();
      });
    };
  }, []);

  return (
    <section ref={ref} className="pres" id="solucao" aria-labelledby="hero-title" style={{ ['--p' as string]: 0 }}>
      <div className="pres__stick">
        {hero}
        <div className="pres__text">
          <div className="pres__scene" data-pres-scene aria-hidden="true" inert>
            <Bridge />
          </div>
          <div className="pres__scene" data-pres-scene aria-hidden="true" inert>
            <Inside />
          </div>
          {SCENES.map((s, i) => (
            <div key={s.head} className="pres__scene" data-pres-scene aria-hidden="true" inert>
              <Scene i={i} />
            </div>
          ))}
          <div className="pres__scene" data-pres-scene aria-hidden="true" inert>
            <Outro />
          </div>
        </div>
        <div className="pres__art">
          <Gameboy label="Ecrã de uma Game Boy: a história de uma prova que correu mal e do Kixi a chegar">
            <div data-pres-demo>
              <GameDemo paused={demoPaused} />
            </div>
          </Gameboy>
          <button
            type="button"
            className="pres__pause"
            data-pres-pause
            hidden={demoPaused}
            onClick={() => setDemoPaused(true)}
          >
            Parar animação
          </button>
          <div className="pres__block" data-pres-block style={{ opacity: 0 }} aria-hidden="true" />
          <div className="pres__cart pres__art--cart" ref={cartWrapRef} style={{ opacity: 0 }} />
          <div className="pres__cart pres__cart--flat" aria-hidden="true">
            <Cartridge explode={1} callouts className="pres__svg" />
          </div>
        </div>
      </div>
    </section>
  );
}
