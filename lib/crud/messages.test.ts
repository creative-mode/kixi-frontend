import test from 'node:test';
import assert from 'node:assert/strict';
import { friendlyMessage, messageForCode, translate } from './messages.ts';

const problem = (detail: string, extra: Record<string, unknown> = {}) => JSON.stringify({ title: 'x', detail, properties: extra });

test('tira instance, requestId e caminhos do texto', () => {
  const body = problem('Algo falhou', { instance: '/api/v1/classes/3', requestId: 'req-abc123', campo: 'obrigatório' });
  assert.equal(friendlyMessage(400, body), 'Algo falhou · obrigatório');
  assert.equal(friendlyMessage(400, problem('/api/v1/x', { requestId: 'req-1' })), 'x');
});

test('409 de remoção protegida fica em português', () => {
  assert.equal(friendlyMessage(409, problem('This course still has 2 active class(es): remove or move them first')), 'Este curso ainda tem 2 turma(s) ativa(s): remova-as ou mude-as primeiro.');
  assert.match(friendlyMessage(409, problem('This class still has 3 active enrollment(s) and 1 active teaching assignment(s): cancel or move them first')), /3 matrícula\(s\) e 1 atribuição/);
  assert.match(friendlyMessage(409, problem('The institution still has 4 active course(s): remove or move them first')), /4 curso\(s\)/);
});

test('409 de duplicado, com e sem detalhe', () => {
  assert.equal(friendlyMessage(409, problem('This teacher is already assigned to this class and subject')), 'Este professor já está atribuído a esta turma e disciplina.');
  assert.match(friendlyMessage(409, problem('This teacher is already assigned to this class and subject, possibly in the trash; restore or purge that assignment first')), /talvez na lixeira/);
  assert.equal(friendlyMessage(409, JSON.stringify({ title: 'Conflict' })), 'Já existe um registo com estes dados.');
});

test('422 de atribuição inválida', () => {
  assert.match(friendlyMessage(422, problem('The teacher is not affiliated to the school of this class: add them to the institution first')), /não está afiliado/);
  assert.match(friendlyMessage(422, problem('The subject is not in the curriculum of this class: add it to its course for grade 12 first')), /currículo do curso/);
  assert.equal(friendlyMessage(422, JSON.stringify({})), 'Os dados não são válidos para esta operação.');
});

test('401, 403 e 404 não dependem do corpo', () => {
  assert.equal(friendlyMessage(403, problem('Forbidden')), 'Não tem permissão para esta operação.');
  assert.equal(friendlyMessage(401, ''), 'Sessão expirada. Inicie sessão novamente.');
  assert.equal(friendlyMessage(404, ''), 'Registo não encontrado.');
});

test('texto desconhecido e corpo que não é JSON ficam como vieram', () => {
  assert.equal(translate('Something odd'), 'Something odd');
  assert.equal(friendlyMessage(500, 'boom'), 'boom');
  assert.equal(friendlyMessage(500, ''), 'Erro 500');
});

test('403 e 404 com um motivo conhecido mostram o motivo; o 401 é sempre a sessão', () => {
  assert.equal(friendlyMessage(403, problem('The room class must match the statement class')), 'A turma da sala tem de ser a do enunciado: escolha um enunciado desta turma.');
  assert.match(friendlyMessage(403, problem('A teacher may only create a room for an assigned class')), /não tem turma/);
  assert.match(friendlyMessage(403, problem('Teacher is not assigned to this class and subject')), /Não está atribuído/);
  assert.equal(friendlyMessage(404, problem('Statement not found')), 'O enunciado não existe ou foi removido.');
  assert.equal(friendlyMessage(404, problem('Algo que não conhecemos')), 'Registo não encontrado.');
  assert.equal(friendlyMessage(403, 'não é JSON'), 'Não tem permissão para esta operação.');
  assert.equal(friendlyMessage(401, problem('The room class must match the statement class')), 'Sessão expirada. Inicie sessão novamente.');
});

test('o convite à turma explica porque falhou', () => {
  assert.match(friendlyMessage(403, problem('The invited account must be a STUDENT')), /papel de aluno/);
  assert.equal(friendlyMessage(400, problem('The class has no active students')), 'A turma não tem alunos matriculados para convidar.');
  assert.match(friendlyMessage(409, problem('Invalid exam room state transition')), /não pode passar/);
});

