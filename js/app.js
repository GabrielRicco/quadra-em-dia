// Login, sair, navegação entre abas e carga dos dados de cada aba.
// Cada aba tem o próprio arquivo (js/alunos.js, ...).
import { supabase } from './supabase.js';
import { carregarAlunos, limparAlunos } from './alunos.js';
import { carregarPacotes, limparPacotes } from './pacotes.js';
import { carregarAulas, limparAulas } from './hoje.js';
import { mostrarResumo, limparResumo } from './resumo.js';
import {
  entrarLogin, entrarSecao, entrarEmCascata, encherBarras, aoPressionar,
} from './animacoes.js';

const telaLogin = document.getElementById('tela-login');
const telaApp = document.getElementById('tela-app');
const formLogin = document.getElementById('form-login');
const campoEmail = document.getElementById('email');
const campoSenha = document.getElementById('senha');
const loginErro = document.getElementById('login-erro');
const botaoCriarConta = document.getElementById('botao-criar-conta');
const botaoSair = document.getElementById('botao-sair');
const usuarioEmail = document.getElementById('usuario-email');

// ---------- Mensagens de erro compreensíveis (P8) ----------
function traduzirErroAuth(erro) {
  const msg = (erro?.message ?? '').toLowerCase();
  if (msg.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('already registered')) return 'Já existe uma conta com este e-mail. Use "Entrar".';
  if (msg.includes('password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (msg.includes('email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (msg.includes('invalid') && msg.includes('email')) return 'Digite um e-mail válido.';
  if (msg.includes('failed to fetch')) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  return 'Não foi possível entrar agora. Tente de novo em instantes.';
}

function validarCampos() {
  if (!campoEmail.value.trim() || !campoEmail.checkValidity()) return 'Digite um e-mail válido.';
  if (campoSenha.value.length < 6) return 'A senha precisa ter pelo menos 6 caracteres.';
  return null;
}

function mostrarErroLogin(texto) {
  loginErro.textContent = texto; // textContent, nunca innerHTML
}

function travarBotoes(travar) {
  formLogin.querySelectorAll('button').forEach((b) => { b.disabled = travar; });
}

// ---------- Entrar e criar conta ----------
formLogin.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const invalido = validarCampos();
  if (invalido) return mostrarErroLogin(invalido);

  travarBotoes(true);
  mostrarErroLogin('');
  const { error } = await supabase.auth.signInWithPassword({
    email: campoEmail.value.trim(),
    password: campoSenha.value,
  });
  travarBotoes(false);
  if (error) mostrarErroLogin(traduzirErroAuth(error));
});

botaoCriarConta.addEventListener('click', async () => {
  const invalido = validarCampos();
  if (invalido) return mostrarErroLogin(invalido);

  travarBotoes(true);
  mostrarErroLogin('');
  const { data, error } = await supabase.auth.signUp({
    email: campoEmail.value.trim(),
    password: campoSenha.value,
  });
  travarBotoes(false);
  if (error) return mostrarErroLogin(traduzirErroAuth(error));
  if (!data.session) {
    mostrarErroLogin('Conta criada. Abra o link que enviamos para o seu e-mail e depois entre.');
  }
});

botaoSair.addEventListener('click', () => supabase.auth.signOut());

// ---------- Abas ----------
const ABAS = ['hoje', 'alunos', 'pacotes', 'resumo'];

function mostrarAba() {
  const aba = ABAS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'hoje';
  document.querySelectorAll('[data-secao]').forEach((secao) => {
    secao.hidden = secao.dataset.secao !== aba;
  });
  document.querySelectorAll('[data-aba]').forEach((link) => {
    if (link.dataset.aba === aba) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  const secao = document.querySelector(`[data-secao="${aba}"]`);
  entrarSecao(secao);
  entrarEmCascata(secao.querySelectorAll('.lista > li'));
  encherBarras(secao.querySelectorAll('.barra-cheia'));
  // números contam e os gráficos aparecem (o Chart.js só baixa aqui); só com alguém logado
  if (aba === 'resumo' && usuarioAtual) mostrarResumo();
}

window.addEventListener('hashchange', mostrarAba);

// ---------- Dados de cada aba ----------
// A agenda usa os pacotes (nome do aluno e saldo): eles carregam antes
async function carregarDados() {
  await Promise.all([carregarAlunos(), carregarPacotes()]);
  await carregarAulas();
}

// O Resumo carrega sozinho quando os pacotes chegam (evento "pacotes-mudaram")
function limparDados() {
  limparAlunos();
  limparPacotes();
  limparAulas();
  limparResumo();
}

// ---------- Troca de tela conforme a sessão ----------
// undefined no começo, para o primeiro evento (com ou sem sessão) sempre desenhar a tela
let usuarioAtual;

function atualizarTela(sessao) {
  // A renovação do token também dispara este evento: se a pessoa é a mesma, nada muda
  const novoUsuario = sessao?.user.id ?? null;
  if (novoUsuario === usuarioAtual) return;
  usuarioAtual = novoUsuario;

  const logado = Boolean(sessao);
  telaLogin.hidden = logado;
  telaApp.hidden = !logado;
  limparDados();

  if (logado) {
    usuarioEmail.textContent = sessao.user.email;
    mostrarAba();
    // Fora do callback de autenticação: chamar o Supabase dentro dele pode travar a sessão
    setTimeout(carregarDados, 0);
  } else {
    formLogin.reset();
    entrarLogin(document.querySelector('.login-cartao'), document.querySelector('.login .marca-bola'));
  }
}

// Botões e abas afundam um pouco ao toque (os itens das listas são ligados em cada aba)
aoPressionar(document.querySelectorAll('.botao, .botao-icone, .abas a'));

supabase.auth.onAuthStateChange((_evento, sessao) => atualizarTela(sessao));
