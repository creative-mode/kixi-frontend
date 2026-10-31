// Atalhos das filas de revisão (#535): node --test lib/queue-shortcuts.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { shortcutKey, type KeyContext, type KeyLike } from './queue-shortcuts.ts';

const TECLAS = ['j', 'k', 'a', 'r'] as const;
const livre: KeyContext = { editable: false, dialogOpen: false };
const tecla = (key: string, patch: Partial<KeyLike> = {}): KeyLike => ({
  key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, isComposing: false, repeat: false, defaultPrevented: false, ...patch,
});

test('uma tecla do conjunto, sem mais nada, é atalho', () => {
  for (const key of TECLAS) assert.equal(shortcutKey(tecla(key), livre, TECLAS), key);
});

test('maiúsculas (Caps Lock) valem como minúsculas', () => {
  assert.equal(shortcutKey(tecla('J'), livre, TECLAS), 'j');
  assert.equal(shortcutKey(tecla('A'), livre, TECLAS), 'a');
});

test('no meio de um campo de texto nunca há atalho, para não engolir o que se escreve', () => {
  const emCampo: KeyContext = { editable: true, dialogOpen: false };
  for (const key of TECLAS) assert.equal(shortcutKey(tecla(key), emCampo, TECLAS), null);
});

test('com um diálogo aberto os atalhos calam-se', () => {
  assert.equal(shortcutKey(tecla('a'), { editable: false, dialogOpen: true }, TECLAS), null);
});

test('com Ctrl, Cmd ou Alt a tecla é do browser (Ctrl+R recarrega, Ctrl+A seleciona)', () => {
  assert.equal(shortcutKey(tecla('r', { ctrlKey: true }), livre, TECLAS), null);
  assert.equal(shortcutKey(tecla('a', { metaKey: true }), livre, TECLAS), null);
  assert.equal(shortcutKey(tecla('j', { altKey: true }), livre, TECLAS), null);
  assert.equal(shortcutKey(tecla('j', { shiftKey: true }), livre, TECLAS), null);
});

test('durante uma composição (IME) não se mexe', () => {
  assert.equal(shortcutKey(tecla('a', { isComposing: true }), livre, TECLAS), null);
});

test('um evento que outro já tratou não se trata duas vezes', () => {
  assert.equal(shortcutKey(tecla('j', { defaultPrevented: true }), livre, TECLAS), null);
});

test('manter premido repete só o andar pela lista, nunca aprovar nem recusar', () => {
  assert.equal(shortcutKey(tecla('j', { repeat: true }), livre, TECLAS), 'j');
  assert.equal(shortcutKey(tecla('k', { repeat: true }), livre, TECLAS), 'k');
  assert.equal(shortcutKey(tecla('a', { repeat: true }), livre, TECLAS), null);
  assert.equal(shortcutKey(tecla('r', { repeat: true }), livre, TECLAS), null);
});

test('uma tecla fora do conjunto da página não faz nada', () => {
  assert.equal(shortcutKey(tecla('x'), livre, TECLAS), null);
  assert.equal(shortcutKey(tecla('a'), livre, ['j', 'k']), null);
  assert.equal(shortcutKey(tecla('Enter'), livre, TECLAS), null);
});
