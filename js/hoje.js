// Aba Hoje · a agenda, vista por dia (lista) ou por mês (calendário).
// RF05: aulas do dia com aluno, horário, saldo do pacote e botões "dada", "falta" e "cancelada".
// RF04: agendar, listar, editar e excluir aulas (cada aula sai de um pacote).
// RN03 (horário sobreposto) e RN04 (sem saldo) na tela (js/regras.js) e no banco (sql/schema.sql).
import { supabase } from './supabase.js';
import {
  validarConflito, validarUsoDeAula, calcularFim, aulasDoDia, aulasPorDia,
  pacotesAcabando, pacotesParaAgendar, traduzirErroBanco,
  pacoteVencido, vencimentoDoPacote, validarPrazoDaAula,
} from './regras.js';
import {
  dataISO, formatarHora, juntarDataHora, somarDias, limitesDoDia,
  duracaoEmMinutos, rotuloDoDia, dataPorExtenso, SITUACOES,
  diasDaGradeDoMes, somarMeses, mesPorExtenso, formatarData,
} from './formato.js';
import {
  el, mostrarAviso, travarBotoes, confirmar, avisar, abrirDialogo, fecharDialogo,
} from './tela.js';
import { entrarEmCascata, entrarSecao, destacar, aoPressionar } from './animacoes.js';
import { listaDePacotes, carregarPacotes } from './pacotes.js';
import { listaDeAlunos } from './alunos.js';
import { criarAutocompletar } from './autocompletar.js';

const titulo = document.getElementById('hoje-titulo');
const subtitulo = document.getElementById('hoje-subtitulo');
const lista = document.getElementById('lista-aulas');
const vazio = document.getElementById('hoje-vazio');
const botaoAgendar = document.getElementById('botao-agendar');
const botaoAnterior = document.getElementById('dia-anterior');
const botaoHoje = document.getElementById('dia-hoje');
const botaoSeguinte = document.getElementById('dia-seguinte');
const campoDia = document.getElementById('dia-escolhido');
const radiosModo = document.querySelectorAll('input[name="modo-agenda"]');
const calendario = document.getElementById('calendario');
const diasDoMes = document.getElementById('dias-do-mes');
const dialogo = document.getElementById('dialogo-aula');
const tituloDialogo = document.getElementById('dialogo-aula-titulo');
const form = document.getElementById('form-aula');
const erroForm = document.getElementById('aula-erro');
const infoPacote = document.getElementById('aula-pacote-info');
const campoSituacao = document.getElementById('campo-aula-status');
const botaoExcluir = document.getElementById('botao-excluir-aula');
const campos = {
  aluno: document.getElementById('aula-aluno'),
  data: document.getElementById('aula-data'),
  hora: document.getElementById('aula-hora'),
  duracao: document.getElementById('aula-duracao'),
  situacao: document.getElementById('aula-status'),
};

let dia = dataISO(new Date()); // dia mostrado na lista ('AAAA-MM-DD')
let mes = dia.slice(0, 7);     // mês mostrado no calendário ('AAAA-MM')
let modo = 'dia';              // 'dia' (lista) ou 'mes' (calendário)
let aulas = [];
let carregou = false;          // evita piscar "nenhuma aula" antes da primeira busca
let editando = null;           // aula aberta no modal (null = nova)

const hoje = () => dataISO(new Date());
const pacotePorId = (id) => listaDePacotes().find((p) => p.id === id);
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const AULAS_NA_CELULA = 3; // no calendário, o resto vira "+N"

// ---------- Carregar e desenhar ----------
// No modo mês, busca a grade inteira (inclui as pontas dos meses vizinhos)
function periodo() {
  if (modo === 'dia') return limitesDoDia(dia);
  const grade = diasDaGradeDoMes(mes);
  return { de: limitesDoDia(grade[0]).de, ate: limitesDoDia(grade.at(-1)).ate };
}

export async function carregarAulas({ destaqueId = null, animar = true } = {}) {
  const { de, ate } = periodo();
  const { data, error } = await supabase
    .from('aulas')
    .select('id, pacote_id, inicio, fim, status')
    .gte('inicio', de)
    .lt('inicio', ate);
  if (error) return avisar(traduzirErroBanco(error), 'erro');
  // CA08: no modo dia, só o dia escolhido, em ordem de horário
  aulas = modo === 'dia' ? aulasDoDia(data, dia) : data;
  carregou = true;
  desenhar({ destaqueId, animar });
}

