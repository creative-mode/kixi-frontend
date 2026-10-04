import { Sprite } from './Bug';

export function Vision() {
  return (
    <section className="vision" aria-labelledby="vision-title">
      <div className="vision__sky" aria-hidden="true" />
      <div className="wrap vision__in">
        <p className="eyebrow">Visão</p>
        <h2 id="vision-title" className="vision__title">Do ITEL a toda a Angola e a África.</h2>
        <div className="vision__cols">
          <p className="vision__text">
            Queremos democratizar o acesso ao ensino de qualidade e fazer do Kixi o padrão de suporte educativo personalizado. No futuro, com a integração do NVIDIA PersonaPlex, a IA poderá preservar a voz, o método e a empatia dos professores de cada disciplina, disponível 24/7.
          </p>
          <p className="vision__quote">Sentindo as mesmas dores, solução concebida por alunos, para alunos.</p>
        </div>
      </div>
      <div className="vision__march" aria-hidden="true">
        {Array.from({ length: 9 }).map((_, i) => (
          <Sprite key={i} kind={i % 2 ? 'fly' : 'moth'} width={i % 2 ? 40 : 56} />
        ))}
      </div>
    </section>
  );
}
