import { Bug } from './Bug';

export function Vision() {
  return (
    <section className="section section--sunken vision" aria-labelledby="vision-title">
      <div className="wrap vision__in">
        <div>
          <p className="eyebrow">Visão</p>
          <h2 id="vision-title" className="h2">Do ITEL a toda a Angola e a África.</h2>
          <p className="lead">
            Queremos democratizar o acesso ao ensino de qualidade e fazer do Kixi o padrão de suporte educativo personalizado. No futuro, com a integração do NVIDIA PersonaPlex, a IA poderá preservar a voz, o método e a empatia dos professores de cada disciplina, disponível 24/7.
          </p>
          <p className="vision__quote">Sentindo as mesmas dores, solução concebida por alunos, para alunos.</p>
        </div>
        <div className="vision__art" aria-hidden="true">
          <Bug className="vision__bug vision__bug--1" width={72} />
          <Bug className="vision__bug vision__bug--2" width={48} />
          <Bug className="vision__bug vision__bug--3" width={60} />
        </div>
      </div>
    </section>
  );
}
