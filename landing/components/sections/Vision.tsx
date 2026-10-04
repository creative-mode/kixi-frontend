import { Sprite } from './Bug';

export function Vision() {
  return (
    <section className="vision" aria-labelledby="vision-title">
      <div className="wrap vision__in">
        <h2 id="vision-title" className="h2 h2--pixel">Do ITEL a toda a Angola e a África.</h2>
        <p className="sec__sub">Feito por alunos, para alunos.</p>
      </div>
      <div className="vision__march" aria-hidden="true">
        <Sprite kind="fly" width={36} />
        <Sprite kind="moth" width={52} />
        <Sprite kind="fly" width={36} />
      </div>
    </section>
  );
}
