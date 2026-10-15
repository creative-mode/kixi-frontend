import type { ExamExtraction } from '../exam/extraction';

/**
 * O que a extração de `POST /ocr/extract/exam` devolve para a prova de OGI da 12ª classe (série B)
 * quando o OCR a lê bem: seis questões, dois tipos de alíneas, sem cotação no papel.
 *
 * Dados puros, sem `server-only`, porque servem a duas coisas: o mock do backend responde com isto
 * a qualquer ficheiro importado, e os testes de `draftFromExtraction` usam-no como caso real.
 */
export const OGI_EXTRACTION: ExamExtraction = {
  exam_type: 'Prova de Exame',
  duration_minutes: 90,
  variant: 'B',
  title: 'Prova de Exame de OGI – 12ª Classe – Série B – 2024/2025',
  instructions: 'Leia a prova com atenção, coloque na folha de prova a variante correspondente e responda de uma forma clara.',
  school_year_start: 2024,
  school_year_end: 2025,
  class_grade: '12',
  course_name: 'todos',
  subject_name: 'OGI',
  total_max_score: null,
  needs_review: true,
  overall_confidence: 0.93,
  warnings: [{ code: 'NO_COTACAO', field: null, confidence: null, message: '6 questões sem cotação' }],
  questions: [
    { number: '1', type: 'dissertativa', confidence: 0.95, cotacao: null, options: null, subitems: [], subitems_content: [],
      text: 'O que consiste o aprovisionamento em uma organização empresarial e quais são os aspectos que devemos levar em consideração?' },
    { number: '2', type: 'dissertativa', confidence: 0.92, cotacao: null, options: null, subitems: [], subitems_content: [],
      text: 'O que entendes por ciclo de vida do produto e argumenta cada uma das fases que o compõe?' },
    { number: '3', type: 'verdadeiro_falso', confidence: 0.93, cotacao: null, options: null, subitems: ['a', 'b', 'c', 'd'],
      text: 'Para cada uma das questões abaixo, diga quais são verdadeiras (assinalar com V) ou falsas (assinalar com F):',
      subitems_content: [
        { label: 'a', type: 'verdadeiro_falso', cotacao: null, text: 'Deve ser preocupação da organização comprar ao melhor preço possível estabelecido pelo produtor' },
        { label: 'b', type: 'verdadeiro_falso', cotacao: null, text: 'A escolha das matérias a utilizar só deve ser feita após a determinação das possíveis aplicações que se irão fazer com os insumos' },
        { label: 'c', type: 'verdadeiro_falso', cotacao: null, text: 'A escolha das matérias tem de ter em conta as qualidades do tratamento térmico que se pretende que o produto final possua' },
        { label: 'd', type: 'verdadeiro_falso', cotacao: null, text: 'Ao comprar as matérias a empresa deve ainda ter em atenção se o tipo adquirido está adaptado ao processo de laboração na empresa' },
      ] },
    { number: '4', type: 'dissertativa', confidence: 0.97, cotacao: null, options: null, subitems: [], subitems_content: [],
      text: 'Explique e esquematize as fases que abrange o planeamento dentro de uma organização?' },
    { number: '5', type: 'composta', confidence: 0.94, cotacao: null, options: null, subitems: ['a', 'b'],
      text: 'Uma empresa utiliza o Lote Económico, para repor o estoque de uma das suas peças cujo o Lote previsto é de 6000 unidades diário. Se o custo de colocação de um pedido é de 4 mil kz, e a demanda a ser utilizado é de 90 mil unidades mensal.',
      subitems_content: [
        { label: 'a', type: 'dissertativa', cotacao: null, text: 'Demonstre a expressão matemática para o cálculo do custo de manutenção de estoques.' },
        { label: 'b', type: 'dissertativa', cotacao: null, text: 'Calcule do custo de manutenção de estoques anual e mensal?' },
      ] },
    { number: '6', type: 'dissertativa', confidence: 0.95, cotacao: null, options: null, subitems: [], subitems_content: [],
      text: 'Determinada peça é consumida em 2.500 unidades mensalmente e sabemos que seu tempo de reposição é 1,8% da demanda em dias. Então, qual é o seu ponto de pedido, uma vez que seu estoque de segurança é de 400 unidades?' },
  ],
};
