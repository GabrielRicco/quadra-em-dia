// Testes das regras de negócio (SPEC.md, seções 6 e 7). Rodar com: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MENSAGENS,
  validarAluno,
  validarPacote,
  validarPagamento,
  validarConflito,
  calcularFim,
  calcularSaldo,
  validarUsoDeAula,
  validarExclusaoAluno,
  saldoAcabando,
} from '../js/regras.js';

test('CA01 · nome com 1 letra é recusado; 2 a 80 é aceito', () => {
  assert.equal(validarAluno({ nome: 'A' }), MENSAGENS.nome);
  assert.equal(validarAluno({ nome: '   ' }), MENSAGENS.nome);
  assert.equal(validarAluno({ nome: 'x'.repeat(81) }), MENSAGENS.nome);
  assert.equal(validarAluno({ nome: 'Ana' }), null);
});

test('CA02 · pacote fora de 1 a 50 aulas ou com valor inválido é recusado', () => {
  assert.equal(validarPacote({ quantidade_aulas: 0, valor: 400 }), MENSAGENS.pacote);
  assert.equal(validarPacote({ quantidade_aulas: 60, valor: 400 }), MENSAGENS.pacote);
  assert.equal(validarPacote({ quantidade_aulas: 8, valor: 0 }), MENSAGENS.pacote);
  assert.equal(validarPacote({ quantidade_aulas: 8, valor: 10000.01 }), MENSAGENS.pacote);
  assert.equal(validarPacote({ quantidade_aulas: 8, valor: 400 }), null);
});

test('CA03 · aula sobreposta é recusada; encostada ou cancelada é aceita', () => {
  const existente = { id: '1', inicio: '2026-11-13T08:30:00-03:00', fim: '2026-11-13T09:30:00-03:00', status: 'agendada' };
  const sobreposta = { inicio: '2026-11-13T09:00:00-03:00', fim: '2026-11-13T10:00:00-03:00', status: 'agendada' };
  const encostada = { inicio: '2026-11-13T09:30:00-03:00', fim: '2026-11-13T10:30:00-03:00', status: 'agendada' };

  assert.equal(validarConflito(sobreposta, [existente]), MENSAGENS.conflito);
  assert.equal(validarConflito(encostada, [existente]), null);
  assert.equal(validarConflito(sobreposta, [{ ...existente, status: 'cancelada' }]), null);
});

test('CA03 · editar a própria aula não conflita com ela mesma', () => {
  const aula = { id: '1', inicio: '2026-11-13T08:30:00-03:00', fim: '2026-11-13T09:30:00-03:00', status: 'agendada' };
  assert.equal(validarConflito(aula, [aula]), null);
});

test('calcularFim soma a duração em minutos', () => {
  assert.equal(calcularFim('2026-11-13T11:00:00.000Z', 60), '2026-11-13T12:00:00.000Z');
});

test('CA07 · saldo: 8 aulas, 6 consumidas e 1 cancelada deixa 2 e marca "acabando"', () => {
  const aulas = [
    ...Array(5).fill({ status: 'dada' }),
    { status: 'falta' },
    { status: 'cancelada' },
    { status: 'agendada' },
  ];
  const saldo = calcularSaldo(8, aulas);
  assert.equal(saldo, 2);
  assert.equal(saldoAcabando(saldo), true);
  assert.equal(saldoAcabando(3), false);
});

test('CA04 · não marca aula como dada em pacote sem saldo', () => {
  assert.equal(validarUsoDeAula('agendada', 'dada', 0), MENSAGENS.semSaldo);
  assert.equal(validarUsoDeAula('agendada', 'falta', 0), MENSAGENS.semSaldo);
  assert.equal(validarUsoDeAula('agendada', 'dada', 1), null);
  // trocar de "dada" para "falta" não consome uma aula a mais
  assert.equal(validarUsoDeAula('dada', 'falta', 0), null);
  // cancelar sempre pode
  assert.equal(validarUsoDeAula('agendada', 'cancelada', 0), null);
});

test('CA05 · pagamento sem data ou com data futura é recusado', () => {
  const hoje = '2026-11-12';
  assert.equal(validarPagamento({ pago: true, pago_em: null }, hoje), MENSAGENS.pagamento);
  assert.equal(validarPagamento({ pago: true, pago_em: '2026-11-13' }, hoje), MENSAGENS.pagamento);
  assert.equal(validarPagamento({ pago: true, pago_em: '2026-11-12' }, hoje), null);
  assert.equal(validarPagamento({ pago: false, pago_em: null }, hoje), null);
});

test('CA06 · não exclui aluno com pacote não pago', () => {
  assert.equal(validarExclusaoAluno([{ pago: true }, { pago: false }]), MENSAGENS.excluirAluno);
  assert.equal(validarExclusaoAluno([{ pago: true }]), null);
  assert.equal(validarExclusaoAluno([]), null);
});
