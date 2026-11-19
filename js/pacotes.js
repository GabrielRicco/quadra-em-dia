// Aba Pacotes · RF03 (criar, listar, editar, excluir), RF06 (marcar pago) e RF07 (busca e filtros).
// RN02 e RN05 na tela (js/regras.js) e no banco (sql/schema.sql).
// O saldo vem pronto da view pacotes_com_saldo, que respeita o RLS.
import { supabase } from './supabase.js';
import {
  validarPacote, validarPagamento, validarReducaoAulas,
  pacotesAcabando, filtrarPacotes, traduzirErroBanco,
  pacoteVencido, vencimentoDoPacote,
  gerarAulasDoPadrao, conflitosDoPadrao, avisoDoPadrao, MENSAGENS,
} from './regras.js';
import {
  lerValorEmReais, formatarReais, formatarNumero, formatarData, dataISO, iniciais,
  formatarDiaCurto, formatarHora, SITUACOES, limitesDoDia,
} from './formato.js';
import {
  el, mostrarAviso, travarBotoes, confirmar, avisar, abrirDialogo, fecharDialogo,
} from './tela.js';
import { entrarEmCascata, destacar, aoPressionar, encherBarras } from './animacoes.js';
import { listaDeAlunos, NIVEIS } from './alunos.js';
import { criarAutocompletar } from './autocompletar.js';

const lista = document.getElementById('lista-pacotes');
const vazio = document.getElementById('pacotes-vazio');
const semResultado = document.getElementById('pacotes-sem-resultado');
const contagem = document.getElementById('pacotes-contagem');
const campoBusca = document.getElementById('busca-pacotes');
const radiosFiltro = document.querySelectorAll('input[name="filtro-pacotes"]');
const botaoNovo = document.getElementById('botao-novo-pacote');
const dialogo = document.getElementById('dialogo-pacote');
const tituloDialogo = document.getElementById('dialogo-pacote-titulo');
const form = document.getElementById('form-pacote');
const erroForm = document.getElementById('pacote-erro');
const infoSaldo = document.getElementById('pacote-saldo');
const campoPagoEm = document.getElementById('campo-pago-em');
const historico = document.getElementById('pacote-aulas');
const historicoLista = document.getElementById('pacote-aulas-lista');
const botaoExcluir = document.getElementById('botao-excluir-pacote');
const campos = {
  aluno: document.getElementById('pacote-aluno'),
  quantidade: document.getElementById('pacote-quantidade'),
  valor: document.getElementById('pacote-valor'),
  inicio: document.getElementById('pacote-inicio'),
  forma: document.getElementById('pacote-forma'),
  pago: document.getElementById('pacote-pago'),
  pagoEm: document.getElementById('pacote-pago-em'),
};

let pacotes = [];
let editando = null; // pacote aberto no modal (null = novo)
let busca = '';
let filtro = 'todos';

export function listaDePacotes() {
  return pacotes;
}

export async function carregarPacotes(destaqueId = null) {
  const { data, error } = await supabase
    .from('pacotes_com_saldo')
    .select('id, aluno_id, aluno_nome, quantidade_aulas, valor, inicio, pago, pago_em, forma_pagamento, usadas, saldo, criado_em');
  if (error) return avisar(traduzirErroBanco(error), 'erro');
  pacotes = data.sort(compararPacotes);
  desenhar({ destaqueId });
  // A agenda (Hoje) e o Resumo usam o saldo e os valores dos pacotes
  document.dispatchEvent(new Event('pacotes-mudaram'));
}

// Ao sair ou trocar de conta, nada da conta anterior fica na tela (CA09)
export function limparPacotes() {
  pacotes = [];
  busca = '';
  filtro = 'todos';
  campoBusca.value = '';
  radiosFiltro.forEach((radio) => { radio.checked = radio.value === 'todos'; });
  lista.replaceChildren();
  vazio.hidden = true;
  semResultado.hidden = true;
  contagem.textContent = '';
}

// Nome, pacotes ou exclusão de aluno mudam o que aparece aqui
document.addEventListener('alunos-mudaram', () => carregarPacotes());

