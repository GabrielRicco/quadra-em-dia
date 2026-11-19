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
  traduzirErroBanco,
  ERRO_GENERICO,
  validarReducaoAulas,
  pacotesAcabando,
  filtrarPacotes,
  pacotesParaAgendar,
  aulasDoDia,
  resumoFinanceiro,
  recebidoPorMes,
  alunosParaRenovar,
  aulasPorSemana,
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

// Erros no formato que o Supabase (PostgREST) devolve quando o banco barra a operação
test('erro de check ou exclude do banco vira a mensagem exata do SPEC', () => {
  const check = (restricao, tabela) => ({
    code: '23514',
    message: `new row for relation "${tabela}" violates check constraint "${restricao}"`,
  });
  assert.equal(traduzirErroBanco(check('alunos_nome_tamanho', 'alunos')), MENSAGENS.nome);
  assert.equal(traduzirErroBanco(check('pacotes_quantidade_valor', 'pacotes')), MENSAGENS.pacote);
  assert.equal(traduzirErroBanco(check('pacotes_pago_consistente', 'pacotes')), MENSAGENS.pagamento);
  assert.equal(
    traduzirErroBanco({
      code: '23P01',
      message: 'conflicting key value violates exclusion constraint "aulas_sem_sobreposicao"',
    }),
    MENSAGENS.conflito,
  );
});

test('mensagem levantada por trigger passa direto; erro desconhecido não mostra detalhe técnico', () => {
  assert.equal(traduzirErroBanco({ code: 'P0001', message: MENSAGENS.semSaldo }), MENSAGENS.semSaldo);
  assert.equal(traduzirErroBanco({ code: 'P0001', message: MENSAGENS.excluirAluno }), MENSAGENS.excluirAluno);
  assert.equal(traduzirErroBanco({ code: 'XX000', message: 'internal error at line 42' }), ERRO_GENERICO);
  assert.equal(traduzirErroBanco(undefined), ERRO_GENERICO);
});

test('pacote não pode ficar com menos aulas do que as já usadas', () => {
  assert.equal(validarReducaoAulas(4, 5), 'O pacote já tem 5 aulas usadas.');
  assert.equal(validarReducaoAulas(5, 5), null);
  assert.equal(traduzirErroBanco({ code: 'P0001', message: 'O pacote já tem 5 aulas usadas.' }), 'O pacote já tem 5 aulas usadas.');
});

// Pacotes como vêm da view pacotes_com_saldo
const pacote = (id, aluno_id, aluno_nome, saldo, pago) => ({ id, aluno_id, aluno_nome, saldo, pago });

test('CA07 · "saldo acabando" mostra saldo 2 ou menos, mas não aluno que já renovou', () => {
  const pacotes = [
    pacote('p1', 'ana', 'Ana', 2, true),     // acabando
    pacote('p2', 'bruno', 'Bruno', 0, true), // acabou, mas o Bruno já comprou outro...
    pacote('p3', 'bruno', 'Bruno', 8, false), // ...com saldo
    pacote('p4', 'caio', 'Caio', 3, true),   // ainda tem saldo
  ];
  assert.deepEqual(pacotesAcabando(pacotes).map((p) => p.id), ['p1']);
  assert.deepEqual(filtrarPacotes(pacotes, { filtro: 'acabando' }).map((p) => p.id), ['p1']);
});

test('RF07 · busca pelo nome ignora acento e maiúscula; filtros pago e em aberto', () => {
  const pacotes = [
    pacote('p1', 'joao', 'João Pedro', 5, true),
    pacote('p2', 'ana', 'Ana', 5, false),
  ];
  assert.deepEqual(filtrarPacotes(pacotes, { busca: 'JOAO' }).map((p) => p.id), ['p1']);
  assert.deepEqual(filtrarPacotes(pacotes, { filtro: 'pagos' }).map((p) => p.id), ['p1']);
  assert.deepEqual(filtrarPacotes(pacotes, { filtro: 'abertos' }).map((p) => p.id), ['p2']);
  assert.equal(filtrarPacotes(pacotes).length, 2);
});

