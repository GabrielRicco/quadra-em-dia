// Regras de negócio do Quadra em Dia (ver SPEC.md, seção 6).
// Funções puras: sem DOM e sem rede, para serem testadas com `npm test`.
// Cada validação devolve a mensagem de erro exata do SPEC, ou null se está tudo certo.
// O banco (sql/schema.sql) repete as mesmas regras: a tela avisa, o banco garante.
import { normalizarTexto, limitesDoDia } from './formato.js';

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

// CA08 · a agenda mostra só as aulas do dia ('AAAA-MM-DD', fuso do aparelho), em ordem de horário
export function aulasDoDia(aulas, data) {
  const { de, ate } = limitesDoDia(data);
  const [inicioDia, fimDia] = [new Date(de), new Date(ate)];
  return aulas
    .filter((a) => new Date(a.inicio) >= inicioDia && new Date(a.inicio) < fimDia)
    .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
}

// Agendar aula: só em pacote com saldo, de aluno ativo
export function pacotesParaAgendar(pacotes, alunos) {
  const ativos = new Set(alunos.filter((a) => a.ativo).map((a) => a.id));
  return pacotes.filter((p) => ativos.has(p.aluno_id) && p.saldo > 0);
}

// Complemento da RN02: o pacote não pode ficar com menos aulas do que as já usadas
// (o trigger validar_pacote do banco levanta a mesma mensagem)
export function validarReducaoAulas(quantidadeNova, usadas) {
  return quantidadeNova < usadas ? `O pacote já tem ${usadas} aulas usadas.` : null;
}

// CA07 e RF08 · pacotes com saldo acabando. Aluno que já comprou outro pacote
// com saldo sobrando não aparece: o pacote antigo dele já foi renovado.
export function pacotesAcabando(pacotes) {
  const renovaram = new Set(
    pacotes.filter((p) => !saldoAcabando(p.saldo)).map((p) => p.aluno_id),
  );
  return pacotes.filter((p) => saldoAcabando(p.saldo) && !renovaram.has(p.aluno_id));
}

// RF07 · busca pelo nome do aluno (sem diferença de acento e maiúscula) e filtro
export function filtrarPacotes(pacotes, { busca = '', filtro = 'todos' } = {}) {
  const termo = normalizarTexto(busca);
  const acabando = new Set(pacotesAcabando(pacotes));
  return pacotes.filter((p) => {
    if (termo && !normalizarTexto(p.aluno_nome).includes(termo)) return false;
    if (filtro === 'abertos') return !p.pago;
    if (filtro === 'pagos') return p.pago;
    if (filtro === 'acabando') return acabando.has(p);
    return true;
  });
}

// ---------- Erros do banco → mensagens do SPEC ----------
// Os triggers já levantam a mensagem exata. Os checks e o exclude chegam com o
// nome da restrição, que trocamos pela mensagem do critério de aceitação.
const MENSAGEM_POR_RESTRICAO = {
  alunos_nome_tamanho: MENSAGENS.nome,
  alunos_telefone_tamanho: 'O telefone pode ter no máximo 20 caracteres.',
  alunos_observacoes_tamanho: 'As observações podem ter no máximo 500 caracteres.',
  pacotes_quantidade_valor: MENSAGENS.pacote,
  pacotes_pago_consistente: MENSAGENS.pagamento,
  aulas_sem_sobreposicao: MENSAGENS.conflito,
  aulas_duracao: 'A aula precisa durar de 15 a 240 minutos.',
};

export const ERRO_GENERICO = 'Algo deu errado ao falar com o servidor. Tente de novo em instantes.';

export function traduzirErroBanco(erro) {
  const texto = erro?.message ?? '';
  if (Object.values(MENSAGENS).includes(texto) || texto.startsWith('O pacote já tem ')) return texto;

  const restricao = Object.keys(MENSAGEM_POR_RESTRICAO).find((nome) => texto.includes(`"${nome}"`));
  if (restricao) return MENSAGEM_POR_RESTRICAO[restricao];

  if (erro?.code === '42501') return 'Você não tem permissão para isso. Saia e entre de novo.';
  if (/failed to fetch|network/i.test(texto)) {
    return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  }
  return ERRO_GENERICO; // nunca mostra o texto técnico do banco para o usuário
}