// Mais recentes primeiro
function compararPacotes(a, b) {
  return b.inicio.localeCompare(a.inicio) || b.criado_em.localeCompare(a.criado_em);
}

function desenhar({ destaqueId = null, animar = true } = {}) {
  const visiveis = filtrarPacotes(pacotes, { busca, filtro });
  const acabando = new Set(pacotesAcabando(pacotes));

  vazio.hidden = pacotes.length > 0;
  semResultado.hidden = pacotes.length === 0 || visiveis.length > 0;
  contagem.textContent = textoContagem();
  lista.replaceChildren(...visiveis.map((p) => itemDoPacote(p, acabando.has(p))));
  aoPressionar(lista.querySelectorAll('.item'), 0.985);

  if (destaqueId) destacar(lista.querySelector(`[data-id="${CSS.escape(destaqueId)}"]`));
  else if (animar) {
    entrarEmCascata(lista.children);
    encherBarras(lista.querySelectorAll('.barra-cheia'));
  }
}

function textoContagem() {
  if (!pacotes.length) return '';
  const abertos = pacotes.filter((p) => !p.pago).length;
  const texto = `${pacotes.length} ${pacotes.length === 1 ? 'pacote' : 'pacotes'}`;
  return abertos ? `${texto} · ${abertos} em aberto` : texto;
}

function textoSaldo(p) {
  if (p.saldo <= 0) return 'acabou';
  // RN07: venceu com aulas sobrando, elas se perdem
  if (pacoteVencido(p, dataISO(new Date()))) return `venceu · ${p.saldo} ${p.saldo === 1 ? 'aula perdida' : 'aulas perdidas'}`;
  return `saldo ${p.saldo} ${p.saldo === 1 ? 'aula' : 'aulas'}`;
}

// "vence 05/12" ou "venceu 05/12"
function textoVencimento(p) {
  const palavra = pacoteVencido(p, dataISO(new Date())) ? 'venceu' : 'vence';
  return `${palavra} ${formatarData(vencimentoDoPacote(p.inicio)).slice(0, 5)}`;
}

function itemDoPacote(p, acabando) {
  const usadasPct = Math.min(100, Math.round((p.usadas / p.quantidade_aulas) * 100));
  const barraCheia = el('span', { class: 'barra-cheia' });
  barraCheia.style.width = `${usadasPct}%`;

  return el('li', {},
    el('button', {
      type: 'button',
      class: 'item',
      'data-id': p.id,
      onclick: () => abrirFormulario(p),
    },
      el('span', { class: 'avatar', 'aria-hidden': 'true' }, iniciais(p.aluno_nome)),
      el('span', { class: 'item-texto' },
        el('span', { class: 'item-titulo' }, p.aluno_nome),
        el('span', { class: 'item-detalhe' },
          `${p.quantidade_aulas} aulas · ${formatarReais(p.valor)} · ${textoVencimento(p)}`,
        ),
        el('span', { class: acabando ? 'saldo saldo-acabando' : 'saldo' },
          el('span', { class: 'barra', 'aria-hidden': 'true' }, barraCheia),
          el('span', {}, `${p.usadas} de ${p.quantidade_aulas} usadas · ${textoSaldo(p)}`),
        ),
      ),
      el('span', { class: p.pago ? 'selo selo-pago' : 'selo selo-aberto' }, p.pago ? 'Pago' : 'Em aberto'),
    ),
  );
}

// ---------- Busca e filtros (RF07) ----------
campoBusca.addEventListener('input', () => {
  busca = campoBusca.value;
  desenhar({ animar: false }); // sem cascata a cada letra digitada
});

radiosFiltro.forEach((radio) => radio.addEventListener('change', () => {
  filtro = radio.value;
  desenhar();
}));

// ---------- Criar e editar ----------
// Novo pacote: só alunos ativos aparecem nas sugestões
const autocompletarAluno = criarAutocompletar(campos.aluno, {
  opcoes: () => listaDeAlunos()
    .filter((a) => a.ativo)
    .map((a) => ({ id: a.id, nome: a.nome, detalhe: NIVEIS[a.nivel] })),
  textoVazio: 'Nenhum aluno ativo com esse nome',
});

