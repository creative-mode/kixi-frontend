import { AUDIENCES } from '@/lib/content';

export function Audiences() {
  return (
    <section className="sec sec--deep" id="para-quem" aria-labelledby="aud-title">
      <div className="wrap">
        <header className="sec__head">
          <p className="eyebrow">Para quem é</p>
          <h2 id="aud-title" className="h2">Cada um ganha o seu tempo de volta.</h2>
        </header>
        <div className="aud">
          {AUDIENCES.map((a) => (
            <article key={a.id} id={a.id} className="aud__col">
              <h3 className="aud__title">{a.title}</h3>
              <p className="aud__line">{a.line}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
