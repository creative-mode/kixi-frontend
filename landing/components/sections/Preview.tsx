import { AnswerOption, QuestionMap, Timer } from '@/components/kixi';

const CELLS = ['correct', 'correct', 'wrong', 'correct', 'current', 'pending', 'pending', 'skipped', 'pending', 'pending', 'pending', 'pending'];

export function Preview() {
  return (
    <section className="sec sec--light" id="app" aria-labelledby="preview-title">
      <div className="wrap">
        <header className="sec__head">
          <p className="eyebrow">A app do aluno</p>
          <h2 id="preview-title" className="h2">Cada exame ganha um gémeo digital.</h2>
          <p className="sec__sub">Estudas exatamente o que foi cobrado.</p>
        </header>
        <div className="phone-stage">
          <div className="phone" data-theme="dark" inert>
            <div className="phone__bar"><span className="eyebrow">P1 · Redes</span></div>
            <div className="phone__body">
              <Timer time="42:10" progress={0.7} extra="+25% tempo" />
              <QuestionMap cells={CELLS} legend={false} />
              <p className="phone__q">Qual é o endereço de broadcast da primeira sub-rede de 192.168.10.0/26?</p>
              <AnswerOption letter="A">192.168.10.31</AnswerOption>
              <AnswerOption letter="B" state="selected">192.168.10.63</AnswerOption>
              <AnswerOption letter="C">192.168.10.64</AnswerOption>
            </div>
          </div>
        </div>
        <p className="note">Ilustração com dados de exemplo.</p>
      </div>
    </section>
  );
}