function abrirFormulario(pacote = null) {
  if (!pacote && !listaDeAlunos().some((a) => a.ativo)) {
    return avisar('Cadastre um aluno ativo antes de criar um pacote.', 'erro');
  }
  const hoje = dataISO(new Date());
  editando = pacote;

  tituloDialogo.textContent = pacote ? 'Editar pacote' : 'Novo pacote';
  // Na edição o aluno fica travado (mesmo que esteja inativo)
  if (pacote) autocompletarAluno.definir({ id: pacote.aluno_id, nome: pacote.aluno_nome });
  else autocompletarAluno.limpar();
  campos.aluno.disabled = Boolean(pacote);
  campos.quantidade.value = pacote?.quantidade_aulas ?? '';
  campos.valor.value = pacote ? formatarNumero(pacote.valor) : '';
  campos.inicio.value = pacote?.inicio ?? hoje;
  campos.forma.value = pacote?.forma_pagamento ?? 'pix';
  campos.pago.checked = pacote?.pago ?? false;
  campos.pagoEm.value = pacote?.pago_em ?? '';
  campos.pagoEm.max = hoje; // o calendário já não oferece data futura (RN05)
  campoPagoEm.hidden = !campos.pago.checked;
  // RF10 · horário fixo só ao criar o pacote
  secaoPadrao.hidden = Boolean(pacote);
  limparPadrao();

  infoSaldo.hidden = !pacote;
  if (pacote) {
    const prazo = `${pacoteVencido(pacote, hoje) ? 'venceu' : 'vence'} em ${formatarData(vencimentoDoPacote(pacote.inicio))}`;
    infoSaldo.textContent = `${pacote.usadas} de ${pacote.quantidade_aulas} aulas usadas · ${textoSaldo(pacote)} · ${prazo}`;
  }
  historico.hidden = true;
  historicoLista.replaceChildren();
  if (pacote) carregarHistorico(pacote);
  botaoExcluir.hidden = !pacote;
  mostrarAviso(erroForm, '');
  abrirDialogo(dialogo);
  (pacote ? campos.quantidade : campos.aluno).focus();
}

botaoNovo.addEventListener('click', () => abrirFormulario());

// RF04 · aulas deste pacote, da mais antiga para a mais nova
async function carregarHistorico(pacote) {
  const { data, error } = await supabase
    .from('aulas')
    .select('id, inicio, status')
    .eq('pacote_id', pacote.id)
    .order('inicio');
  // a resposta chegou depois de o modal já ter mudado de pacote: descarta
  if (error || editando?.id !== pacote.id || !data.length) return;

  historicoLista.replaceChildren(...data.map((aula) =>
    el('li', {},
      el('span', {}, `${formatarDiaCurto(aula.inicio)} · ${formatarHora(aula.inicio)}`),
      el('span', { class: `selo selo-${aula.status}` }, SITUACOES[aula.status]),
    )));
  historico.hidden = false;
}