test('publicar um enunciado com questões sem opção correcta dá o aviso em português, com os números das questões', () => {
  const m = friendlyMessage(422, problem('These questions have options but no correct option marked: question 2, 3'));
  assert.equal(m, 'Há questões com opções mas sem a opção correcta marcada: questão 2, 3. Marque a resposta certa em cada uma antes de publicar.');
  assert.equal(friendlyMessage(422, problem('These questions have options but no correct option marked: question 7')), 'Há questões com opções mas sem a opção correcta marcada: questão 7. Marque a resposta certa em cada uma antes de publicar.');
  assert.doesNotMatch(m, /These questions/);
});

test('um erro desconhecido do backend não é escondido', () => {
  assert.equal(friendlyMessage(422, problem('Something never seen before')), 'Something never seen before');
});

// kixi#648: os erros do OCR chegavam em inglês ao ecrã.
test('os erros do OCR ficam em português claro, sem perder o número de píxeis nem de páginas', () => {
  assert.match(translate('Unsupported or invalid OCR file'), /não é uma imagem.*nem um PDF válido/);
  assert.match(translate('Unsupported or invalid OCR image'), /corrompida/);
  assert.match(translate('OCR image exceeds the maximum pixel count'), /resolução/);
  assert.match(translate('The image is too large to read: 123456789 pixels'), /demasiado grande.*123\s456\s789 píxeis/);
  assert.match(translate('A PDF can have at most 30 pages'), /no máximo 30 páginas/);
  assert.match(translate('The PDF carries script or an embedded file. Send photos of the pages or a flattened PDF.'), /script ou um ficheiro embebido/);
  for (const t of ['Unsupported or invalid OCR file', 'The image is too large to read: 9 pixels', 'OCR processing failed', 'OCR stream ended without a result']) {
    assert.doesNotMatch(translate(t), /\b(OCR processing|Unsupported|too large|stream)\b/, t);
  }
});

test('a falha geral do OCR diz o que verificar (em branco, corrompido, desfocado), porque o backend não as distingue', () => {
  const falha = translate('OCR processing failed');
  assert.match(falha, /em branco/);
  assert.match(falha, /corrompid/);
  assert.equal(translate('OCR stream ended without a result'), falha);
});

test('o erro do OCR vem em problem+json e continua traduzido; um texto desconhecido do OCR não se esconde', () => {
  assert.match(friendlyMessage(400, problem('Unsupported or invalid OCR file')), /não é uma imagem/);
  assert.equal(friendlyMessage(400, problem('OCR engine exploded in a new way')), 'OCR engine exploded in a new way');
  assert.equal(translate('Algo novo do OCR'), 'Algo novo do OCR');
});

// kixi#648 (backend): o erro padrão traz `properties.code` e o estado do trabalho traz `errorCode`; o texto inglês não muda.
const comCodigo = (detail: string, code: string, extra: Record<string, unknown> = {}) => problem(detail, { code, ...extra });

test('com código, a mensagem em português sai do código e distingue branco, ilegível e corrompido', () => {
  const branco = friendlyMessage(400, comCodigo('OCR extraction failed', 'OCR_NO_TEXT'));
  const ilegivel = friendlyMessage(400, comCodigo('OCR extraction failed', 'OCR_UNREADABLE'));
  const corrompido = friendlyMessage(400, comCodigo('OCR extraction failed', 'OCR_FILE_CORRUPT'));
  assert.match(branco, /em branco/);
  assert.match(ilegivel, /ilegível/);
  assert.match(corrompido, /corrompido/);
  assert.equal(new Set([branco, ilegivel, corrompido]).size, 3, 'três causas, três mensagens');
  for (const m of [branco, ilegivel, corrompido]) assert.doesNotMatch(m, /OCR extraction failed|OCR_/);
});

test('cada código do OCR tem a sua mensagem, e o código nunca se mostra ao utilizador', () => {
  const casos: [string, RegExp][] = [
    ['OCR_FILE_INVALID', /nem um PDF válido/],
    ['IMAGE_TOO_LARGE', /demasiado grande/],
    ['OCR_FILE_REJECTED', /recusou o ficheiro/],
    ['OCR_UNAVAILABLE', /indisponível/],
    ['OCR_PROCESSING_FAILED', /Não foi possível ler o ficheiro/],
  ];
  for (const [code, re] of casos) {
    const m = friendlyMessage(code === 'OCR_UNAVAILABLE' ? 503 : 400, comCodigo('texto inglês qualquer', code));
    assert.match(m, re, code);
    assert.doesNotMatch(m, new RegExp(code), code);
    assert.doesNotMatch(m, /texto inglês qualquer/, code);
  }
});