test('CA08 · a agenda mostra só as aulas do dia, em ordem de horário', () => {
  const aula = (id, d, h) => ({ id, inicio: new Date(2026, 10, d, h).toISOString() });
  const aulas = [aula('tarde', 19, 15), aula('amanha', 20, 8), aula('manha', 19, 7), aula('ontem', 18, 22)];
  assert.deepEqual(aulasDoDia(aulas, '2026-11-19').map((a) => a.id), ['manha', 'tarde']);
});

test('agendar aula só em pacote com saldo de aluno ativo', () => {
  const alunos = [{ id: 'ana', ativo: true }, { id: 'bia', ativo: false }];
  const pacotes = [
    { id: 'p1', aluno_id: 'ana', saldo: 3 },
    { id: 'p2', aluno_id: 'ana', saldo: 0 }, // acabou
    { id: 'p3', aluno_id: 'bia', saldo: 5 }, // aluna inativa
  ];
  assert.deepEqual(pacotesParaAgendar(pacotes, alunos).map((p) => p.id), ['p1']);
});

// ---------- Resumo (RF08) ----------
const pago = (valor, pago_em) => ({ valor, pago: true, pago_em });
const aberto = (valor) => ({ valor, pago: false, pago_em: null });

test('RF08 · recebido no mês (pela data do Pix) e total a receber', () => {
  const pacotes = [pago(400, '2026-11-05'), pago(300, '2026-10-20'), aberto(500), aberto(250.5), pago(0.1, '2026-11-18'), pago(0.2, '2026-11-19')];
  assert.deepEqual(resumoFinanceiro(pacotes, '2026-11-19'), {
    recebidoNoMes: 400.3, // soma em centavos: 0,1 + 0,2 não vira 0,30000000000000004
    pagosNoMes: 3,
    aReceber: 750.5,
    emAberto: 2,
  });
});

test('RF08 · recebido por mês nos últimos meses, com zero nos meses sem pagamento', () => {
  const pacotes = [pago(400, '2026-11-05'), pago(300, '2026-09-20'), pago(200, '2026-09-01'), pago(999, '2026-05-30')];
  assert.deepEqual(recebidoPorMes(pacotes, '2026-11-19', 3), [
    { mes: '2026-09', total: 500 },
    { mes: '2026-10', total: 0 },
    { mes: '2026-11', total: 400 },
  ]);
  assert.equal(recebidoPorMes([], '2026-01-10', 2)[0].mes, '2025-12'); // vira o ano
});

test('RF08 e CA07 · quem precisa renovar: um por aluno ativo, menor saldo primeiro', () => {
  const alunos = [{ id: 'ana', ativo: true }, { id: 'bia', ativo: true }, { id: 'caio', ativo: false }];
  const pacotes = [
    { id: 'p1', aluno_id: 'ana', aluno_nome: 'Ana', saldo: 2, inicio: '2026-10-01' }, // CA07
    { id: 'p2', aluno_id: 'bia', aluno_nome: 'Bia', saldo: 0, inicio: '2026-09-01' },
    { id: 'p3', aluno_id: 'bia', aluno_nome: 'Bia', saldo: 1, inicio: '2026-11-01' }, // o mais recente da Bia
    { id: 'p4', aluno_id: 'caio', aluno_nome: 'Caio', saldo: 1, inicio: '2026-11-01' }, // inativo
  ];
  assert.deepEqual(alunosParaRenovar(pacotes, alunos).map((p) => p.id), ['p3', 'p1']);
});

test('aulas dadas e faltas por semana (segunda a domingo); cancelada e agendada não contam', () => {
  const aula = (d, status) => ({ inicio: new Date(2026, 10, d, 9).toISOString(), status });
  const aulas = [aula(16, 'dada'), aula(19, 'dada'), aula(22, 'falta'), aula(20, 'cancelada'), aula(12, 'dada'), aula(25, 'agendada')];
  assert.deepEqual(aulasPorSemana(aulas, '2026-11-19', 2), [
    { semana: '2026-11-09', dadas: 1, faltas: 0 },
    { semana: '2026-11-16', dadas: 2, faltas: 1 },
  ]);
});