// RF06 · ao marcar como pago, a data já vem com hoje (dá para trocar)
campos.pago.addEventListener('change', () => {
  campoPagoEm.hidden = !campos.pago.checked;
  if (campos.pago.checked && !campos.pagoEm.value) campos.pagoEm.value = dataISO(new Date());
});

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const hoje = dataISO(new Date());
  const pacote = editando;
  const dados = {
    quantidade_aulas: Number(campos.quantidade.value),
    valor: lerValorEmReais(campos.valor.value),
    inicio: campos.inicio.value || hoje,
    forma_pagamento: campos.forma.value,
    pago: campos.pago.checked,
    pago_em: campos.pago.checked ? (campos.pagoEm.value || null) : null, // RN05: não pago não tem data
  };

  if (!pacote) {
    const alunoId = autocompletarAluno.valor();
    if (!alunoId) {
      mostrarAviso(erroForm, 'Escolha um aluno da lista.');
      return campos.aluno.focus();
    }
    dados.aluno_id = alunoId;
  }

  // RN02, RN05 e o complemento da RN02 na tela; o banco repete as três
  const invalido =
    validarPacote(dados) ??
    validarPagamento(dados, hoje) ??
    (pacote ? validarReducaoAulas(dados.quantidade_aulas, pacote.usadas) : null);
  if (invalido) return mostrarAviso(erroForm, invalido);

  // RF10 · horário fixo: dia sem horário ou conflito (CA15) não deixam salvar nada
  let padrao = null;
  if (!pacote && diasEscolhidos().length) {
    await carregarAulasDoPeriodo(); // garante a lista de aulas já marcadas antes de checar conflito
    padrao = calcularPadrao();
    atualizarPrevia();
    const campoHora = (dia) => document.getElementById(`padrao-hora-${dia}`);
    if (padrao.semHora.length) {
      mostrarAviso(erroForm, MENSAGENS.horarioFaltando);
      return campoHora(padrao.semHora[0]).focus();
    }
    const primeiroConflito = padrao.conflitos.findIndex(Boolean);
    if (primeiroConflito >= 0) {
      mostrarAviso(erroForm, MENSAGENS.conflito);
      return campoHora(padrao.aulas[primeiroConflito].inicio.getDay()).focus();
    }
  }

  travarBotoes(form, true);
  const { data, error } = pacote
    ? await supabase.from('pacotes').update(dados).eq('id', pacote.id).select('id').single()
    : await supabase.from('pacotes').insert(dados).select('id').single();
  if (error) {
    travarBotoes(form, false);
    return mostrarAviso(erroForm, traduzirErroBanco(error));
  }

  // As aulas do horário fixo vão num envio só: entram todas ou nenhuma.
  // Se falharem, o pacote recém-criado é apagado, para nada ficar pela metade.
  const agendadas = padrao?.aulas.length ?? 0;
  if (agendadas) {
    const { error: erroAulas } = await supabase.from('aulas').insert(padrao.aulas.map((aula) => ({
      pacote_id: data.id,
      inicio: aula.inicio.toISOString(),
      fim: aula.fim.toISOString(),
      status: 'agendada',
    })));
    if (erroAulas) {
      await supabase.from('pacotes').delete().eq('id', data.id);
      travarBotoes(form, false);
      return mostrarAviso(erroForm, traduzirErroBanco(erroAulas));
    }
  }
  travarBotoes(form, false);

  fecharDialogo(dialogo);
  if (pacote) avisar('Pacote atualizado.');
  else if (agendadas) avisar(`Pacote salvo e ${agendadas} ${agendadas === 1 ? 'aula agendada' : 'aulas agendadas'}.`);
  else avisar('Pacote criado.');
  await carregarPacotes(data.id);
  if (agendadas) document.dispatchEvent(new Event('aulas-mudaram'));
});

// ---------- Horário fixo ao criar o pacote (RF10, CA15 e CA16) ----------
const secaoPadrao = document.getElementById('pacote-padrao');
const diasPadrao = [...document.querySelectorAll('input[name="padrao-dia"]')];
const horasPadrao = document.getElementById('padrao-horas');
const campoDuracaoPadrao = document.getElementById('padrao-campo-duracao');
const duracaoPadrao = document.getElementById('padrao-duracao');
const previaPadrao = document.getElementById('padrao-previa');
const resumoPadrao = document.getElementById('padrao-resumo');
const avisoPadrao = document.getElementById('padrao-aviso');
const listaPadrao = document.getElementById('padrao-lista');
const NOMES_DOS_DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const horaDoDia = new Map(); // dia da semana → 'HH:MM' digitado (fica guardado ao desmarcar e marcar de novo)
const copiados = new Set(); // dias cujo horário veio de outro dia: seguem o horário digitado até serem mudados à mão
let periodo = { compra: null, aulas: [], busca: Promise.resolve() }; // aulas já marcadas no prazo do pacote

// Na ordem da tela: segunda a domingo
function diasEscolhidos() {
  return diasPadrao.filter((caixa) => caixa.checked).map((caixa) => Number(caixa.value));
}

function horariosEscolhidos() {
  return diasEscolhidos().map((dia) => ({ dia, hora: horaDoDia.get(dia) ?? '' }));
}

