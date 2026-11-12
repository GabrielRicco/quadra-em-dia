// Regras de negócio do Quadra em Dia (ver SPEC.md, seção 6).
// Funções puras: sem DOM e sem rede, para serem testadas com `npm test`.
// Cada validação devolve a mensagem de erro exata do SPEC, ou null se está tudo certo.
// O banco (sql/schema.sql) repete as mesmas regras: a tela avisa, o banco garante.

export const MENSAGENS = {
  nome: 'O nome precisa ter entre 2 e 80 caracteres.',
  pacote: 'O pacote precisa ter de 1 a 50 aulas e valor entre R$ 0,01 e R$ 10.000,00.',
  conflito: 'Já existe uma aula neste horário.',
  semSaldo: 'Este pacote não tem mais aulas. Crie um novo pacote para o aluno.',
  pagamento: 'Informe a data do pagamento (não pode ser no futuro).',
  excluirAluno: 'Este aluno tem pacote não pago. Marque como inativo em vez de excluir.',
};

const STATUS_QUE_CONSOMEM = ['dada', 'falta'];
export const LIMITE_SALDO_ACABANDO = 2;

// RN01
export function validarAluno({ nome }) {
  const tamanho = (nome ?? '').trim().length;
  if (tamanho < 2 || tamanho > 80) return MENSAGENS.nome;
  return null;
}

// RN02
export function validarPacote({ quantidade_aulas, valor }) {
  const qtd = Number(quantidade_aulas);
  const v = Number(valor);
  const qtdOk = Number.isInteger(qtd) && qtd >= 1 && qtd <= 50;
  const valorOk = Number.isFinite(v) && v > 0 && v <= 10000;
  return qtdOk && valorOk ? null : MENSAGENS.pacote;
}

// RN05 · datas no formato 'AAAA-MM-DD'; hoje é recebido para o teste não depender do relógio
export function validarPagamento({ pago, pago_em }, hoje) {
  if (!pago) return null;
  if (!pago_em || pago_em > hoje) return MENSAGENS.pagamento;
  return null;
}

// RN03 · intervalos [inicio, fim): uma aula que termina às 9h não conflita com outra que começa às 9h
export function horariosSobrepostos(a, b) {
  return new Date(a.inicio) < new Date(b.fim) && new Date(b.inicio) < new Date(a.fim);
}

export function validarConflito(novaAula, aulasExistentes) {
  if (novaAula.status === 'cancelada') return null;
  const conflita = aulasExistentes.some(
    (aula) =>
      aula.id !== novaAula.id &&
      aula.status !== 'cancelada' &&
      horariosSobrepostos(novaAula, aula),
  );
  return conflita ? MENSAGENS.conflito : null;
}

export function calcularFim(inicio, duracaoMin) {
  return new Date(new Date(inicio).getTime() + duracaoMin * 60_000).toISOString();
}

// Saldo = contratadas - (dadas + faltas). Cancelada não consome.
export function calcularSaldo(quantidadeAulas, aulasDoPacote) {
  const usadas = aulasDoPacote.filter((a) => STATUS_QUE_CONSOMEM.includes(a.status)).length;
  return quantidadeAulas - usadas;
}

// RN04 · só precisa checar saldo quando a aula PASSA a consumir
export function validarUsoDeAula(statusAnterior, statusNovo, saldoAtual) {
  const passaAConsumir =
    STATUS_QUE_CONSOMEM.includes(statusNovo) && !STATUS_QUE_CONSOMEM.includes(statusAnterior);
  if (passaAConsumir && saldoAtual <= 0) return MENSAGENS.semSaldo;
  return null;
}

// RN06
export function validarExclusaoAluno(pacotesDoAluno) {
  return pacotesDoAluno.some((p) => !p.pago) ? MENSAGENS.excluirAluno : null;
}

export function saldoAcabando(saldo) {
  return saldo <= LIMITE_SALDO_ACABANDO;
}
