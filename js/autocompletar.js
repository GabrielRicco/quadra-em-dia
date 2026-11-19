// Campo de texto com lista de sugestões, no padrão "combobox" do WAI-ARIA, sem biblioteca.
// Digitar filtra (sem ligar para acento); setas escolhem; Enter confirma; Esc fecha a lista.
// Usado para escolher o aluno do pacote (e, depois, o da aula).
//
// HTML esperado:
//   <div class="autocompletar">
//     <input role="combobox" aria-controls="ID-DA-LISTA" aria-expanded="false" ...>
//     <ul id="ID-DA-LISTA" role="listbox" hidden></ul>
//   </div>
import { el } from './tela.js';
import { normalizarTexto, iniciais } from './formato.js';
import { mostrarLista } from './animacoes.js';

// opcoes(): devolve [{ id, nome, detalhe? }] na hora de abrir (a lista pode ter mudado)
// aoEscolher(opcao): chamado quando uma opção é confirmada
export function criarAutocompletar(input, { opcoes, textoVazio = 'Nenhum resultado', aoEscolher = () => {} }) {
  const listbox = document.getElementById(input.getAttribute('aria-controls'));
  let filtradas = [];
  let ativa = -1;       // índice da opção destacada pelas setas
  let escolhida = null; // { id, nome } confirmada

  const aberta = () => !listbox.hidden;

  function abrir() {
    if (aberta()) return;
    listbox.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    mostrarLista(listbox);
  }

  function fechar() {
    listbox.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function filtrar() {
    const termo = normalizarTexto(input.value);
    filtradas = opcoes().filter((o) => normalizarTexto(o.nome).includes(termo));
    ativa = termo && filtradas.length ? 0 : -1; // digitou algo: a 1ª já fica pronta para o Enter
    desenhar();
  }

  function desenhar() {
    const itens = filtradas.map((opcao, i) =>
      el('li', {
        id: `${listbox.id}-${i}`,
        class: 'opcao',
        role: 'option',
        'aria-selected': i === ativa ? 'true' : 'false',
        'data-indice': String(i),
      },
        el('span', { class: 'avatar avatar-pequeno', 'aria-hidden': 'true' }, iniciais(opcao.nome)),
        el('span', { class: 'opcao-texto' },
          el('span', {}, opcao.nome),
          opcao.detalhe ? el('span', { class: 'opcao-detalhe' }, opcao.detalhe) : null,
        ),
      ));
    listbox.replaceChildren(
      ...(itens.length ? itens : [el('li', { class: 'opcao-vazia', role: 'option', 'aria-disabled': 'true' }, textoVazio)]),
    );

    if (ativa >= 0) {
      input.setAttribute('aria-activedescendant', `${listbox.id}-${ativa}`);
      listbox.children[ativa].scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function mover(passo) {
    if (!filtradas.length) return;
    ativa = (ativa + passo + filtradas.length) % filtradas.length;
    desenhar();
  }

  function escolher(opcao) {
    escolhida = opcao;
    input.value = opcao.nome;
    fechar();
    aoEscolher(opcao);
  }

  input.addEventListener('focus', () => { filtrar(); abrir(); });
  input.addEventListener('click', () => { if (!aberta()) { filtrar(); abrir(); } });

  input.addEventListener('input', () => {
    escolhida = null; // mudou o texto: precisa escolher de novo
    filtrar();
    abrir();
  });

  input.addEventListener('keydown', (evento) => {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      if (aberta()) mover(1); else { filtrar(); abrir(); }
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      mover(-1);
    } else if (evento.key === 'Enter' && aberta() && ativa >= 0) {
      evento.preventDefault(); // escolhe a opção em vez de enviar o formulário
      escolher(filtradas[ativa]);
    } else if (evento.key === 'Escape' && aberta()) {
      evento.preventDefault(); // fecha só a lista, não o modal
      evento.stopPropagation();
      fechar();
    }
  });

  // Saiu do campo com o nome exato de um único aluno digitado: vale como escolhido
  input.addEventListener('blur', () => {
    if (!escolhida) {
      const termo = normalizarTexto(input.value);
      const iguais = opcoes().filter((o) => normalizarTexto(o.nome) === termo);
      if (termo && iguais.length === 1) {
        escolhida = iguais[0];
        aoEscolher(escolhida);
      }
    }
    fechar();
  });

  // pointerdown não tira o foco do campo; o click escolhe
  listbox.addEventListener('pointerdown', (evento) => evento.preventDefault());
  listbox.addEventListener('click', (evento) => {
    const item = evento.target.closest('[data-indice]');
    if (item) escolher(filtradas[Number(item.dataset.indice)]);
  });

  return {
    valor: () => escolhida?.id ?? null,
    definir(opcao) {
      escolhida = opcao;
      input.value = opcao?.nome ?? '';
      fechar();
    },
    limpar() {
      escolhida = null;
      input.value = '';
      fechar();
    },
  };
}