function limparPadrao() {
  diasPadrao.forEach((caixa) => { caixa.checked = false; });
  horaDoDia.clear();
  copiados.clear();
  duracaoPadrao.value = '60';
  periodo = { compra: null, aulas: [], busca: Promise.resolve() };
  desenharHorasDoPadrao();
  atualizarPrevia();
}

// Uma linha "Terça [07:00]" por dia marcado
function desenharHorasDoPadrao() {
  horasPadrao.replaceChildren(...diasEscolhidos().map((dia) => {
    const id = `padrao-hora-${dia}`;
    return el('div', { class: 'padrao-hora' },
      el('label', { for: id }, NOMES_DOS_DIAS[dia]),
      el('input', {
        id,
        type: 'time',
        value: horaDoDia.get(dia) ?? '',
        required: true,
        'data-dia': dia,
        oninput: (evento) => {
          const hora = evento.target.value;
          horaDoDia.set(dia, hora);
          copiados.delete(dia);
          // Marcou os dias antes de digitar: os outros, vazios ou copiados, recebem o mesmo horário
          for (const outro of diasEscolhidos()) {
            if (outro === dia || (horaDoDia.get(outro) && !copiados.has(outro))) continue;
            horaDoDia.set(outro, hora);
            copiados.add(outro);
            document.getElementById(`padrao-hora-${outro}`).value = hora;
          }
          atualizarPrevia();
        },
      }),
    );
  }));
}

// Aulas não canceladas entre o começo do padrão e o vencimento, para achar conflito (RN03).
// Busca uma vez por data da compra; devolve a promessa para o envio poder esperar.
function carregarAulasDoPeriodo() {
  const compra = campos.inicio.value || dataISO(new Date());
  if (periodo.compra === compra) return periodo.busca;
  const atual = { compra, aulas: [] };
  atual.busca = buscarAulasDoPeriodo(compra).then((aulas) => {
    atual.aulas = aulas;
    if (periodo === atual) atualizarPrevia();
  });
  periodo = atual;
  return atual.busca;
}

async function buscarAulasDoPeriodo(compra) {
  const hoje = dataISO(new Date());
  const { de } = limitesDoDia(compra > hoje ? compra : hoje);
  const { ate } = limitesDoDia(vencimentoDoPacote(compra));
  const { data, error } = await supabase
    .from('aulas')
    .select('id, pacote_id, inicio, fim, status')
    .neq('status', 'cancelada')
    .lt('inicio', ate)
    .gt('fim', de);
  if (error) {
    avisar(traduzirErroBanco(error), 'erro');
    return []; // sem a lista, o banco ainda recusa o conflito ao salvar
  }
  return data;
}

// null quando nenhum dia foi marcado (pacote sem horário fixo) ou quando o pacote está sendo editado
function calcularPadrao() {
  const horarios = horariosEscolhidos();
  if (editando || !horarios.length) return null;
  const compra = campos.inicio.value || dataISO(new Date());
  const quantidade = Number(campos.quantidade.value);
  const { aulas, naoCouberam } = gerarAulasDoPadrao({
    compra,
    quantidade,
    horarios: horarios.filter((h) => h.hora),
    duracao: Number(duracaoPadrao.value),
    agora: new Date(),
  });
  return {
    compra,
    quantidade,
    aulas,
    naoCouberam,
    semHora: horarios.filter((h) => !h.hora).map((h) => h.dia),
    conflitos: conflitosDoPadrao(aulas, periodo.compra === compra ? periodo.aulas : []),
  };
}

