import { FAQ } from '@/lib/content';

export function Faq() {
  return (
    <section className="sec sec--paper" id="faq" aria-labelledby="faq-title">
      <div className="wrap">
        <header className="sec__head">
          <h2 id="faq-title" className="h2">O essencial.</h2>
        </header>
        <div className="faq">
          {FAQ.map((f) => (
            <details key={f.q} className="faq__item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
