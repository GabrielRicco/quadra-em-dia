// Aba Alunos · RF02 (criar, listar, editar, excluir), RN01 e RN06.
// A tela avisa com as regras de js/regras.js; o banco repete as mesmas regras.
import { supabase } from './supabase.js';
import { validarAluno, validarExclusaoAluno, traduzirErroBanco, MENSAGENS } from './regras.js';
import { el, mostrarAviso, travarBotoes } from './tela.js';

export const NIVEIS = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
};

const lista = document.getElementById('lista-alunos');
const vazio = document.getElementById('alunos-vazio');
const aviso = document.getElementById('alunos-aviso');
const botaoNovo = document.getElementById('botao-novo-aluno');
const dialogo = document.getElementById('dialogo-aluno');
const tituloDialogo = document.getElementById('dialogo-aluno-titulo');
const form = document.getElementById('form-aluno');
const erroForm = document.getElementById('aluno-erro');
const campos = {
  nome: document.getElementById('aluno-nome'),
  telefone: document.getElementById('aluno-telefone'),
  nivel: document.getElementById('aluno-nivel'),
  observacoes: document.getElementById('aluno-observacoes'),
  ativo: document.getElementById('aluno-ativo'),
};

let alunos = [];
let editandoId = null;

export function listaDeAlunos() {
  return alunos;
}

export async function carregarAlunos() {
  const { data, error } = await supabase
    .from('alunos')
    .select('id, nome, telefone, nivel, ativo, observacoes');
  if (error) return mostrarAviso(aviso, traduzirErroBanco(error));
  alunos = data.sort(compararAlunos);
  desenhar();
}

// Ao sair ou trocar de conta, nada da conta anterior fica na tela (CA09)
export function limparAlunos() {
  alunos = [];
  lista.replaceChildren();
  vazio.hidden = true;
  mostrarAviso(aviso, '');
}

// Ativos primeiro; depois por nome, com acentos em português
function compararAlunos(a, b) {
  if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
  return a.nome.localeCompare(b.nome, 'pt-BR');
}

function desenhar() {
  vazio.hidden = alunos.length > 0;
  lista.replaceChildren(...alunos.map(cartaoDoAluno));
}

function cartaoDoAluno(aluno) {
  const detalhe = [NIVEIS[aluno.nivel], aluno.telefone].filter(Boolean).join(' · ');
  return el('li', { class: aluno.ativo ? 'cartao' : 'cartao cartao-inativo' },
    el('div', { class: 'cartao-info' },
      el('p', { class: 'cartao-titulo' },
        aluno.nome,
        aluno.ativo ? null : el('span', { class: 'etiqueta' }, 'Inativo'),
      ),
      el('p', { class: 'cartao-detalhe' }, detalhe),
      aluno.observacoes ? el('p', { class: 'cartao-obs' }, aluno.observacoes) : null,
    ),
    el('div', { class: 'cartao-acoes' },
      el('button', {
        type: 'button',
        class: 'botao-secundario botao-pequeno',
        'aria-label': `Editar ${aluno.nome}`,
        onclick: () => abrirFormulario(aluno),
      }, 'Editar'),
      el('button', {
        type: 'button',
        class: 'botao-perigo botao-pequeno',
        'aria-label': `Excluir ${aluno.nome}`,
        onclick: () => excluirAluno(aluno),
      }, 'Excluir'),
    ),
  );
}

// ---------- Criar e editar ----------
function abrirFormulario(aluno = null) {
  editandoId = aluno?.id ?? null;
  tituloDialogo.textContent = aluno ? 'Editar aluno' : 'Novo aluno';
  campos.nome.value = aluno?.nome ?? '';
  campos.telefone.value = aluno?.telefone ?? '';
  campos.nivel.value = aluno?.nivel ?? 'iniciante';
  campos.observacoes.value = aluno?.observacoes ?? '';
  campos.ativo.checked = aluno?.ativo ?? true;
  mostrarAviso(erroForm, '');
  dialogo.showModal();
  campos.nome.focus();
}

botaoNovo.addEventListener('click', () => abrirFormulario());

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const dados = {
    nome: campos.nome.value.trim(),
    telefone: campos.telefone.value.trim() || null,
    nivel: campos.nivel.value,
    observacoes: campos.observacoes.value.trim() || null,
    ativo: campos.ativo.checked,
  };

  const invalido = validarAluno(dados); // RN01 na tela
  if (invalido) {
    mostrarAviso(erroForm, invalido);
    campos.nome.focus();
    return;
  }

  // professor_id não vai daqui: o banco preenche com o usuário logado (auth.uid())
  travarBotoes(form, true);
  const { error } = editandoId
    ? await supabase.from('alunos').update(dados).eq('id', editandoId)
    : await supabase.from('alunos').insert(dados);
  travarBotoes(form, false);

  if (error) return mostrarAviso(erroForm, traduzirErroBanco(error));
  dialogo.close();
  mostrarAviso(aviso, editandoId ? 'Aluno atualizado.' : 'Aluno cadastrado.', 'ok');
  await carregarAlunos();
});

// ---------- Excluir (RN06) ----------
async function excluirAluno(aluno) {
  const confirmou = confirm(
    `Excluir ${aluno.nome}? Os pacotes e as aulas deste aluno também serão apagados.`,
  );
  if (!confirmou) return;

  const { data: pacotes, error } = await supabase
    .from('pacotes')
    .select('pago')
    .eq('aluno_id', aluno.id);
  if (error) return mostrarAviso(aviso, traduzirErroBanco(error));

  const bloqueio = validarExclusaoAluno(pacotes); // RN06 na tela
  if (bloqueio) return oferecerInativar(aluno, bloqueio);

  const { error: erroExclusao } = await supabase.from('alunos').delete().eq('id', aluno.id);
  if (erroExclusao) {
    const mensagem = traduzirErroBanco(erroExclusao);
    // o banco também barra (trigger), caso a tela esteja desatualizada
    if (mensagem === MENSAGENS.excluirAluno) return oferecerInativar(aluno, mensagem);
    return mostrarAviso(aviso, mensagem);
  }
  mostrarAviso(aviso, `${aluno.nome} foi excluído.`, 'ok');
  await carregarAlunos();
}

async function oferecerInativar(aluno, mensagem) {
  mostrarAviso(aviso, mensagem);
  if (!aluno.ativo) return;
  if (!confirm(`${mensagem}\n\nMarcar ${aluno.nome} como inativo agora?`)) return;

  const { error } = await supabase.from('alunos').update({ ativo: false }).eq('id', aluno.id);
  if (error) return mostrarAviso(aviso, traduzirErroBanco(error));
  mostrarAviso(aviso, `${aluno.nome} agora está inativo.`, 'ok');
  await carregarAlunos();
}