// A lista "Vai agendar…" acompanha cada mudança; conflito aparece na hora (CA15)
function atualizarPrevia() {
  const padrao = calcularPadrao();
  // O erro do último "Salvar" some quando o problema deixa de existir
  const erro = erroForm.textContent;
  if ((erro === MENSAGENS.conflito && !padrao?.conflitos.some(Boolean))
    || (erro === MENSAGENS.horarioFaltando && !padrao?.semHora.length)) mostrarAviso(erroForm, '');

  campoDuracaoPadrao.hidden = !padrao;
  previaPadrao.hidden = !padrao;
  if (!padrao) return;

  const vencimento = vencimentoDoPacote(padrao.compra);
  const qtdOk = Number.isInteger(padrao.quantidade) && padrao.quantidade >= 1;
  const mostrar = !padrao.semHora.length && qtdOk;
  const n = padrao.aulas.length;

  if (padrao.semHora.length) resumoPadrao.textContent = MENSAGENS.horarioFaltando;
  else if (!qtdOk) resumoPadrao.textContent = 'Informe a quantidade de aulas para ver as datas.';
  else resumoPadrao.textContent = `Vai agendar ${n} ${n === 1 ? 'aula' : 'aulas'} até o vencimento (${formatarData(vencimento).slice(0, 5)}):`;

  const aviso = mostrar ? avisoDoPadrao(n, padrao.quantidade, vencimento) : null;
  avisoPadrao.hidden = !aviso;
  avisoPadrao.textContent = aviso ?? '';

  const nomeDoAluno = (pacoteId) => pacotes.find((p) => p.id === pacoteId)?.aluno_nome ?? 'outro aluno';
  listaPadrao.replaceChildren(...(mostrar ? padrao.aulas : []).map((aula, i) => {
    const outra = padrao.conflitos[i];
    const quando = el('span', {}, `${formatarDiaCurto(aula.inicio)} · ${formatarHora(aula.inicio)}`);
    if (!outra) return el('li', {}, quando);
    return el('li', { class: 'conflito' }, quando,
      el('span', { class: 'conflito-texto' },
        `${MENSAGENS.conflito} Aula de ${nomeDoAluno(outra.pacote_id)}, ${formatarHora(outra.inicio)}–${formatarHora(outra.fim)}.`));
  }));
  listaPadrao.hidden = !mostrar || !n;

  // O campo de horário do dia com conflito fica marcado como inválido
  const diasComConflito = new Set(padrao.aulas.filter((_, i) => padrao.conflitos[i]).map((a) => a.inicio.getDay()));
  horasPadrao.querySelectorAll('input').forEach((campo) => {
    if (diasComConflito.has(Number(campo.dataset.dia))) campo.setAttribute('aria-invalid', 'true');
    else campo.removeAttribute('aria-invalid');
  });
}

diasPadrao.forEach((caixa) => caixa.addEventListener('change', () => {
  const dia = Number(caixa.value);
  // O dia marcado depois do primeiro já vem com o horário do primeiro (se ninguém digitou outro nele)
  if (caixa.checked && (!horaDoDia.get(dia) || copiados.has(dia))) {
    const primeiro = horariosEscolhidos().find((h) => h.dia !== dia && h.hora);
    if (primeiro) {
      horaDoDia.set(dia, primeiro.hora);
      copiados.add(dia);
    }
  }
  desenharHorasDoPadrao();
  if (caixa.checked) carregarAulasDoPeriodo();
  atualizarPrevia();
}));

campos.quantidade.addEventListener('input', atualizarPrevia);
duracaoPadrao.addEventListener('change', atualizarPrevia);
campos.inicio.addEventListener('change', () => {
  if (diasEscolhidos().length) carregarAulasDoPeriodo();
  atualizarPrevia();
});

// ---------- Excluir ----------
botaoExcluir.addEventListener('click', () => {
  if (editando) excluirPacote(editando);
});

async function excluirPacote(pacote) {
  const confirmou = await confirmar({
    titulo: `Excluir o pacote de ${pacote.aluno_nome}?`,
    mensagem: 'Todas as aulas deste pacote, dadas ou agendadas, também serão apagadas. Não dá para desfazer.',
    botao: 'Excluir',
    perigo: true,
  });
  if (!confirmou) return;

  travarBotoes(form, true);
  const { error } = await supabase.from('pacotes').delete().eq('id', pacote.id);
  travarBotoes(form, false);
  if (error) return mostrarAviso(erroForm, traduzirErroBanco(error));

  fecharDialogo(dialogo);
  avisar('Pacote excluído.');
  await carregarPacotes();
}
