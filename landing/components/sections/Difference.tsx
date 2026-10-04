import { Icon } from '@/components/kixi';

export function Difference() {
  return (
    <section className="section section--night diff" data-theme="dark" aria-labelledby="diff-title">
      <div className="wrap">
        <p className="eyebrow">O diferencial</p>
        <h2 id="diff-title" className="diff__title">
          Cada exame ganha um <span>gémeo digital.</span>
        </h2>
        <p className="diff__lead">
          Outras plataformas guardam provas ou corrigem gabaritos. O Kixi lê a estrutura do exame, mantém o enunciado fiel e deixa o aluno estudar exatamente o que foi cobrado, com um tutor que conhece cada questão e cada “pegadinha”.
        </p>
        <ul className="diff__list">
          <li className="hue-brand"><span className="diff__ic"><Icon name="camera" size={28} /></span><strong>Lê a estrutura, não só as palavras.</strong><p>Cabeçalho, perguntas, opções e pontuações, em segundos.</p></li>
          <li className="hue-pop"><span className="diff__ic"><Icon name="target" size={28} /></span><strong>Simula novas versões da mesma prova.</strong><p>Percebes o teu desempenho face a um padrão de excelência.</p></li>
          <li className="hue-radar"><span className="diff__ic"><Icon name="chat" size={28} /></span><strong>Monitoria personalizada, 24 horas por dia.</strong><p>Explica conceitos, sugere exercícios e não deixa nenhuma dúvida para trás.</p></li>
        </ul>
      </div>
    </section>
  );
}
