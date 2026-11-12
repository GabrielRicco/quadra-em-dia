// Utilitários de tela usados por todas as abas.
// Regra do AGENTS.md: texto do usuário ou do banco NUNCA entra como HTML.
// el() só aceita texto como nó de texto (append de string = textContent).

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

// Mensagem de erro (vermelha) ou de sucesso (verde) numa área role="alert"
export function mostrarAviso(elemento, texto, tipo = 'erro') {
  elemento.textContent = texto ?? '';
  elemento.classList.toggle('mensagem-ok', tipo === 'ok');
}

export function travarBotoes(form, travar) {
  form.querySelectorAll('button').forEach((botao) => { botao.disabled = travar; });
}

// Qualquer botão com data-fechar fecha o <dialog> em que está
document.addEventListener('click', (evento) => {
  const botao = evento.target.closest('[data-fechar]');
  if (botao) botao.closest('dialog')?.close();
});
