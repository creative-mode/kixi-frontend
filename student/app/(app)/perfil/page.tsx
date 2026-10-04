'use client';

import { useState } from 'react';
import { sairAction } from '@/lib/auth-actions';
import { Avatar, Button, Card, HudBar, Medal } from '@/components/kixi';

const DEFS = [
  { key: 'night', label: 'Ecrã Noite', hint: 'O ecrã apagado, para estudar à noite.', def: false },
  { key: 'time', label: '+25% de tempo nas provas', hint: 'Ajuste de tempo para quem precisa.', def: true },
  { key: 'motion', label: 'Reduzir movimento', hint: 'Sem animações de recompensa.', def: false },
];

export default function Perfil() {
  const [on, setOn] = useState<Record<string, boolean>>(Object.fromEntries(DEFS.map((d) => [d.key, d.def])));

  const toggle = (key: string) => {
    const next = !on[key];
    setOn((s) => ({ ...s, [key]: next }));
    if (key === 'night') document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
  };

  return (
    <main className="screen__main" style={{ padding: '24px 20px', gap: 18 }}>
      <div className="row" style={{ gap: 14 }}>
        <Avatar name="Abner Ede" size={56} ring />
        <div className="stack" style={{ gap: 2 }}>
          <h1 style={{ margin: 0, font: '700 22px/28px var(--font-sans)' }}>Abner Ede</h1>
          <p className="muted" style={{ margin: 0, font: '400 14px/20px var(--font-sans)' }}>ITEL · Informática · Turma 12B</p>
        </div>
      </div>
      <HudBar level={7} xp={1240} xpMax={1500} streak={12} />
      <span className="eyebrow">Medalhas</span>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Medal name="Primeiro tiro" icon="target">1.ª simulação</Medal>
        <Medal name="Sem falhas" icon="trophy">Nota máxima</Medal>
        <Medal name="Mentor" state="locked">Ajuda 5 colegas</Medal>
      </div>
      <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="eyebrow">Definições</span>
        {DEFS.map((d) => (
          <label key={d.key} className="row" style={{ justifyContent: 'space-between', gap: 12, minHeight: 48, font: '600 15px/22px var(--font-sans)', cursor: 'pointer' }}>
            <span>{d.label}<span className="muted" style={{ display: 'block', font: '400 13px/18px var(--font-sans)' }}>{d.hint}</span></span>
            <input type="checkbox" checked={on[d.key]} onChange={() => toggle(d.key)} style={{ width: 22, height: 22, accentColor: 'var(--brand)' }} />
          </label>
        ))}
      </Card>
      <form action={sairAction}>
        <Button type="submit" variant="ghost">Terminar sessão</Button>
      </form>
    </main>
  );
}