// Ao sair ou trocar de conta, nada da conta anterior fica na tela (CA09); a agenda volta para hoje
export function limparAulas() {
  aulas = [];
  carregou = false;
  dia = hoje();
  mes = dia.slice(0, 7);
  modo = 'dia';
  radiosModo.forEach((radio) => { radio.checked = radio.value === 'dia'; });
  lista.replaceChildren();
  diasDoMes.replaceChildren();
  lista.hidden = false;
  calendario.hidden = true;
  vazio.hidden = true;
  atualizarCabecalho();
}

// Saldo e nomes vêm dos pacotes: quando eles mudam, a agenda se redesenha.
// Aula de pacote excluído some (o banco apaga em cascata).
document.addEventListener('pacotes-mudaram', () => {
  const existentes = new Set(listaDePacotes().map((p) => p.id));
  aulas = aulas.filter((a) => existentes.has(a.pacote_id));
  if (carregou) desenhar({ animar: false });
});

function atualizarCabecalho() {
  const noMes = modo === 'mes';
  botaoAnterior.setAttribute('aria-label', noMes ? 'Mês anterior' : 'Dia anterior');
  botaoSeguinte.setAttribute('aria-label', noMes ? 'Próximo mês' : 'Próximo dia');
  campoDia.hidden = noMes;

  if (noMes) {
    titulo.textContent = mesPorExtenso(mes);
    const doMes = aulas.filter((a) => a.status !== 'cancelada' && dataISO(new Date(a.inicio)).startsWith(mes));
    const aDar = doMes.filter((a) => a.status === 'agendada').length;
    subtitulo.textContent = doMes.length
      ? `${plural(doMes.length, 'aula', 'aulas')} no mês${aDar ? ` · ${aDar} a dar` : ''}`
      : 'Nenhuma aula neste mês';
    botaoHoje.setAttribute('aria-pressed', String(mes === hoje().slice(0, 7)));
    return;
  }

  titulo.textContent = rotuloDoDia(dia, hoje());
  const n = aulas.length;
  const aDar = aulas.filter((a) => a.status === 'agendada').length;
  const partes = [dataPorExtenso(dia)];
  if (n) partes.push(plural(n, 'aula', 'aulas'));
  if (aDar && aDar < n) partes.push(`${aDar} a dar`);
  subtitulo.textContent = partes.join(' · ');
  campoDia.value = dia;
  botaoHoje.setAttribute('aria-pressed', String(dia === hoje()));
}

function desenhar({ destaqueId = null, animar = true } = {}) {
  const pacotes = new Map(listaDePacotes().map((p) => [p.id, p]));
  const acabando = new Set(pacotesAcabando(listaDePacotes()).map((p) => p.id));

  atualizarCabecalho();
  const noMes = modo === 'mes';
  calendario.hidden = !noMes;
  lista.hidden = noMes;
  if (noMes) {
    vazio.hidden = true;
    desenharMes(pacotes, animar);
    return;
  }
  vazio.hidden = !carregou || aulas.length > 0;
  lista.replaceChildren(...aulas.map((a) => itemDaAula(a, pacotes.get(a.pacote_id), acabando)));
  aoPressionar(lista.querySelectorAll('.aula-principal'), 0.985);
  aoPressionar(lista.querySelectorAll('.aula-acoes .botao'));

  if (destaqueId) destacar(lista.querySelector(`[data-id="${CSS.escape(destaqueId)}"]`));
  else if (animar) entrarEmCascata(lista.children);
}

