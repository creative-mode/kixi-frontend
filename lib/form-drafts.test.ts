// Rascunhos de formulários em sessionStorage (#503): node --test lib/form-drafts.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearFormDraft,
  clearStaleFormDrafts,
  DRAFT_TTL_MS,
  formDraftKey,
  loadChangedFormDraft,
  loadFormDraft,
  sanitizeDraft,
  saveChangedFormDraft,
  saveFormDraft,
  type DraftStorage,
} from './form-drafts.ts';

class MemoryStorage implements DraftStorage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
  key(index: number) { return [...this.map.keys()][index] ?? null; }
  keys() { return [...this.map.keys()]; }
}

test('guarda e recupera o rascunho do mesmo utilizador', () => {
  const storage = new MemoryStorage();
  assert.equal(saveFormDraft(storage, 'room:new', { classId: '12A', duration: 90 }, 7, 1000), true);
  assert.deepEqual(loadFormDraft(storage, 'room:new', 7, 1000), { classId: '12A', duration: 90 });
});

test('não restaura o rascunho de outro utilizador', () => {
  const storage = new MemoryStorage();
  saveFormDraft(storage, 'crud:classes:new', { name: 'Turma A' }, 7, 1000);
  assert.equal(loadFormDraft(storage, 'crud:classes:new', 8, 1000), null);
  assert.deepEqual(storage.keys(), [], 'o rascunho alheio é apagado');
});

test('não restaura um rascunho expirado', () => {
  const storage = new MemoryStorage();
  saveFormDraft(storage, 'room:new', { classId: '12A' }, 7, 1000);
  assert.equal(loadFormDraft(storage, 'room:new', 7, 1000 + DRAFT_TTL_MS + 1), null);
  assert.deepEqual(storage.keys(), []);
});

test('campos sensíveis e dados não serializáveis ficam de fora', () => {
  const limpo = sanitizeDraft({
    username: 'professor',
    password: 'segredo',
    passwordConfirm: 'segredo',
    passingScore: 70,
    passMark: 50,
    compass: 'direção',
    authToken: 'abc',
    api_key: 'xyz',
    nested: { senha: '123', turma: '12A' },
    notas: [1, 2, null, undefined],
  });
  assert.deepEqual(limpo, {
    username: 'professor',
    passingScore: 70,
    passMark: 50,
    compass: 'direção',
    nested: { turma: '12A' },
    notas: [1, 2, null],
  });
});

test('não grava formulário intocado e descarta rascunho quando o registo mudou', () => {
  const storage = new MemoryStorage();
  const original = { name: 'Turma A', passingScore: 70 };
  assert.equal(saveChangedFormDraft(storage, 'crud:classes:5', original, original, 7, 1000), false);
  assert.equal(loadFormDraft(storage, 'crud:classes:5', 7, 1000), null);

  assert.equal(saveChangedFormDraft(storage, 'crud:classes:5', { ...original, name: 'Rascunho' }, original, 7, 1000), true);
  assert.deepEqual(loadChangedFormDraft(storage, 'crud:classes:5', 7, original, 1000), { ...original, name: 'Rascunho' });
  assert.equal(loadChangedFormDraft(storage, 'crud:classes:5', 7, { ...original, name: 'Alterada por outra pessoa' }, 1000), null);
  assert.equal(storage.getItem(formDraftKey('crud:classes:5')), null);
});

test('limpa o rascunho depois de concluir', () => {
  const storage = new MemoryStorage();
  saveFormDraft(storage, 'room:new', { classId: '12A' }, 7, 1000);
  clearFormDraft(storage, 'room:new');
  assert.equal(loadFormDraft(storage, 'room:new', 7, 1000), null);
});

test('limpa rascunhos antigos ou corrompidos de uma vez', () => {
  const storage = new MemoryStorage();
  const agora = 1000 + DRAFT_TTL_MS + 2;
  saveFormDraft(storage, 'velho', { x: 1 }, 7, 1000);
  saveFormDraft(storage, 'novo', { x: 2 }, 7, agora);
  storage.setItem(formDraftKey('corrompido'), '{não é json');
  storage.setItem('outra:coisa', 'fica');
  clearStaleFormDrafts(storage, agora);
  assert.deepEqual(loadFormDraft(storage, 'velho', 7, agora), null);
  assert.deepEqual(loadFormDraft(storage, 'novo', 7, agora), { x: 2 });
  assert.equal(storage.getItem(formDraftKey('corrompido')), null);
  assert.equal(storage.getItem('outra:coisa'), 'fica');
});

test('ids estranhos não escrevem chaves arbitrárias', () => {
  const storage = new MemoryStorage();
  assert.equal(saveFormDraft(storage, '../outro', { x: 1 }, 7), false);
  assert.equal(saveFormDraft(storage, 'tem espaço', { x: 1 }, 7), false);
  assert.deepEqual(storage.keys(), []);
});

test('um armazenamento cheio não lança', () => {
  const storage: DraftStorage = {
    getItem: () => null,
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: () => {},
  };
  assert.equal(saveFormDraft(storage, 'room:new', { x: 1 }, 7), false);
});
