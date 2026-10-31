import { PresentationStage } from './PresentationStage';

/**
 * Shell de servidor: o `<h1>` nasce no HTML inicial (fora do custo do bundle
 * cliente da animação). O palco animado é um island que só pinta via CSS/`--p`.
 */
export function Presentation() {
  return (
    <PresentationStage
      hero={
        <div className="pres__hero" data-pres-hero>
          <h1 id="hero-title" className="pres__hero-title">
            E se estudar fosse... divertido?
          </h1>
        </div>
      }
    />
  );
}
