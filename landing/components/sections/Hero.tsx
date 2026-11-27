import { HERO_SUB, HERO_TITLE, LOGIN_URL, SIGNUP_URL } from '@/lib/content';
import { Cta, TrackedLink } from './CtaLink';
import { TryQuestion } from './TryQuestion';

/** Primeiro ecrã: a promessa, as duas saídas (#512), a doação (#762) e uma questão de prova
 *  para responder já — o produto experimenta-se antes de se criar conta. */
export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap hero__in">
        <div className="hero__copy">
          <p className="hero__eyebrow">Feito por alunos do ITEL, para alunos</p>
          <h1 id="hero-title" className="hero__title">{HERO_TITLE}</h1>
          <p className="hero__sub">{HERO_SUB}</p>
          <div className="actions hero__actions">
            <Cta href={SIGNUP_URL} origem="hero">Começar a estudar</Cta>
            <Cta href={LOGIN_URL} origem="hero" secondary>Já tenho conta</Cta>
          </div>
          <p className="hero__donate-line">
            Tens provas antigas? <TrackedLink href="/doar" origem="hero" className="hero__donate">Doar um enunciado</TrackedLink>
          </p>
        </div>
        <TryQuestion />
      </div>
    </section>
  );
}
