'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Avatar, Badge, Button, Card, Composer, GradeTile, Icon, Logo, ProgressBar, Reward, Story } from '@/components/kixi';
import { KIND_BAND, posts, stories } from '@/lib/data';

const TABS = ['Turma', 'Escola', 'A seguir'] as const;

export default function Inicio() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Turma');
  const [on, setOn] = useState<Record<string, boolean>>({});
  const flip = (k: string) => setOn((s) => ({ ...s, [k]: !s[k] }));

  return (
    <>
      <header className="screen__head kx-sky" style={{ borderBottom: '2px solid var(--line-strong)', background: 'var(--surface-raised)' }}>
        <Logo size={24} wordmark />
        <Button size="sm" icon="plus">Publicar</Button>
      </header>
      <main className="screen__main">
        <section aria-label="Em destaque na turma" className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">Em destaque na turma</span>
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', margin: '0 -20px', padding: '4px 20px' }}>
            {stories.map((s) => <Story key={s.name} name={s.name} value={s.value} hue={s.hue} seen={s.seen} />)}
          </div>
        </section>

        <Link href="/prova/redes-p1" className="linkbtn" aria-label="Continuar a simulação P1 de Redes, questão 5 de 12">
          <Card style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
              <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                <span style={{ font: '400 10px/14px var(--font-pixel)', textTransform: 'uppercase', color: 'var(--tiro-ink)' }}>Continuar</span>
                <span style={{ font: '700 15px/22px var(--font-sans)' }}>P1 · Redes de Computadores</span>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: 'var(--tiro)', color: 'var(--on-tiro)', borderBottom: '4px solid var(--tiro-edge)', font: '400 10px/1 var(--font-pixel)' }}>
                <Icon name="play" size={16} />5/12
              </span>
            </div>
            <ProgressBar value={5} max={12} slim valueLabel={false} segments={12} label="Progresso da simulação" />
          </Card>
        </Link>

        <Composer name="Abner Ede" placeholder="Partilha com a turma" />

        <div className="seg" role="group" aria-label="Mostrar publicações de">
          {TABS.map((t) => <button key={t} type="button" aria-pressed={t === tab} onClick={() => setTab(t)}>{t}</button>)}
        </div>

        {posts.map((p) => {
          const band = KIND_BAND[p.kind];
          const clapped = !!on['c' + p.id];
          const forced = !!on['f' + p.id];
          return (
            <article key={p.id} className={`kx-post kx-card kx-scope${band.cls}`}>
              <div className="kx-post__band" aria-hidden="true" />
              <header className="kx-post__head">
                <Avatar name={p.name} ring={p.fresh} />
                <div className="kx-post__who"><span className="kx-post__name">{p.name}</span><span className="kx-post__meta">{p.meta}</span></div>
                <Badge tone={band.tone}>{band.label}</Badge>
              </header>
              <p className="kx-post__text">{p.text}</p>
              {p.exam && <GradeTile title={p.exam.title} meta={p.exam.meta} delta={p.exam.delta} grade={p.exam.grade} />}
              {p.reward && <div><Reward icon={p.reward.icon} tone={p.reward.tone}>{p.reward.label}</Reward></div>}
              <div className="kx-reactions">
                <button type="button" className={`kx-react kx-react--tiro${clapped ? ' is-on' : ''}`} aria-pressed={clapped} onClick={() => flip('c' + p.id)}>
                  <Icon name="star" size={16} /><span>Aplaudir</span><b>{p.claps + (clapped ? 1 : 0)}</b>
                </button>
                <button type="button" className={`kx-react kx-react--pop${forced ? ' is-on' : ''}`} aria-pressed={forced} onClick={() => flip('f' + p.id)}>
                  <Icon name="bolt" size={16} /><span>Força</span><b>{p.forces + (forced ? 1 : 0)}</b>
                </button>
                <div className="kx-reactions__end">
                  <Link href={p.cta.href} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 40, padding: '0 4px', font: '700 13px/1 var(--font-sans)' }}>{p.cta.label}</Link>
                </div>
              </div>
            </article>
          );
        })}
      </main>
    </>
  );
}
