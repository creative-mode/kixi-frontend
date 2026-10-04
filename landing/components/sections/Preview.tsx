import { Avatar, AnswerOption, ChatBubble, GradeTile, Logo, Post, QuestionMap, Reactions, Story, Timer } from '@/components/kixi';

const CELLS = ['correct', 'correct', 'wrong', 'correct', 'current', 'pending', 'pending', 'skipped', 'pending', 'pending', 'pending', 'pending'];

export function Preview() {
  return (
    <section className="section section--night" data-theme="dark" id="app" aria-labelledby="preview-title">
      <div className="wrap">
        <p className="eyebrow">A app do aluno</p>
        <h2 id="preview-title" className="h2">Três formas de usar a mesma prova.</h2>
        <p className="lead lead--narrow">
          Simulação, estudo assistido e social learning. Cada nível de interação parte do enunciado que o teu professor carregou.
        </p>

        <div className="phones">
          <figure className="phone-fig phone-fig--pop">
            <div className="phone kx-lcd" data-theme="light" inert>
              <div className="phone__bar"><Logo size={20} wordmark /></div>
              <div className="phone__body">
                <div className="phone__stories">
                  <Story name="Mariana Costa" value="18,2" hue="pop" />
                  <Story name="Paulo Neto" value="30 DIAS" hue="tiro" />
                  <Story name="Inês Lopes" value="VLANs" hue="radar" />
                </div>
                <Post
                  kind="exam"
                  name="Mariana Costa"
                  meta="12B · ITEL · há 2 h"
                  text="Fiz a simulação da P1 de Redes. Subnetting finalmente entrou!"
                  footer={<Reactions items={[{ id: 'a', icon: 'star', label: 'Aplaudir', count: 25, on: true, tone: 'tiro' }, { id: 'b', icon: 'bolt', label: 'Força', count: 9, tone: 'pop' }]} />}
                >
                  <GradeTile title="P1 · Redes" meta="ITEL 2024" delta="+3,0 QUE A ÚLTIMA" grade="18,2" />
                </Post>
              </div>
            </div>
            <figcaption><strong>Social learning.</strong> O feed mostra provas, marcos e dúvidas da tua turma e escola.</figcaption>
          </figure>

          <figure className="phone-fig phone-fig--tiro">
            <div className="phone kx-lcd" data-theme="dark" inert>
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
            <figcaption><strong>Simulação.</strong> Provas reais, com o tempo e os parâmetros definidos pelo professor.</figcaption>
          </figure>

          <figure className="phone-fig phone-fig--radar">
            <div className="phone kx-lcd" data-theme="light" inert>
              <div className="phone__bar"><span className="eyebrow">Tutor</span></div>
              <div className="phone__body">
                <ChatBubble from="student">Não percebi a questão 3. Porque é que não é .63?</ChatBubble>
                <ChatBubble from="tutor" source="P1 · ITEL 2024 · Q3">
                  A Q3 pede o endereço de rede, não o de broadcast. Com /26 cada sub-rede tem 64 endereços: a primeira vai de .0 a .63, por isso a rede é .0.
                </ChatBubble>
                <ChatBubble from="student">E a segunda sub-rede?</ChatBubble>
                <ChatBubble from="tutor" source="P1 · ITEL 2024 · Q3">Começa em .64. Tenta tu: qual é o broadcast dela?</ChatBubble>
              </div>
            </div>
            <figcaption><strong>Estudo assistido.</strong> O tutor responde só com o conteúdo da prova e diz a fonte.</figcaption>
          </figure>
        </div>
        <p className="note">Ilustração da interface com dados de exemplo.</p>
      </div>
    </section>
  );
}
