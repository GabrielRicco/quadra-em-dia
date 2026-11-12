// Testes dos formatos brasileiros (js/formato.js). Rodar com: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lerValorEmReais,
  formatarReais,
  formatarNumero,
  formatarData,
  dataISO,
  iniciais,
} from '../js/formato.js';

test('lê valor digitado do jeito brasileiro', () => {
  assert.equal(lerValorEmReais('400'), 400);
  assert.equal(lerValorEmReais('400,50'), 400.5);
  assert.equal(lerValorEmReais('1.234,56'), 1234.56);
  assert.equal(lerValorEmReais('R$ 1.500'), 1500);
  assert.equal(lerValorEmReais('400.50'), 400.5); // ponto como decimal também vale
  assert.equal(lerValorEmReais('10,005'), 10.01); // arredonda para centavos
});

test('valor digitado inválido vira NaN (e a regra RN02 recusa)', () => {
  assert.ok(Number.isNaN(lerValorEmReais('')));
  assert.ok(Number.isNaN(lerValorEmReais('abc')));
  assert.ok(Number.isNaN(lerValorEmReais('-50')));
});

test('formata reais e datas sem mudar o dia por causa do fuso', () => {
  const espacoComum = (texto) => texto.replace(/\s/g, ' ');
  assert.equal(espacoComum(formatarReais(1234.5)), 'R$ 1.234,50');
  assert.equal(formatarNumero(400), '400,00');
  assert.equal(formatarData('2026-11-05'), '05/11/2026');
  assert.equal(dataISO(new Date(2026, 10, 12, 23, 30)), '2026-11-12');
});

test('iniciais do nome para o avatar', () => {
  assert.equal(iniciais('Ana Clara Souza'), 'AS');
  assert.equal(iniciais('  bia  '), 'B');
});
