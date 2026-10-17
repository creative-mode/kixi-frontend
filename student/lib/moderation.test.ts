import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REPORT_REASON_KEYS,
  bloqueadoEntre,
  blockPair,
  decisaoValida,
  deveDesaparecer,
  desaparecePara,
  exigeNota,
  isReportReason,
  notaValida,
  precisaDecisao,
  validateReport,
  visibilidadePara,
} from './moderation.ts';

// O critério de aceitação da #323 é «perfil ocultado devolve 404 a terceiros» e
// «registo de auditoria das decisões». Estas funções são onde isso se decide, e
// antes delas não havia regra nenhuma — os relatórios de publicações eram
// descartados e não existia auditoria.

test('a lista de motivos é fixa e fechada', () => {
  assert.deepEqual(REPORT_REASON_KEYS, ['IMPERSONATION', 'FAKE_SCHOOL', 'OFFENSIVE_NAME', 'OFFENSIVE_PHOTO', 'MISLEADING_CONTENT', 'BLOCK', 'OTHER']);
  assert.ok(isReportReason('IMPERSONATION'));
  // Qualquer outra coisa nao e um motivo: sem isto, um `reason` vindo do
  // formulario entrava na fila sem categoria.
  assert.ok(!isReportReason('qualquer-coisa'));
  assert.ok(!isReportReason(''));
  assert.ok(!isReportReason(null));
  assert.ok(!isReportReason(42));
});

test('a nota so e obrigatoria quando o motivo e «Outro»', () => {
  assert.ok(exigeNota('OTHER'));
  for (const r of REPORT_REASON_KEYS.filter((k) => k !== 'OTHER')) {
    assert.ok(!exigeNota(r), `${r} nao devia exigir nota`);
    assert.ok(notaValida(r, ''), `${r} devia aceitar nota vazia`);
    assert.ok(notaValida(r, 'um contexto útil'));
  }
  assert.ok(!notaValida('OTHER', '   '), '«Outro» sem texto nao devia passar');
  assert.ok(notaValida('OTHER', 'porque sim'));
  assert.ok(!notaValida('IMPERSONATION', 'x'.repeat(501)), 'nota acima do limite');
});

test('uma denuncia bem formada passa e devolve o motivo limpo', () => {
  const r = validateReport({ target: 'ACCOUNT', reason: 'IMPERSONATION', note: '  diz-sefootball  ', reporterId: 5, targetId: 7 });
  assert.deepEqual(r, { ok: true, reason: 'IMPERSONATION', note: 'diz-sefootball' });
});

test('cadavalidate devolve o erro certo, nao um generico', () => {
  // Sem sessao
  assert.equal(validateReport({ target: 'ACCOUNT', reason: 'OTHER', note: 'x', reporterId: null, targetId: 1 }).ok, false);
  // Alvo invalido
  assert.equal(validateReport({ target: 'ACCOUNT', reason: 'OTHER', note: 'x', reporterId: 1, targetId: 0 }).ok, false);
  assert.equal(validateReport({ target: 'ACCOUNT', reason: 'OTHER', note: 'x', reporterId: 1, targetId: 1.5 }).ok, false);
  // Alvo que nao existe
  assert.equal(validateReport({ target: 'OUTRO' as never, reason: 'OTHER', note: 'x', reporterId: 1, targetId: 1 }).ok, false);
  // Motivo em falta
  assert.equal(validateReport({ target: 'ACCOUNT', reason: 'nao-existe', note: '', reporterId: 1, targetId: 1 }).ok, false);
  // Nota exigida e nao dada: a mensagem tem de dizer para escrever
  const semNota = validateReport({ target: 'ACCOUNT', reason: 'OTHER', note: '   ', reporterId: 1, targetId: 1 });
  assert.equal(semNota.ok, false);
  assert.match((semNota as { error: string }).error, /Escreve o motivo/);
  // Nota longa demais
  const longa = validateReport({ target: 'ACCOUNT', reason: 'OFFENSIVE_NAME', note: 'x'.repeat(600), reporterId: 1, targetId: 1 });
  assert.match((longa as { error: string }).error, /demasiado longa/);
});

