// Todas as animações do app, com a biblioteca Motion (motion.dev) pelo jsDelivr.
// Quem pediu ao sistema menos movimento (prefers-reduced-motion) não vê animação:
// o elemento aparece ou some na hora.
import { animate, stagger, press } from 'https://cdn.jsdelivr.net/npm/motion@14.7.1/+esm';

const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');
const celular = window.matchMedia('(max-width: 40rem)');

const MOLA = { type: 'spring', bounce: 0.22, visualDuration: 0.35 };
const MOLA_TOQUE = { type: 'spring', stiffness: 900, damping: 35 };

function semMovimento() {
  return reduzirMovimento.matches;
}

// ---------- Entradas ----------
export function entrarLogin(cartao, bola) {
  if (semMovimento()) return;
  animate(cartao, { opacity: [0, 1], y: [24, 0] }, { type: 'spring', bounce: 0.2, visualDuration: 0.5 });
  // a bolinha da marca quica duas vezes
  animate(bola, { y: [0, -14, 0, -6, 0] }, { duration: 0.9, delay: 0.3, ease: 'easeOut' });
}

export function entrarSecao(secao) {
  if (semMovimento() || !secao) return;
  animate(secao, { opacity: [0, 1], y: [10, 0] }, { duration: 0.3, ease: 'easeOut' });
}

// Itens de uma lista entram um depois do outro
export function entrarEmCascata(elementos) {
  if (semMovimento() || !elementos.length) return;
  animate(elementos, { opacity: [0, 1], y: [12, 0] }, { duration: 0.35, ease: 'easeOut', delay: stagger(0.035) });
}

// Número sobe de 0 até o valor (cartões do Resumo); formatar(v) devolve o texto
export function contarAte(elemento, valor, formatar) {
  if (semMovimento()) {
    elemento.textContent = formatar(valor);
    return;
  }
  animate(0, valor, {
    duration: 0.8,
    ease: 'easeOut',
    onUpdate: (atual) => { elemento.textContent = formatar(atual); },
  });
}

// Animação dos gráficos do Chart.js: barras crescem da base; nenhuma com menos movimento
export function animacaoDosGraficos() {
  return semMovimento() ? false : { duration: 600, easing: 'easeOutQuart' };
}

// Lista de sugestões do autocompletar desce rapidinho
export function mostrarLista(lista) {
  if (semMovimento()) return;
  animate(lista, { opacity: [0, 1], y: [-6, 0] }, { duration: 0.15, ease: 'easeOut' });
}

// Barras de saldo enchem da esquerda para a direita
export function encherBarras(barras) {
  if (semMovimento() || !barras.length) return;
  animate(barras, { scaleX: [0, 1] }, { duration: 0.6, ease: 'easeOut', delay: stagger(0.035, { startDelay: 0.1 }) });
}

// Pisca em verde-claro o item que acabou de ser salvo
export function destacar(elemento) {
  if (!elemento || semMovimento()) return;
  animate(elemento, { backgroundColor: ['#d9ebe1', 'rgba(217, 235, 225, 0)'] }, { duration: 1.6, ease: 'easeOut' })
    // devolve o fundo para o CSS, senão o :hover deixa de funcionar
    .then(() => elemento.style.removeProperty('background-color'));
}

// ---------- Modais ----------
export function abrirDialogo(dialogo) {
  dialogo.showModal();
  if (semMovimento()) return;
  // As duas formas definem opacidade, tamanho e posição: se a janela mudou de largura depois de
  // um modal fechar, nada do fechamento anterior (opacidade 0, encolhido) fica valendo.
  const quadros = celular.matches
    ? { opacity: [1, 1], scale: [1, 1], y: ['100%', '0%'] } // no celular, sobe de baixo
    : { opacity: [0, 1], scale: [0.94, 1], y: [10, 0] };
  animate(dialogo, quadros, MOLA);
}

export async function fecharDialogo(dialogo, valor) {
  if (!dialogo.open) return;
  if (!semMovimento()) {
    const quadros = celular.matches ? { y: '100%' } : { opacity: 0, scale: 0.97 };
    await animate(dialogo, quadros, { duration: 0.16, ease: 'easeIn' });
  }
  dialogo.close(valor);
  dialogo.style.removeProperty('opacity');
  dialogo.style.removeProperty('transform');
}

// ---------- Avisos rápidos ----------
export function mostrarAvisoAnimado(aviso) {
  if (semMovimento()) return;
  animate(aviso, { opacity: [0, 1], y: [20, 0], scale: [0.95, 1] }, MOLA);
}

export async function esconderAvisoAnimado(aviso) {
  if (!semMovimento()) await animate(aviso, { opacity: 0, y: 10 }, { duration: 0.2 });
  aviso.remove();
}

// ---------- Toque ----------
// O elemento afunda um pouco ao ser pressionado e volta com mola
export function aoPressionar(elementos, escala = 0.96) {
  if (semMovimento()) return;
  press(elementos, (elemento) => {
    animate(elemento, { scale: escala }, MOLA_TOQUE);
    return () => animate(elemento, { scale: 1 }, MOLA_TOQUE);
  });
}
