/** A semente de «Prepara-te para a prova»: um banco de provas anteriores de Redes de Computadores com as questões
 *  etiquetadas por tema, e uma prova agendada (sala 4) cuja matriz o professor já carregou. */

import type { CatalogRow } from './store';
import type { MockQuestion } from './simulation';
import type { MockMatrix, MockTopic } from './training';

export const TOPICS: MockTopic[] = [
  { id: 1, subjectId: 1, name: 'Endereçamento IP' },
  { id: 2, subjectId: 1, name: 'Sub-redes' },
  { id: 3, subjectId: 1, name: 'Modelo OSI' },
  { id: 4, subjectId: 1, name: 'Protocolos de rede' },
];

/** As cinco questões que a prova 1 já tinha, etiquetadas. */
export const BASE_TOPICS: Record<number, number[]> = { 1: [1], 2: [2], 3: [2], 4: [1], 5: [3] };

type Row = [id: number, topic: number, text: string, options: string[], correct: number];

const BANK: Record<number, Row[]> = {
  // Teste de 2023/2024
  6: [
    [201, 1, 'Qual destes endereços IPv4 é privado?', ['172.16.4.9', '8.8.8.8', '200.10.1.1'], 0],
    [202, 1, 'Quantos bits tem um endereço IPv4?', ['16', '32', '64'], 1],
    [203, 2, 'A máscara 255.255.255.0 corresponde a que prefixo?', ['/16', '/24', '/28'], 1],
    [204, 2, 'Quantos hosts utilizáveis tem uma sub-rede /30?', ['2', '4', '6'], 0],
    [205, 3, 'Em que camada do modelo OSI trabalha um router?', ['Rede', 'Ligação de dados', 'Transporte'], 0],
    [206, 4, 'Que protocolo traduz nomes de domínio em endereços IP?', ['DHCP', 'DNS', 'FTP'], 1],
  ],
  // Exame de 2024/2025
  7: [
    [207, 1, 'Qual é o endereço de loopback do IPv4?', ['127.0.0.1', '0.0.0.0', '255.255.255.255'], 0],
    [208, 2, 'Quantas sub-redes se obtêm ao pedir 2 bits emprestados a um /24?', ['2', '4', '8'], 1],
    [209, 2, 'O endereço de broadcast de 192.168.1.0/24 é:', ['192.168.1.1', '192.168.1.254', '192.168.1.255'], 2],
    [210, 3, 'Qual camada do modelo OSI trata do encaminhamento entre redes?', ['Física', 'Rede', 'Aplicação'], 1],
    [211, 4, 'Que protocolo atribui endereços IP automaticamente?', ['DHCP', 'SMTP', 'ARP'], 0],
    [212, 4, 'Que porta usa por omissão o HTTPS?', ['80', '443', '25'], 1],
  ],
  // Teste de 2025/2026 (outra turma)
  8: [
    [213, 1, 'Quantos endereços tem uma rede de classe C?', ['256', '65 536', '1024'], 0],
    [214, 2, 'Quantos bits de host tem uma máscara /26?', ['6', '8', '26'], 0],
    [215, 2, 'Qual é a máscara de uma rede /28?', ['255.255.255.240', '255.255.255.248', '255.255.255.224'], 0],
    [216, 3, 'A camada de transporte do modelo OSI é a número:', ['3', '4', '7'], 1],
    [217, 3, 'Qual destas camadas é a mais alta do modelo OSI?', ['Sessão', 'Apresentação', 'Aplicação'], 2],
    [218, 4, 'Que protocolo resolve um endereço IP num endereço MAC?', ['ARP', 'ICMP', 'TCP'], 0],
  ],
};

const STATEMENTS: CatalogRow[] = [
  { id: 6, title: 'Teste de Redes de Computadores', examType: 'Teste', subjectId: 1, schoolYearId: 3, termId: 1, institutionId: 1, classId: 1, durationMinutes: 60, totalMaxScore: 20, variant: null, source: 'MANUAL', needsReview: false, ocrConfidence: null, visible: true },
  { id: 7, title: 'Exame de Redes de Computadores', examType: 'Exame', subjectId: 1, schoolYearId: 2, termId: 3, institutionId: 1, classId: 1, durationMinutes: 90, totalMaxScore: 20, variant: null, source: 'MANUAL', needsReview: false, ocrConfidence: null, visible: true },
  { id: 8, title: 'Teste 1 de Redes de Computadores', examType: 'Teste', subjectId: 1, schoolYearId: 1, termId: 2, institutionId: 1, classId: 1, durationMinutes: 45, totalMaxScore: 20, variant: null, source: 'MANUAL', needsReview: false, ocrConfidence: null, visible: true },
  // A prova agendada (sala 4): fica por publicar, o aluno só a vê no dia.
  { id: 9, title: 'Teste 2 de Redes de Computadores', examType: 'Teste', subjectId: 1, schoolYearId: 1, termId: 2, institutionId: 1, classId: 1, durationMinutes: 60, totalMaxScore: 20, variant: null, source: 'MANUAL', needsReview: false, ocrConfidence: null, visible: false },
];

export const SEED_STATEMENTS = STATEMENTS;

export const SEED_QUESTIONS: MockQuestion[] = Object.entries(BANK).flatMap(([, rows]) =>
  rows.map(([id, , text, options, correct], index) => ({
    id,
    number: index + 1,
    text,
    questionType: 'multiple_choice',
    maxScore: 2,
    orderIndex: index,
    options: options.map((optionText, o) => ({ id: id * 10 + o + 1, optionLabel: 'ABC'[o]!, optionText, isCorrect: o === correct, orderIndex: o })),
  })),
);

export const SEED_BY_STATEMENT: Record<number, number[]> = {
  ...Object.fromEntries(Object.entries(BANK).map(([statementId, rows]) => [Number(statementId), rows.map((r) => r[0])])),
  9: [1, 2, 4],
};

export const SEED_QUESTION_TOPICS: Record<number, number[]> = {
  ...BASE_TOPICS,
  ...Object.fromEntries(Object.values(BANK).flat().map(([id, topic]) => [id, [topic]])),
};

/** A matriz da prova 4, em 20 valores: o que o professor carregou, com a cotação e o nível de cada tema. */
export const SEED_MATRICES: MockMatrix[] = [
  {
    roomId: 4,
    title: 'Matriz do Teste 2',
    totalPoints: 20,
    items: [
      { topicId: 1, questionCount: 3, points: 6, cognitiveLevel: 'APPLICATION' },
      { topicId: 2, questionCount: 3, points: 7, cognitiveLevel: 'APPLICATION' },
      { topicId: 3, questionCount: 2, points: 4, cognitiveLevel: 'KNOWLEDGE' },
      { topicId: 4, questionCount: 2, points: 3, cognitiveLevel: 'COMPREHENSION' },
    ],
  },
];