test('bloquear e o unico motivo que nao espera decisao', () => {
  assert.ok(!precisaDecisao('BLOCK'));
  for (const r of REPORT_REASON_KEYS.filter((k) => k !== 'BLOCK')) {
    assert.ok(precisaDecisao(r), `${r} devia ir para a fila`);
  }
});

test('o bloqueio e mutuo e em qualquer dos sentidos', () => {
  const b = [{ accountId: 3, blockedAccountId: 9 }];
  assert.ok(bloqueadoEntre(b, 3, 9));
  assert.ok(bloqueadoEntre(b, 9, 3), 'o bloqueio tem de valer nos dois sentidos');
  assert.ok(!bloqueadoEntre(b, 3, 4));
  assert.ok(!bloqueadoEntre([], 3, 9));
});

test('o par do bloqueio e normalizado e nunca guarda duplicado', () => {
  assert.deepEqual(blockPair(9, 3), { accountId: 3, blockedAccountId: 9 });
  assert.deepEqual(blockPair(3, 9), { accountId: 3, blockedAccountId: 9 }, 'o mesmo bloqueio em ordem inversa tem de dar o mesmo par');
  // Bloquear-se a si nao e um bloqueio; guardar dava um registo que nunca pode
  // ser desfeito porque o «outro» e tu proprio.
  assert.equal(blockPair(4, 4), null);
  assert.equal(blockPair(0, 4), null);
  assert.equal(blockPair(1.5, 4), null);
});

test('uma escola pode ocultar-se mas nao suspender-se', () => {
  assert.ok(decisaoValida('INSTITUTION', 'IGNORED'));
  assert.ok(decisaoValida('INSTITUTION', 'HIDDEN'));
  // Uma conta suspensa continua a existir e a poder ser usada; uma escola suspensa
  // nao tem sentido — nao ha sessao para suspender.
  assert.ok(!decisaoValida('INSTITUTION', 'SUSPENDED'));
  for (const d of ['IGNORED', 'HIDDEN', 'SUSPENDED']) {
    assert.ok(decisaoValida('ACCOUNT', d), `${d} devia valer para uma conta`);
  }
  assert.ok(!decisaoValida('ACCOUNT', 'APAGAR'));
  assert.ok(!decisaoValida('ACCOUNT', null));
});

test('ocultado ou suspenso desaparece para terceiros — o criterio da issue', () => {
  assert.ok(deveDesaparecer({ hidden: true }));
  assert.ok(deveDesaparecer({ suspended: true }));
  assert.ok(!deveDesaparecer({ hidden: false, suspended: false }));
  assert.ok(!deveDesaparecer({ hidden: false, suspended: null }));
});

test('bloqueado desaparece por completo, nao fica so em «privado»', () => {
  // A issue diz que bloquear «deixa de ver e ser visto». `private` é o que devolve um
  // perfil «só com o nome e a foto» — o nome e a foto continuam a ver-se, portanto o
  // bloqueio não bloqueia nada de útil. Tem de dar 404, como o ocultado.
  assert.ok(desaparecePara({ mine: false, bloqueado: true, oculto: false }));
  assert.ok(desaparecePara({ mine: false, bloqueado: false, oculto: true }));
  assert.ok(!desaparecePara({ mine: false, bloqueado: false, oculto: false }));
  // A si próprio continua visível: denunciar-se a si por engano não pode fazer o aluno
  // desaparecer do próprio perfil.
  assert.ok(!desaparecePara({ mine: true, bloqueado: true, oculto: true }));
});

test('sem nada que esconda, manda a visibilidade que o proprio escolheu', () => {
  assert.equal(visibilidadePara({ targetOwnVisibility: 'school', mine: false, bloqueado: false, desaparece: false }), 'school');
  assert.equal(visibilidadePara({ targetOwnVisibility: 'public', mine: true, bloqueado: true, desaparece: true }), 'public');
  assert.equal(visibilidadePara({ targetOwnVisibility: 'public', mine: false, bloqueado: true, desaparece: false }), 'private');
});
