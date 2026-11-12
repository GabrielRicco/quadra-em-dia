// Aba Alunos · RF02 (criar, listar, editar, excluir), RN01 e RN06.
// A tela avisa com as regras de js/regras.js; o banco repete as mesmas regras.
import { supabase } from './supabase.js';
import { validarAluno, validarExclusaoAluno, traduzirErroBanco, MENSAGENS } from './regras.js';
import {
  el, mostrarAviso, travarBotoes, confirmar, avisar, abrirDialogo, fecharDialogo,
} from './tela.js';
import { entrarEmCascata, destacar, aoPressionar } from './animacoes.js';

export const NIVEIS = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
};

const lista = document.getElementById('lista-alunos');
const vazio = document.getElementById('alunos-vazio');
const contagem = document.getElementById('alunos-contagem');
const botaoNovo = document.getElementById('botao-novo-aluno');
const dialogo = document.getElementById('dialogo-aluno');
const tituloDialogo = document.getElementById('dialogo-aluno-titulo');
const form = document.getElementById('form-aluno');
const erroForm = document.getElementById('aluno-erro');
const botaoExcluir = document.getElementById('botao-excluir-aluno');
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

// destaqueId: aluno que acabou de ser salvo (pisca em verde em vez da lista entrar de novo)
export async function carregarAlunos(destaqueId = null) {
  const { data, error } = await supabase
    .from('alunos')
    .select('id, nome, telefone, nivel, ativo, observacoes');
  if (error) return avisar(traduzirErroBanco(error), 'erro');
  alunos = data.sort(compararAlunos);
  desenhar(destaqueId);
}

// Ao sair ou trocar de conta, nada da conta anterior fica na tela (CA09)
export function limparAlunos() {
  alunos = [];
  lista.replaceChildren();
  vazio.hidden = true;
  contagem.textContent = '';
}

// Ativos primeiro; depois por nome, com acentos em português
function compararAlunos(a, b) {
  if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
  return a.nome.localeCompare(b.nome, 'pt-BR');
}

function desenhar(destaqueId) {
  vazio.hidden = alunos.length > 0;
  contagem.textContent = textoContagem();
  lista.replaceChildren(...alunos.map(itemDoAluno));
  aoPressionar(lista.querySelectorAll('.item'), 0.985);

  if (destaqueId) destacar(lista.querySelector(`[data-id="${CSS.escape(destaqueId)}"]`));
  else entrarEmCascata(lista.children);
}

function textoContagem() {
  if (!alunos.length) return '';
  const ativos = alunos.filter((a) => a.ativo).length;
  const inativos = alunos.length - ativos;
  const texto = `${ativos} ${ativos === 1 ? 'aluno ativo' : 'alunos ativos'}`;
  return inativos ? `${texto} · ${inativos} ${inativos === 1 ? 'inativo' : 'inativos'}` : texto;
}

function iniciais(nome) {
  const partes = nome.trim().split(/\s+/);
  const ultima = partes.length > 1 ? partes.at(-1)[0] : '';
  return (partes[0][0] + ultima).toUpperCase();
}

// Cada linha é um botão: tocar abre a edição (onde também fica o "Excluir")
function itemDoAluno(aluno) {
  const detalhe = [NIVEIS[aluno.nivel], aluno.telefone].filter(Boolean).join(' · ');
  return el('li', {},
    el('button', {
      type: 'button',
      class: aluno.ativo ? 'item' : 'item item-inativo',
      'data-id': aluno.id,
      onclick: () => abrirFormulario(aluno),
    },
      el('span', { class: 'avatar', 'aria-hidden': 'true' }, iniciais(aluno.nome)),
      el('span', { class: 'item-texto' },
        el('span', { class: 'item-titulo' },
          aluno.nome,
          aluno.ativo ? null : el('span', { class: 'etiqueta' }, 'Inativo'),
        ),
        el('span', { class: 'item-detalhe' }, detalhe),
      ),
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
  botaoExcluir.hidden = !aluno;
  mostrarAviso(erroForm, '');
  abrirDialogo(dialogo);
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
  const editando = Boolean(editandoId);
  travarBotoes(form, true);
  const { data, error } = editando
    ? await supabase.from('alunos').update(dados).eq('id', editandoId).select('id').single()
    : await supabase.from('alunos').insert(dados).select('id').single();
  travarBotoes(form, false);

  if (error) return mostrarAviso(erroForm, traduzirErroBanco(error));
  fecharDialogo(dialogo);
  avisar(editando ? 'Aluno atualizado.' : 'Aluno cadastrado.');
  await carregarAlunos(data.id);
});

// ---------- Excluir (RN06) ----------
botaoExcluir.addEventListener('click', () => {
  const aluno = alunos.find((a) => a.id === editandoId);
  if (aluno) excluirAluno(aluno);
});

async function excluirAluno(aluno) {
  mostrarAviso(erroForm, '');

  // RN06 na tela: checa antes de perguntar "tem certeza?"
  const { data: pacotes, error } = await supabase
    .from('pacotes')
    .select('pago')
    .eq('aluno_id', aluno.id);
  if (error) return mostrarAviso(erroForm, traduzirErroBanco(error));

  const bloqueio = validarExclusaoAluno(pacotes);
  if (bloqueio) return oferecerInativar(aluno, bloqueio);

  const confirmou = await confirmar({
    titulo: `Excluir ${aluno.nome}?`,
    mensagem: 'Os pacotes e as aulas deste aluno também serão apagados. Não dá para desfazer.',
    botao: 'Excluir',
    perigo: true,
  });
  if (!confirmou) return;

  travarBotoes(form, true);
  const { error: erroExclusao } = await supabase.from('alunos').delete().eq('id', aluno.id);
  travarBotoes(form, false);
  if (erroExclusao) {
    const mensagem = traduzirErroBanco(erroExclusao);
    // o banco também barra (trigger), caso a tela esteja desatualizada
    if (mensagem === MENSAGENS.excluirAluno) return oferecerInativar(aluno, mensagem);
    return mostrarAviso(erroForm, mensagem);
  }
  fecharDialogo(dialogo);
  avisar(`${aluno.nome} foi excluído.`);
  await carregarAlunos();
}

async function oferecerInativar(aluno, mensagem) {
  if (!aluno.ativo) return mostrarAviso(erroForm, mensagem);

  const inativar = await confirmar({
    titulo: 'Não dá para excluir',
    mensagem, // mensagem exata do CA06
    botao: 'Marcar como inativo',
    cancelar: 'Agora não',
  });
  if (!inativar) return;

  const { error } = await supabase.from('alunos').update({ ativo: false }).eq('id', aluno.id);
  if (error) return mostrarAviso(erroForm, traduzirErroBanco(error));
  fecharDialogo(dialogo);
  avisar(`${aluno.nome} agora está inativo.`);
  await carregarAlunos(aluno.id);
}
