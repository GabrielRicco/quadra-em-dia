// Utilitários de tela usados por todas as abas.
// Regras do AGENTS.md:
//  - texto do usuário ou do banco NUNCA entra como HTML: el() só cria nós de texto;
//  - nunca alert(), confirm() ou prompt(): use confirmar() e avisar() daqui.

export function el(tag, atributos = {}, ...filhos) {
  const elemento = document.createElement(tag);
  for (const [nome, valor] of Object.entries(atributos)) {
    if (valor == null || valor === false) continue;
    if (nome === 'class') elemento.className = valor;
    else if (nome.startsWith('on')) elemento.addEventListener(nome.slice(2), valor);
    else elemento.setAttribute(nome, valor === true ? '' : valor);
  }
  for (const filho of filhos.flat()) {
    if (filho == null || filho === false) continue;
    elemento.append(typeof filho === 'string' ? document.createTextNode(filho) : filho);
  }
  return elemento;
}

// Mensagem de erro dentro de um formulário (área com role="alert")
export function mostrarAviso(elemento, texto) {
  elemento.textContent = texto ?? '';
}

export function travarBotoes(form, travar) {
  form.querySelectorAll('button').forEach((botao) => { botao.disabled = travar; });
}

// Qualquer botão com data-fechar fecha o <dialog> em que está
document.addEventListener('click', (evento) => {
  const botao = evento.target.closest('[data-fechar]');
  if (botao) botao.closest('dialog')?.close();
});

// ---------- Modal de confirmação ----------
const dialogoConfirmar = document.getElementById('dialogo-confirmar');
const confirmarTitulo = document.getElementById('confirmar-titulo');
const confirmarMensagem = document.getElementById('confirmar-mensagem');
const confirmarSim = document.getElementById('confirmar-sim');
const confirmarNao = document.getElementById('confirmar-nao');

confirmarSim.addEventListener('click', () => dialogoConfirmar.close('sim'));
confirmarNao.addEventListener('click', () => dialogoConfirmar.close('nao'));

// Abre o modal e devolve uma Promise: true se a pessoa confirmou.
// Esc ou "Cancelar" contam como não.
export function confirmar({ titulo, mensagem, botao = 'Confirmar', cancelar = 'Cancelar', perigo = false }) {
  confirmarTitulo.textContent = titulo;
  confirmarMensagem.textContent = mensagem;
  confirmarSim.textContent = botao;
  confirmarNao.textContent = cancelar;
  confirmarSim.className = `botao ${perigo ? 'botao-perigo' : 'botao-primario'}`;

  dialogoConfirmar.returnValue = '';
  dialogoConfirmar.showModal();
  confirmarNao.focus(); // o foco começa no caminho seguro

  return new Promise((resolve) => {
    dialogoConfirmar.addEventListener(
      'close',
      () => resolve(dialogoConfirmar.returnValue === 'sim'),
      { once: true },
    );
  });
}

// ---------- Avisos rápidos ----------
const areaAvisos = document.getElementById('avisos');

export function avisar(texto, tipo = 'ok') {
  const aviso = el('div', {
    class: tipo === 'erro' ? 'aviso aviso-erro' : 'aviso',
    role: tipo === 'erro' ? 'alert' : 'status',
  }, texto);
  areaAvisos.append(aviso);
  setTimeout(() => aviso.remove(), tipo === 'erro' ? 7000 : 3500);
}
