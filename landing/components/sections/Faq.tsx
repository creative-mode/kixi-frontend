import { FAQ, LOGIN_URL, SIGNUP_URL } from '@/lib/content';
import { Cta } from './CtaLink';

const GROUPS = [...new Set(FAQ.map((f) => f.group))];

export function Faq() {
  return (
    <section className="sec sec--paper" id="perguntas" aria-labelledby="faq-title">
      <div className="wrap">
        <header className="sec__head">
          <h2 id="faq-title" className="h2">Perguntas frequentes.</h2>
        </header>
        <div className="faq">
          {GROUPS.map((g) => (
            <div key={g} className="faq__group">
              <h3 className="faq__label">{g}</h3>
              {FAQ.filter((f) => f.group === g).map((f) => (
                <details key={f.q} className="faq__item">
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          ))}
        </div>
        <div className="faq__cta">
          <p className="sec__sub">Pronto para estudar o que vai mesmo sair?</p>
          <div className="actions">
            <Cta href={SIGNUP_URL} origem="faq">Começar a estudar</Cta>
            <Cta href={LOGIN_URL} origem="faq" secondary>Já tenho conta</Cta>
          </div>
        </div>
      </div>
    </section>
  );
}
