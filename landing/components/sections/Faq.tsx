import { FAQ } from '@/lib/content';

export function Faq() {
  const groups = Array.from(new Set(FAQ.map((f) => f.group)));
  return (
    <section className="section" id="faq" aria-labelledby="faq-title">
      <div className="wrap wrap--narrow">
        <p className="eyebrow">Perguntas frequentes</p>
        <h2 id="faq-title" className="h2">O que perguntam professores, alunos e escolas.</h2>
        {groups.map((g) => (
          <div key={g} className="faq__group">
            <h3 className="faq__g">{g}</h3>
            {FAQ.filter((f) => f.group === g).map((f) => (
              <details key={f.q} className="faq__item">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
