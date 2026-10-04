'use client';

import { useEffect, useRef, useState } from 'react';
import { Cartridge, LAYERS } from './Cartridge';

const COPY = [
  { head: 'Fotografa a prova. O Kixi lê-a.', line: 'Uma foto ou um PDF viram texto editável, com perguntas, opções e pontuações separadas.' },
  { head: 'Salas de prova em tempo real.', line: 'O professor carrega o enunciado e a chave. As notas saem em segundos, em decimais.' },
  { head: 'Estudar deixa de ser solitário.', line: 'Compara resoluções e desempenho com alunos de outras escolas.' },
  { head: 'Um tutor que conhece cada questão.', line: 'Responde só com o conteúdo oficial da prova e diz de onde vem.' },
  { head: 'O centro de comando.', line: 'Tempo de entrega e desempenho, do aluno à instituição.' },
] as const;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export function Anatomy() {
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
      <section className="anat anat--still" id="solucao" aria-labelledby="anat-title">
        <div className="wrap">
          <h2 id="anat-title" className="h2">Por dentro do Kixi.</h2>
          <Cartridge explode={1} callouts className="anat__svg" />
          <ol className="anat__list">
            {COPY.map((c, i) => (
              <li key={c.head}><strong>{LAYERS[i].label}</strong><span>{c.head} {c.line}</span></li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  const OPEN = 0.2;
  const e = clamp(p / OPEN);
  const active = p < OPEN ? null : clamp(Math.floor((p - OPEN) / ((1 - OPEN) / 5)), 0, 4);

  return (
    <section ref={ref} className="anat" id="solucao" aria-labelledby="anat-title">
      <div className="anat__stick">
        <div className="anat__text">
          {active === null ? (
            <div key="intro" className="anat__swap">
              <h2 id="anat-title" className="h2">Por dentro do Kixi.</h2>
              <p className="sec__sub">Cinco camadas, uma prova. Desce para abrir o cartucho.</p>
            </div>
          ) : (
            <div key={active} className="anat__swap">
              <p className="anat__tag">Camada {active + 1} de 5</p>
              <h3 className="anat__head">{COPY[active].head}</h3>
              <p className="sec__sub">{COPY[active].line}</p>
              <div className="anat__ticks" aria-hidden="true">
                {LAYERS.map((l, i) => <span key={l.id} className={i === active ? 'is-on' : ''} />)}
              </div>
            </div>
          )}
        </div>
        <Cartridge explode={e} active={active} callouts className="anat__svg" />
      </div>
    </section>
  );
}
