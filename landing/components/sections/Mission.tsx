import { TrackedLink } from './CtaLink';

/** A doação de enunciados, com o que acontece a seguir: é o que enche o repositório para todos. */
const WHAT_HAPPENS = [
  'Fotografas a prova ou envias o PDF. Não precisas de conta.',
  'A equipa Kixi revê o enunciado antes de o publicar.',
  'Fica disponível para alunos e professores de todas as escolas.',
] as const;

export function Mission() {
  return (
    <section className="sec sec--paper donate" aria-labelledby="donate-title">
      <div className="wrap donate__in">
        <div className="donate__art" aria-hidden="true">
          <div className="donate__sheet donate__sheet--3"><i /><i /><i /></div>
          <div className="donate__sheet donate__sheet--2"><i /><i /><i /><i /></div>
          <div className="donate__sheet donate__sheet--1">
            <span className="donate__tag">P2 · Exame</span>
            <i className="is-head" /><i /><i className="is-short" /><i /><i /><i className="is-short" />
          </div>
        </div>
        <div className="donate__copy">
          <p className="sec__kicker">Do ITEL a toda a Angola e a África</p>
          <h2 id="donate-title" className="donate__title">Tens provas antigas na gaveta?</h2>
          <p className="donate__text">Cada enunciado que chega ao Kixi ajuda outro aluno a estudar o que vai mesmo sair.</p>
          <ol className="donate__steps">
            {WHAT_HAPPENS.map((t) => <li key={t}>{t}</li>)}
          </ol>
          <TrackedLink href="/doar" origem="outro" className="kx-btn kx-btn--lg donate__cta">
            <span className="kx-btn__label">Doar um enunciado</span>
          </TrackedLink>
        </div>
      </div>
    </section>
  );
}
