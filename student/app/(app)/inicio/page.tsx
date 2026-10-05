'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Avatar, Icon, Mastery } from '@/components/ui';
import { KIND_LABEL, me, posts as seed, topicsToReview, upcoming, ranking, type FeedPost } from '@/lib/data';

const TABS = ['Turma', 'Escola', 'A seguir'] as const;
const ASK = [
  { label: 'Partilhar resultado', icon: 'trend' },
  { label: 'Fazer uma pergunta', icon: 'chat' },
  { label: 'Dica de estudo', icon: 'book' },
];

function Post({ p }: { p: FeedPost }) {
  const [useful, setUseful] = useState(false);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(p.comments);
  const [draft, setDraft] = useState('');

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    setList((l) => [...l, { name: me.name, text: t, time: 'agora' }]);
    setDraft('');
  };

  return (
    <article className="card post">
      <header className="post__head">
        <Avatar name={p.name} size={44} />
        <div className="post__who">
          <span className="post__name">{p.name}</span>
          <span className="post__meta">{p.meta}</span>
        </div>
        <span className="tag"><span className="tag__dot" />{KIND_LABEL[p.kind]}</span>
      </header>

      <p className="post__text">{p.text}</p>

      {p.attach?.type === 'resultado' && (
        <Link href={p.attach.href} className="attach">
          <span><span className="attach__title" style={{ display: 'block' }}>{p.attach.title}</span><span className="attach__meta">{p.attach.meta}</span></span>
          <span className="attach__score"><b className="num">{p.attach.score}</b>{p.attach.delta && <span>{p.attach.delta}</span>}</span>
        </Link>
      )}
      {p.attach?.type === 'questao' && (
        <div className="quote"><b>{p.attach.title}</b>{p.attach.excerpt}</div>
      )}
      {p.attach?.type === 'tema' && (
        <Link href={p.attach.href} className="attach">
          <span><span className="attach__title" style={{ display: 'block' }}>{p.attach.title}</span><span className="attach__meta">{p.attach.meta}</span></span>
          <Icon name="right" />
        </Link>
      )}

      <div className="post__acts">
        <button type="button" className="act" aria-pressed={useful} onClick={() => setUseful((v) => !v)}>
          <Icon name="useful" size={18} />Útil<span className="num">{p.useful + (useful ? 1 : 0)}</span>
        </button>
        <button type="button" className="act" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <Icon name="chat" size={18} />Comentar<span className="num">{list.length}</span>
        </button>
        <button type="button" className="act" aria-pressed={saved} onClick={() => setSaved((v) => !v)} aria-label={saved ? 'Remover dos guardados' : 'Guardar'}>
          <Icon name="bookmark" size={18} />
        </button>
        {p.cta && <Link href={p.cta.href} className="btn btn--quiet btn--sm act__end">{p.cta.label}</Link>}
      </div>

      {open && (
        <div className="thread">
          {list.map((c, i) => (
            <div className="comment" key={i}>
              <Avatar name={c.name} size={32} />
              <div>
                <div className="comment__body"><b>{c.name}</b>{c.text}</div>
                <div className="comment__time">{c.time}</div>
              </div>
            </div>
          ))}
          <form className="thread__form" onSubmit={send}>
            <Avatar name={me.name} size={32} />
            <input className="composer__input" style={{ minHeight: 38 }} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escreve um comentário" aria-label="Escrever um comentário" />
            <button type="submit" className="iconbtn" aria-label="Enviar comentário"><Icon name="send" size={18} /></button>
          </form>
        </div>
      )}
    </article>
  );
}

export default function Inicio() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Turma');
  const [text, setText] = useState('');
  const [mine, setMine] = useState<FeedPost[]>([]);

  const publish = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setMine((m) => [{ id: 'm' + m.length, kind: 'duvida', name: me.name, meta: `${me.turma} · ${me.escola} · agora`, text: t, useful: 0, comments: [] }, ...m]);
    setText('');
  };

  const top = ranking.Turma.rows.slice(0, 3);

  return (
    <div className="page">
      <div className="col">
        <div className="pagehead"><h1>Início</h1></div>

        <section className="card cont" aria-label="Simulação em curso">
          <div className="cont__main">
            <div><div className="cont__title">P1 · Redes de Computadores</div><div className="cont__sub">Em curso · questão 5 de 12 · 42 min restantes</div></div>
            <div className="bar" role="progressbar" aria-label="Progresso da simulação" aria-valuenow={5} aria-valuemin={0} aria-valuemax={12}><span style={{ width: `${(5 / 12) * 100}%` }} /></div>
          </div>
          <Link href="/prova/redes-p1" className="btn">Continuar</Link>
        </section>

        <form className="card composer" onSubmit={publish}>
          <div className="composer__row">
            <Avatar name={me.name} size={40} />
            <input className="composer__input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Partilha um resultado ou pergunta à turma" aria-label="Nova publicação" />
            <button type="submit" className="btn btn--sm" disabled={!text.trim()}>Publicar</button>
          </div>
          <div className="composer__acts">
            {ASK.map((a) => (
              <button key={a.label} type="button" className="btn btn--quiet btn--sm" onClick={() => setText((t) => t || a.label + ': ')}>
                <Icon name={a.icon} size={16} />{a.label}
              </button>
            ))}
          </div>
        </form>

        <div className="tabs" role="tablist" aria-label="Mostrar publicações de">
          {TABS.map((t) => <button key={t} type="button" role="tab" className="tab" aria-selected={t === tab} onClick={() => setTab(t)}>{t}</button>)}
        </div>

        {[...mine, ...seed].map((p) => <Post key={p.id} p={p} />)}
      </div>

      <aside className="rail" aria-label="Para ti">
        <section className="card"><div className="card__pad">
          <h2 className="card__title">Para rever</h2>
          {topicsToReview.map((t) => <Mastery key={t.label} label={t.label} value={t.value} />)}
          <Link href="/tutor" className="btn btn--ghost btn--sm">Rever com o tutor</Link>
        </div></section>

        <section className="card"><div className="card__pad">
          <h2 className="card__title">Na tua turma</h2>
          <ol className="mini">
            {top.map((r) => (
              <li key={r.name}><span className="pos num">{r.rank}</span><Avatar name={r.name} size={28} /><span className="grow">{r.name}</span><span className="num muted">{r.score}</span></li>
            ))}
          </ol>
          <Link href="/ranking" className="btn btn--quiet btn--sm" style={{ justifySelf: 'start', padding: 0 }}>Ver a turma toda</Link>
        </div></section>

        <section className="card"><div className="card__pad">
          <h2 className="card__title">Próximas provas</h2>
          {upcoming.map((u) => (
            <div className="event" key={u.title}>
              <div className="event__date"><span>{u.day}<small>{u.month}</small></span></div>
              <div><div style={{ fontWeight: 600, fontSize: 14 }}>{u.title}</div><div className="muted" style={{ fontSize: 13 }}>{u.meta}</div></div>
            </div>
          ))}
        </div></section>
      </aside>
    </div>
  );
}
