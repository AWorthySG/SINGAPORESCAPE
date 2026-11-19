// Hitsplats show big hits short: 54,000 reads "54K", not a long row of digits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { damageNumber } from '../src/core/utils.js';

test('damage numbers: full under 1,000, then three figures and K, M or B', () => {
  assert.equal(damageNumber(0), '0');
  assert.equal(damageNumber(999), '999');
  assert.equal(damageNumber(1000), '1K');
  assert.equal(damageNumber(1234), '1.23K');
  assert.equal(damageNumber(54000), '54K');
  assert.equal(damageNumber(543210), '543K');
  assert.equal(damageNumber(999999), '1M', 'no "1000K"');
  assert.equal(damageNumber(1500000), '1.5M');
  assert.equal(damageNumber(2.5e9), '2.5B');
  assert.equal(damageNumber(-12345), '-12.3K');
  assert.equal(damageNumber(54000.4), '54K');
});