// ---------- Calendário do mês ----------
// Cada dia é um botão: mostra o número, até 3 aulas ("07:00 Ana") e "+N"; no celular, só a contagem.
// Tocar no dia abre a lista daquele dia.
function desenharMes(pacotes, animar) {
  const porDia = aulasPorDia(aulas);
  const hojeISO = hoje();

  diasDoMes.replaceChildren(...diasDaGradeDoMes(mes).map((data) => {
    const doDia = porDia.get(data) ?? [];
    const valem = doDia.filter((a) => a.status !== 'cancelada').length;
    const classes = ['dia'];
    if (!data.startsWith(mes)) classes.push('dia-fora');
    if (data === hojeISO) classes.push('dia-hoje');
    if (data === dia) classes.push('dia-escolhido');

    return el('li', {},
      el('button', {
        type: 'button',
        class: classes.join(' '),
        'aria-label': `${dataPorExtenso(data)}: ${valem ? plural(valem, 'aula', 'aulas') : 'nenhuma aula'}`,
        'aria-current': data === hojeISO ? 'date' : null,
        onclick: () => abrirDia(data),
      },
        el('span', { class: 'dia-numero' }, String(Number(data.slice(8)))),
        doDia.slice(0, AULAS_NA_CELULA).map((aula) => el('span', { class: `aula-mini aula-mini-${aula.status}` },
          `${formatarHora(aula.inicio)} ${(pacotes.get(aula.pacote_id)?.aluno_nome ?? '').split(' ')[0]}`)),
        doDia.length > AULAS_NA_CELULA ? el('span', { class: 'mais' }, `+${doDia.length - AULAS_NA_CELULA}`) : null,
        valem ? el('span', { class: 'contagem' }, String(valem)) : null,
      ),
    );
  }));

  aoPressionar(diasDoMes.querySelectorAll('.dia'), 0.97);
  if (animar) entrarSecao(calendario);
}

function abrirDia(data) {
  modo = 'dia';
  dia = data;
  radiosModo.forEach((radio) => { radio.checked = radio.value === 'dia'; });
  carregarAulas();
}

function textoSaldo(pacote) {
  if (!pacote) return '';
  let saldo = `saldo ${pacote.saldo} ${pacote.saldo === 1 ? 'aula' : 'aulas'}`;
  if (pacote.saldo <= 0) saldo = 'pacote acabou';
  else if (pacoteVencido(pacote, hoje())) saldo = 'pacote venceu'; // RN07
  return `Pacote de ${pacote.quantidade_aulas} · ${saldo}`;
}

// No agendamento, o prazo também aparece: "Pacote de 8 · saldo 3 aulas · vence 05/12"
function textoParaAgendar(pacote) {
  if (!pacote) return '';
  return `${textoSaldo(pacote)} · vence ${formatarData(vencimentoDoPacote(pacote.inicio)).slice(0, 5)}`;
}

function itemDaAula(aula, pacote, acabando) {
  const nome = pacote?.aluno_nome ?? 'Aluno';
  const hora = formatarHora(aula.inicio);

  return el('li', { class: `aula aula-${aula.status}`, 'data-id': aula.id },
    el('button', { type: 'button', class: 'aula-principal', onclick: () => abrirFormulario(aula) },
      el('span', { class: 'aula-hora' },
        el('strong', {}, hora),
        el('span', {}, formatarHora(aula.fim)),
      ),
      el('span', { class: 'item-texto' },
        el('span', { class: 'item-titulo' }, nome),
        // CA07: saldo do pacote, em destaque quando está acabando
        el('span', { class: acabando.has(pacote?.id) ? 'item-detalhe saldo-acabando' : 'item-detalhe' },
          textoSaldo(pacote)),
      ),
      aula.status === 'agendada' ? null : el('span', { class: `selo selo-${aula.status}` }, SITUACOES[aula.status]),
    ),
    aula.status === 'agendada'
      ? el('div', { class: 'aula-acoes' },
        botaoSituacao(aula, nome, hora, 'dada', 'Dada', 'botao-primario'),
        botaoSituacao(aula, nome, hora, 'falta', 'Falta', 'botao-secundario'),
        botaoSituacao(aula, nome, hora, 'cancelada', 'Cancelada', 'botao-fantasma'),
      )
      : null,
  );
}

function botaoSituacao(aula, nome, hora, situacao, texto, classe) {
  return el('button', {
    type: 'button',
    class: `botao botao-pequeno ${classe}`,
    'aria-label': `${texto}: aula de ${nome} às ${hora}`,
    onclick: () => mudarSituacao(aula, situacao),
  }, texto);
}

