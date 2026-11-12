// Aba Pacotes · RF03 (criar, listar, editar, excluir), RF06 (marcar pago) e RF07 (busca e filtros).
// RN02 e RN05 na tela (js/regras.js) e no banco (sql/schema.sql).
// O saldo vem pronto da view pacotes_com_saldo, que respeita o RLS.
import { supabase } from './supabase.js';
import {
  validarPacote, validarPagamento, validarReducaoAulas,
  pacotesAcabando, filtrarPacotes, traduzirErroBanco,
} from './regras.js';
import {
  lerValorEmReais, formatarReais, formatarNumero, formatarData, dataISO, iniciais,
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
  return `saldo ${p.saldo} ${p.saldo === 1 ? 'aula' : 'aulas'}`;
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
          `${p.quantidade_aulas} aulas · ${formatarReais(p.valor)} · desde ${formatarData(p.inicio)}`,
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

  infoSaldo.hidden = !pacote;
  if (pacote) {
    infoSaldo.textContent = `${pacote.usadas} de ${pacote.quantidade_aulas} aulas usadas · ${textoSaldo(pacote)}`;
  }
  botaoExcluir.hidden = !pacote;
  mostrarAviso(erroForm, '');
  abrirDialogo(dialogo);
  (pacote ? campos.quantidade : campos.aluno).focus();
}

botaoNovo.addEventListener('click', () => abrirFormulario());

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

  travarBotoes(form, true);
  const { data, error } = pacote
    ? await supabase.from('pacotes').update(dados).eq('id', pacote.id).select('id').single()
    : await supabase.from('pacotes').insert(dados).select('id').single();
  travarBotoes(form, false);

  if (error) return mostrarAviso(erroForm, traduzirErroBanco(error));
  fecharDialogo(dialogo);
  avisar(pacote ? 'Pacote atualizado.' : 'Pacote criado.');
  await carregarPacotes(data.id);
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
