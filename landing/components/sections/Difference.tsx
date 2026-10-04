import { Icon } from '@/components/kixi';

export function Difference() {
  return (
    <section className="section" aria-labelledby="diff-title">
      <div className="wrap diff">
        <div>
          <p className="eyebrow">O diferencial</p>
          <h2 id="diff-title" className="h2">Cada exame ganha um gémeo digital.</h2>
          <p className="lead">
            Outras plataformas guardam provas ou corrigem gabaritos. O Kixi lê a estrutura do exame, mantém o enunciado fiel e deixa o aluno estudar exatamente o que foi cobrado, com um tutor que conhece cada questão e cada “pegadinha”.
          </p>
        </div>
        <ul className="diff__list">
          <li><span className="diff__ic hue-brand"><Icon name="camera" size={24} /></span><div><strong>Lê a estrutura, não só as palavras.</strong><p>Cabeçalho, perguntas, opções e pontuações, em segundos.</p></div></li>
          <li><span className="diff__ic hue-pop"><Icon name="target" size={24} /></span><div><strong>Simula novas versões da mesma prova.</strong><p>Percebes o teu desempenho face a um padrão de excelência.</p></div></li>
          <li><span className="diff__ic hue-radar"><Icon name="chat" size={24} /></span><div><strong>Monitoria personalizada, 24 horas por dia.</strong><p>Explica conceitos, sugere exercícios e não deixa nenhuma dúvida para trás.</p></div></li>
        </ul>
      </div>
    </section>
  );
}
