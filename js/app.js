// Incremento 1: login, sair e navegação entre abas.
// Os cadastros (alunos, pacotes, aulas) chegam nos próximos incrementos.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_CHAVE } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_CHAVE);

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
}

window.addEventListener('hashchange', mostrarAba);

function mostrarDataDeHoje() {
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  document.getElementById('titulo-hoje').textContent = `Hoje, ${hoje}`;
}

// ---------- Troca de tela conforme a sessão ----------
function atualizarTela(sessao) {
  const logado = Boolean(sessao);
  telaLogin.hidden = logado;
  telaApp.hidden = !logado;
  if (logado) {
    usuarioEmail.textContent = sessao.user.email;
    mostrarDataDeHoje();
    mostrarAba();
  } else {
    formLogin.reset();
  }
}

supabase.auth.onAuthStateChange((_evento, sessao) => atualizarTela(sessao));
