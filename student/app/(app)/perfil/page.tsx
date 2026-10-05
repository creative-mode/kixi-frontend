'use client';

import { useEffect, useState } from 'react';
import { sairAction } from '@/lib/auth-actions';
import { Avatar, Icon, Mastery } from '@/components/ui';
import { me, result, topicsToReview } from '@/lib/data';

const TABS = ['Atividade', 'Desempenho', 'Guardados'] as const;
const DEFS = [
  { key: 'night', label: 'Tema escuro', hint: 'Fundo escuro, para estudar à noite.', def: false },
  { key: 'time', label: '+25% de tempo nas provas', hint: 'Ajuste de tempo para quem precisa.', def: true },
  { key: 'motion', label: 'Reduzir movimento', hint: 'Menos animações na interface.', def: false },
];

export default function Perfil() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Atividade');
  const [on, setOn] = useState<Record<string, boolean>>(Object.fromEntries(DEFS.map((d) => [d.key, d.def])));

  useEffect(() => {
    setOn((s) => ({ ...s, night: document.documentElement.getAttribute('data-theme') === 'dark' }));
  }, []);

  const toggle = (key: string) => {
    const next = !on[key];
    setOn((s) => ({ ...s, [key]: next }));
    if (key === 'night') {
      const t = next ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', t);
      try { localStorage.setItem('kixi-theme', t); } catch {}
    }
  };

  return (
    <div className="page page--single">
      <div className="col">
        <section className="card" style={{ overflow: 'hidden' }}>
          <div className="cover" />
          <div className="profile">
            <div className="profile__top">
              <Avatar name={me.name} size={84} />
              <button type="button" className="btn btn--ghost btn--sm">Editar perfil</button>
            </div>
            <div><h1>{me.name}</h1><p className="muted">{me.escola} · {me.curso} · Turma {me.turma}</p></div>
            <div className="stats">
              <div className="stat"><b className="num">8</b><span>provas feitas</span></div>
              <div className="stat"><b className="num">15,0</b><span>média das simulações</span></div>
              <div className="stat"><b className="num">5.º</b><span>na turma</span></div>
            </div>
          </div>
        </section>

        <div className="tabs" role="tablist" aria-label="Perfil">
          {TABS.map((t) => <button key={t} type="button" role="tab" className="tab" aria-selected={t === tab} onClick={() => setTab(t)}>{t}</button>)}
        </div>

        {tab === 'Atividade' && (
          <section className="card list">
            {[{ t: 'Concluíste a P1 · Redes de Computadores', m: 'Nota 15,0 · há 2 dias', i: 'check' }, { t: 'Perguntaste na turma sobre subnetting', m: '3 respostas · há 4 dias', i: 'chat' }, { t: 'Concluíste a P2 · Sistemas Operativos', m: 'Nota 16,4 · há 1 semana', i: 'check' }].map((a) => (
              <div key={a.t} className="review"><span className="upload__icon" style={{ width: 36, height: 36 }}><Icon name={a.i} size={18} /></span><div className="review__main"><b>{a.t}</b><span>{a.m}</span></div></div>
            ))}
          </section>
        )}
        {tab === 'Desempenho' && (
          <section className="card"><div className="card__pad" style={{ display: 'grid', gap: 14 }}>
            <h2 className="card__title">Domínio por tema</h2>
            {[...result.topics, ...topicsToReview.filter((t) => !result.topics.some((r) => r.label === t.label))].map((t) => <Mastery key={t.label} label={t.label} value={t.value} />)}
          </div></section>
        )}
        {tab === 'Guardados' && (
          <section className="card"><div className="empty"><b>Ainda não guardaste nada</b><span>Guarda publicações do início para as encontrares aqui.</span></div></section>
        )}

        <section className="card"><div className="card__pad">
          <h2 className="card__title" style={{ marginBottom: 4 }}>Definições</h2>
          {DEFS.map((d) => (
            <label key={d.key} className="switch">
              <span><b>{d.label}</b><span>{d.hint}</span></span>
              <input type="checkbox" role="switch" checked={on[d.key]} onChange={() => toggle(d.key)} />
            </label>
          ))}
        </div></section>

        <form action={sairAction}>
          <button type="submit" className="btn btn--ghost"><Icon name="out" size={18} />Terminar sessão</button>
        </form>
      </div>
    </div>
  );
}
