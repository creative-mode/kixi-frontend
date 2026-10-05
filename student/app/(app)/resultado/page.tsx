import Link from 'next/link';
import { Icon, Mastery } from '@/components/ui';
import { result } from '@/lib/data';

export const metadata = { title: 'Resultado · Kixi' };

export default function Resultado() {
  return (
    <div className="page page--single">
      <div className="col" style={{ gap: 20 }}>
        <div className="pagehead"><div><p style={{ margin: 0 }}>Resultado</p><h1>{result.title}</h1></div></div>

        <div className="score">
          <span className="score__n num">{result.score}</span>
          <span className="score__of">de 20 valores</span>
          <span className="tag tag--good" style={{ paddingBottom: 8 }}><span className="tag__dot" />{result.delta}</span>
        </div>

        <div className="stats">
          <div className="stat"><b className="num">{result.correct}</b><span>respostas certas</span></div>
          <div className="stat"><b className="num">{result.time}</b><span>tempo gasto</span></div>
          <div className="stat"><b className="num">{result.place}</b><span>posição na turma</span></div>
        </div>

        <section className="card"><div className="card__pad" style={{ display: 'grid', gap: 14 }}>
          <h2 className="card__title">Domínio por tema</h2>
          {result.topics.map((t) => <Mastery key={t.label} label={t.label} value={t.value} />)}
        </div></section>

        <section className="card" aria-label="Questões a rever">
          <div className="card__pad" style={{ paddingBottom: 6 }}><h2 className="card__title">Questões a rever</h2></div>
          {result.wrong.map((w) => (
            <div className="review" key={w.q}>
              <span className="review__q">{w.q}</span>
              <div className="review__main"><b>{w.text}</b><span>{w.topic}</span></div>
              <Link href="/tutor" className="btn btn--quiet btn--sm">Ver explicação</Link>
            </div>
          ))}
        </section>

        <div className="actions">
          <Link href="/tutor" className="btn"><Icon name="chat" size={18} />Rever erros com o tutor</Link>
          <Link href="/inicio" className="btn btn--ghost"><Icon name="send" size={18} />Partilhar com a turma</Link>
          <Link href="/provas" className="btn btn--quiet">Voltar às provas</Link>
        </div>
      </div>
    </div>
  );
}