// ---------- Botões dada / falta / cancelada (RF05 e RN04) ----------
async function mudarSituacao(aula, nova) {
  const pacote = pacotePorId(aula.pacote_id);
  const semSaldo = validarUsoDeAula(aula.status, nova, pacote?.saldo ?? 0); // RN04 na tela (CA04)
  if (semSaldo) return avisar(semSaldo, 'erro');

  const { error } = await supabase.from('aulas').update({ status: nova }).eq('id', aula.id);
  if (error) return avisar(traduzirErroBanco(error), 'erro');

  const nome = pacote?.aluno_nome ?? 'do aluno';
  avisar(nova === 'cancelada' ? `Aula de ${nome} cancelada.` : `Aula de ${nome} marcada como ${nova}.`);
  await atualizarDepoisDeMudar(aula.id);
}

// O saldo do pacote muda junto com a aula: recarrega os pacotes e depois a agenda
async function atualizarDepoisDeMudar(destaqueId = null) {
  await carregarPacotes();
  await carregarAulas({ destaqueId, animar: !destaqueId });
}

// ---------- Trocar de dia ----------
function irPara(novoDia) {
  if (!novoDia || novoDia === dia) return;
  dia = novoDia;
  carregarAulas();
}

// As setas andam um dia na lista e um mês no calendário
function andar(passo) {
  if (modo === 'dia') return irPara(somarDias(dia, passo));
  mes = somarMeses(mes, passo);
  carregarAulas();
}

botaoAnterior.addEventListener('click', () => andar(-1));
botaoSeguinte.addEventListener('click', () => andar(1));
botaoHoje.addEventListener('click', () => {
  if (modo === 'dia') return irPara(hoje());
  dia = hoje();
  mes = dia.slice(0, 7);
  carregarAulas();
});
campoDia.addEventListener('change', () => irPara(campoDia.value));

// Dia (lista) ou Mês (calendário)
radiosModo.forEach((radio) => radio.addEventListener('change', () => {
  modo = radio.value;
  mes = dia.slice(0, 7);
  carregarAulas();
}));

// ---------- Agendar e editar (RF04) ----------
const autocompletarAluno = criarAutocompletar(campos.aluno, {
  opcoes: () => pacotesParaAgendar(listaDePacotes(), listaDeAlunos())
    .sort((a, b) => a.aluno_nome.localeCompare(b.aluno_nome, 'pt-BR'))
    .map((p) => ({ id: p.id, nome: p.aluno_nome, detalhe: textoParaAgendar(p) })),
  textoVazio: 'Nenhum aluno ativo com pacote e saldo',
  aoEscolher: (opcao) => mostrarInfoPacote(opcao.id),
});

function mostrarInfoPacote(pacoteId) {
  const pacote = pacotePorId(pacoteId);
  infoPacote.hidden = !pacote;
  if (pacote) infoPacote.textContent = textoParaAgendar(pacote);
}

// Hoje: a próxima hora cheia. Outro dia: 8h.
function horaSugerida() {
  if (dia !== hoje()) return '08:00';
  const proxima = Math.min(new Date().getHours() + 1, 22);
  return `${String(proxima).padStart(2, '0')}:00`;
}

// Aula antiga com duração fora da lista (ex.: 75 min) ganha a própria opção
function escolherDuracao(minutos) {
  const valor = String(minutos);
  if (![...campos.duracao.options].some((o) => o.value === valor)) {
    campos.duracao.append(el('option', { value: valor }, `${minutos} minutos`));
  }
  campos.duracao.value = valor;
}

function abrirFormulario(aula = null) {
  if (!aula && !pacotesParaAgendar(listaDePacotes(), listaDeAlunos()).length) {
    return avisar('Para agendar, crie antes um pacote com saldo para um aluno ativo.', 'erro');
  }
  editando = aula;
  tituloDialogo.textContent = aula ? 'Editar aula' : 'Agendar aula';

  if (aula) {
    // na edição o aluno (e o pacote) ficam travados
    autocompletarAluno.definir({ id: aula.pacote_id, nome: pacotePorId(aula.pacote_id)?.aluno_nome ?? '' });
    mostrarInfoPacote(aula.pacote_id);
  } else {
    autocompletarAluno.limpar();
    infoPacote.hidden = true;
  }
  campos.aluno.disabled = Boolean(aula);
  campos.data.value = aula ? dataISO(new Date(aula.inicio)) : dia;
  campos.hora.value = aula ? formatarHora(aula.inicio) : horaSugerida();
  escolherDuracao(aula ? duracaoEmMinutos(aula.inicio, aula.fim) : 60);
  campos.situacao.value = aula?.status ?? 'agendada';
  campoSituacao.hidden = !aula;
  botaoExcluir.hidden = !aula;
  mostrarAviso(erroForm, '');

  abrirDialogo(dialogo);
  (aula ? campos.hora : campos.aluno).focus();
}

