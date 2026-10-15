import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canOpenInBuilder, canReview, donationParam, fileSize, isDonationStatus, isId, pageCount } from './model.ts';

test('só os quatro estados do backend são estados', () => {
  for (const status of ['pending', 'approved', 'rejected', 'converted']) assert.ok(isDonationStatus(status));
  assert.ok(!isDonationStatus('approvedd'));
  assert.ok(!isDonationStatus(undefined));
});

test('uma doação convertida não se revê e uma rejeitada não vai para o construtor', () => {
  assert.equal(canReview('converted'), false);
  assert.equal(canReview('rejected'), true);
  assert.equal(canOpenInBuilder('pending'), true);
  assert.equal(canOpenInBuilder('approved'), true);
  assert.equal(canOpenInBuilder('rejected'), false);
  assert.equal(canOpenInBuilder('converted'), false);
});

test('o parâmetro ?donation= só aceita dígitos', () => {
  assert.equal(donationParam('12'), 12);
  assert.equal(donationParam('0'), null);
  assert.equal(donationParam('12/../x'), null);
  assert.equal(donationParam('1e3'), null);
  assert.equal(donationParam(['1']), null);
  assert.equal(donationParam(undefined), null);
});

test('ids, páginas e tamanhos', () => {
  assert.ok(isId(3));
  assert.ok(!isId(0) && !isId(1.5) && !isId('3'));
  assert.equal(pageCount(0), 1);
  assert.equal(pageCount(41), 3);
  assert.equal(fileSize(2048), '2 KB');
  assert.equal(fileSize(3 * 1024 * 1024), '3,0 MB');
});
