import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mobileNavItems, type ShellNavItem } from './shell-nav.ts';

const items: ShellNavItem[] = [
  { href: '/inicio', label: 'Início', icon: 'home', also: [] },
  { href: '/provas', label: 'Provas', icon: 'file', also: ['/prova'] },
  { href: '/ranking', label: 'Ranking', icon: 'trophy', also: [] },
  { href: '/pautas', label: 'Pautas', icon: 'award', also: [], mobileHidden: true },
  { href: '/tutor', label: 'Tutor', icon: 'chat', also: [] },
  { href: '/pesquisa', label: 'Pesquisar', icon: 'search', also: [], desktopOnly: true },
];

test('a barra do telemóvel tem 4 itens, numa linha, sem Pautas nem Pesquisa (#704)', () => {
  const mobile = mobileNavItems(items);
  assert.equal(mobile.length, 4);
  assert.deepEqual(mobile.map((i) => i.label), ['Início', 'Provas', 'Ranking', 'Tutor']);
});

test('o desktop continua a ver todos os itens, incluindo Pautas', () => {
  // A barra lateral não filtra nada: o `desktopOnly` é do telemóvel, e a Pautas
  // só sai da barra inferior.
  assert.equal(items.filter((i) => !i.desktopOnly).length, 5);
  assert.ok(items.some((i) => i.href === '/pautas'));
});

test('sem itens escondidos a barra mantém a ordem original', () => {
  const plain = items.filter((i) => !i.desktopOnly && !i.mobileHidden);
  assert.deepEqual(mobileNavItems(plain), plain);
});