test('IMAGE_TOO_LARGE mantém o número de píxeis quando o texto o traz', () => {
  assert.match(friendlyMessage(400, comCodigo('The image is too large to read: 123456789 pixels', 'IMAGE_TOO_LARGE')), /123\s456\s789 píxeis/);
});

test('sem código (backend antigo) o mapeamento por texto continua a valer', () => {
  assert.match(friendlyMessage(400, problem('Unsupported or invalid OCR file')), /nem um PDF válido/);
  assert.match(friendlyMessage(400, problem('OCR processing failed')), /Não foi possível ler o ficheiro/);
});

test('um código desconhecido não esconde o erro: cai para o texto, e o código não se acrescenta à mensagem', () => {
  assert.equal(friendlyMessage(400, comCodigo('Algo novo do backend', 'CODIGO_NOVO')), 'Algo novo do backend');
  assert.match(friendlyMessage(400, comCodigo('Unsupported or invalid OCR file', 'CODIGO_NOVO')), /nem um PDF válido/);
});

test('um código que não é do OCR (outros erros do backend) não mexe na mensagem de sempre nem a polui', () => {
  assert.equal(friendlyMessage(409, comCodigo('Algo de conflito', 'DONATION_DUPLICATE')), 'Algo de conflito');
});

test('messageForCode: só códigos do OCR, em português; desconhecido ou vazio dá null', () => {
  assert.match(messageForCode('OCR_NO_TEXT')!, /em branco/);
  assert.equal(messageForCode('XYZ'), null);
  assert.equal(messageForCode(null), null);
  assert.equal(messageForCode(undefined), null);
  assert.equal(messageForCode(42 as never), null);
});

// kixi-frontend#848: o conflito de um import do OCR já activo aparecia em inglês.
test('o conflito de um import do OCR já activo fica em português', () => {
  assert.match(friendlyMessage(409, problem('An OCR import is already active for this account')), /leitura de folhas em curso/);
  assert.doesNotMatch(translate('An OCR import is already active for this account'), /OCR import/);
});

test('as mensagens do feed, das amizades e das contas chegam em português (S9)', () => {
  assert.equal(translate('Class not found'), 'A turma não existe ou foi removida.');
  assert.equal(translate('Content must have 5 to 2000 characters (optional for SIMULATION posts)'), 'O texto tem de ter entre 5 e 2000 caracteres.');
  assert.equal(translate('Content must have at least 5 characters'), 'O texto tem de ter pelo menos 5 caracteres.');
  assert.match(translate('Account is inactive'), /conta está desativada/);
  assert.match(translate('Too many feed requests. Try again later.'), /pedidos a mais/);
  assert.equal(friendlyMessage(404, problem('Post not found')), 'A publicação não existe ou foi removida.');
  assert.match(translate('You cannot follow yourself'), /si próprio/);
  assert.equal(translate('Class not found, or you do not belong to it'), 'A turma não existe ou não pertence a ela.');
});

test('plano do trimestre: dispensa com a pauta aberta (409) e reagendar para o passado (400) (kixi#657)', () => {
  assert.equal(friendlyMessage(409, problem('A pauta já está aberta: já não se pode dispensar uma avaliação')), 'A pauta já está aberta: já não se pode dispensar uma avaliação.');
  assert.match(friendlyMessage(409, problem('The pauta is already open: its assessments cannot be rescheduled')), /A pauta já está aberta/);
  assert.match(friendlyMessage(400, problem('A nova data não pode ser no passado')), /não pode ser no passado/);
});

test('enunciado de uma prova por terminar: o 403 diz porquê, em vez de «sem permissão» (kixi#659)', () => {
  const texto = 'Este enunciado faz parte de uma prova que ainda não terminou. As perguntas só ficam disponíveis depois de a prova terminar.';
  assert.match(friendlyMessage(403, problem(texto)), /Ainda não está disponível/);
});