botaoAgendar.addEventListener('click', () => abrirFormulario());

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const aula = editando;
  const pacoteId = aula ? aula.pacote_id : autocompletarAluno.valor();
  if (!pacoteId) {
    mostrarAviso(erroForm, 'Escolha um aluno da lista.');
    return campos.aluno.focus();
  }
  if (!campos.data.value || !campos.hora.value) {
    return mostrarAviso(erroForm, 'Informe a data e o horário da aula.');
  }

  const inicio = juntarDataHora(campos.data.value, campos.hora.value).toISOString();
  const fim = calcularFim(inicio, Number(campos.duracao.value));
  const status = aula ? campos.situacao.value : 'agendada';

  // RN04 na tela: virar "dada" ou "falta" precisa de saldo
  const semSaldo = validarUsoDeAula(aula?.status ?? 'agendada', status, pacotePorId(pacoteId)?.saldo ?? 0);
  if (semSaldo) return mostrarAviso(erroForm, semSaldo);

  // RN07 na tela: a aula não pode ficar depois do vencimento do pacote (CA12)
  const foraDoPrazo = validarPrazoDaAula({ inicio, status }, pacotePorId(pacoteId));
  if (foraDoPrazo) return mostrarAviso(erroForm, foraDoPrazo);

  travarBotoes(form, true);
  // RN03 na tela: busca as aulas que cruzam este horário (o banco também barra)
  const { data: vizinhas, error: erroBusca } = await supabase
    .from('aulas')
    .select('id, inicio, fim, status')
    .lt('inicio', fim)
    .gt('fim', inicio);
  const conflito = erroBusca ? null : validarConflito({ id: aula?.id, inicio, fim, status }, vizinhas);
  if (conflito) {
    travarBotoes(form, false);
    return mostrarAviso(erroForm, conflito); // CA03
  }

  const { data, error } = aula
    ? await supabase.from('aulas').update({ inicio, fim, status }).eq('id', aula.id).select('id').single()
    : await supabase.from('aulas').insert({ pacote_id: pacoteId, inicio, fim, status }).select('id').single();
  travarBotoes(form, false);
  if (error) return mostrarAviso(erroForm, traduzirErroBanco(error));

  fecharDialogo(dialogo);
  avisar(aula ? 'Aula atualizada.' : 'Aula agendada.');
  dia = campos.data.value; // a agenda (lista ou calendário) vai para o dia da aula salva
  mes = dia.slice(0, 7);
  await atualizarDepoisDeMudar(data.id);
});

// ---------- Excluir ----------
botaoExcluir.addEventListener('click', () => {
  if (editando) excluirAula(editando);
});

async function excluirAula(aula) {
  const nome = pacotePorId(aula.pacote_id)?.aluno_nome ?? 'do aluno';
  const contava = aula.status === 'dada' || aula.status === 'falta';
  const confirmou = await confirmar({
    titulo: `Excluir a aula de ${nome} às ${formatarHora(aula.inicio)}?`,
    mensagem: contava
      ? 'Esta aula já contava no saldo: ao excluir, ela volta para o pacote. Não dá para desfazer.'
      : 'A aula sai da agenda. Não dá para desfazer.',
    botao: 'Excluir',
    perigo: true,
  });
  if (!confirmou) return;

  travarBotoes(form, true);
  const { error } = await supabase.from('aulas').delete().eq('id', aula.id);
  travarBotoes(form, false);
  if (error) return mostrarAviso(erroForm, traduzirErroBanco(error));

  fecharDialogo(dialogo);
  avisar('Aula excluída.');
  await atualizarDepoisDeMudar();
}
