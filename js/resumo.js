// Aba Resumo · RF08: recebido no mês, total a receber e alunos com saldo de 2 aulas ou menos,
// mais dois gráficos (Chart.js) com a tabela de valores de cada um.
// O Chart.js só é baixado quando a aba Resumo abre pela primeira vez.
// Recarrega sozinho quando os pacotes mudam (evento "pacotes-mudaram"), inclusive ao entrar.
import { supabase } from './supabase.js';
import {
  resumoFinanceiro, recebidoPorMes, alunosParaRenovar, aulasPorSemana, traduzirErroBanco,
} from './regras.js';
import {
  dataISO, somarDias, inicioDaSemana, limitesDoDia, formatarReais, formatarReaisInteiros,
  nomeDoMes, rotuloMes, formatarData, iniciais,
} from './formato.js';
import { el, avisar } from './tela.js';
import { contarAte, animacaoDosGraficos } from './animacoes.js';
import { listaDePacotes } from './pacotes.js';
import { listaDeAlunos } from './alunos.js';

const URL_CHART_JS = 'https://cdn.jsdelivr.net/npm/chart.js@4.6.1/auto/+esm';
const MESES = 6;
const SEMANAS = 8;

const secao = document.getElementById('secao-resumo');
const subtitulo = document.getElementById('resumo-subtitulo');
const kpi = {
  recebidoRotulo: document.getElementById('kpi-recebido-rotulo'),
  recebido: document.getElementById('kpi-recebido'),
  recebidoDetalhe: document.getElementById('kpi-recebido-detalhe'),
  receber: document.getElementById('kpi-receber'),
  receberDetalhe: document.getElementById('kpi-receber-detalhe'),
  renovar: document.getElementById('kpi-renovar'),
  renovarDetalhe: document.getElementById('kpi-renovar-detalhe'),
};
const canvasRecebido = document.getElementById('grafico-recebido');
const canvasAulas = document.getElementById('grafico-aulas');
const tabelaRecebido = document.getElementById('tabela-recebido');
const tabelaAulas = document.getElementById('tabela-aulas');
const listaRenovar = document.getElementById('lista-renovar');
const renovarVazio = document.getElementById('renovar-vazio');

let aulasRecentes = []; // dadas e faltas das últimas semanas
let dados = null;       // último resumo calculado
let Chart = null;       // classe do Chart.js, depois de baixada
const graficos = { recebido: null, aulas: null };

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const maiuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);
const cor = (token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim();

// ---------- Dados ----------
document.addEventListener('pacotes-mudaram', () => carregarResumo());

export async function carregarResumo() {
  const hoje = dataISO(new Date());
  const { de } = limitesDoDia(somarDias(inicioDaSemana(hoje), -(SEMANAS - 1) * 7));
  const { data, error } = await supabase
    .from('aulas')
    .select('inicio, status')
    .in('status', ['dada', 'falta'])
    .gte('inicio', de);
  if (error) return avisar(traduzirErroBanco(error), 'erro');
  aulasRecentes = data;
  desenhar();
}

// Ao sair ou trocar de conta, nada da conta anterior fica na tela (CA09)
export function limparResumo() {
  aulasRecentes = [];
  dados = null;
  graficos.recebido?.destroy();
  graficos.aulas?.destroy();
  graficos.recebido = null;
  graficos.aulas = null;
  for (const elemento of [kpi.recebido, kpi.receber, kpi.renovar, kpi.recebidoDetalhe,
    kpi.receberDetalhe, kpi.renovarDetalhe, subtitulo]) elemento.textContent = '';
  tabelaRecebido.replaceChildren();
  tabelaAulas.replaceChildren();
  listaRenovar.replaceChildren();
  renovarVazio.hidden = true;
}

function calcular() {
  const hoje = dataISO(new Date());
  const pacotes = listaDePacotes();
  return {
    mes: hoje.slice(0, 7),
    financeiro: resumoFinanceiro(pacotes, hoje),
    renovar: alunosParaRenovar(pacotes, listaDeAlunos()),
    meses: recebidoPorMes(pacotes, hoje, MESES),
    semanas: aulasPorSemana(aulasRecentes, hoje, SEMANAS),
  };
}

// ---------- Desenhar ----------
function desenhar() {
  dados = calcular();
  const { mes, financeiro, renovar, meses, semanas } = dados;

  subtitulo.textContent = `${maiuscula(nomeDoMes(mes))} de ${mes.slice(0, 4)}`;
  kpi.recebidoRotulo.textContent = `Recebido em ${nomeDoMes(mes)}`;
  mostrarNumeros(false);
  kpi.recebidoDetalhe.textContent = financeiro.pagosNoMes
    ? `${plural(financeiro.pagosNoMes, 'pacote pago', 'pacotes pagos')} neste mês`
    : 'Nenhum pagamento neste mês';
  kpi.receberDetalhe.textContent = financeiro.emAberto
    ? `${plural(financeiro.emAberto, 'pacote', 'pacotes')} em aberto`
    : 'Todos os pacotes estão pagos';
  kpi.renovarDetalhe.textContent = renovar.length === 1
    ? 'aluno com 2 aulas ou menos'
    : 'alunos com 2 aulas ou menos';

  // Tabelas: o mesmo conteúdo dos gráficos, para leitor de tela e para quem não distingue cores
  tabelaRecebido.replaceChildren(...meses.map((m) =>
    el('tr', {}, el('td', {}, maiuscula(nomeDoMes(m.mes))), el('td', {}, formatarReais(m.total)))));
  tabelaAulas.replaceChildren(...semanas.map((s) =>
    el('tr', {},
      el('td', {}, `Semana de ${formatarData(s.semana).slice(0, 5)}`),
      el('td', {}, String(s.dadas)),
      el('td', {}, String(s.faltas)))));

  renovarVazio.hidden = renovar.length > 0;
  listaRenovar.replaceChildren(...renovar.map(itemRenovar));

  if (!secao.hidden) desenharGraficos();
}

// animar = true quando a aba abre: os números sobem de zero
function mostrarNumeros(animar) {
  if (!dados) return;
  const { financeiro, renovar } = dados;
  const valores = [
    [kpi.recebido, financeiro.recebidoNoMes, formatarReais],
    [kpi.receber, financeiro.aReceber, formatarReais],
    [kpi.renovar, renovar.length, (v) => String(Math.round(v))],
  ];
  for (const [elemento, valor, formatar] of valores) {
    if (animar) contarAte(elemento, valor, formatar);
    else elemento.textContent = formatar(valor);
  }
}

function itemRenovar(pacote) {
  const usadasPct = Math.min(100, Math.round((pacote.usadas / pacote.quantidade_aulas) * 100));
  const barraCheia = el('span', { class: 'barra-cheia' });
  barraCheia.style.width = `${usadasPct}%`;
  const saldo = pacote.saldo <= 0 ? 'pacote acabou' : `saldo ${plural(pacote.saldo, 'aula', 'aulas')}`;
  return el('li', { class: 'medidor' },
    el('span', { class: 'avatar', 'aria-hidden': 'true' }, iniciais(pacote.aluno_nome)),
    el('span', { class: 'item-texto' },
      el('span', { class: 'item-titulo' }, pacote.aluno_nome),
      el('span', { class: 'saldo saldo-acabando' },
        el('span', { class: 'barra', 'aria-hidden': 'true' }, barraCheia),
        el('span', {}, `${saldo} · ${pacote.usadas} de ${pacote.quantidade_aulas} usadas`),
      ),
    ),
  );
}

// Chamado pelo app.js quando a aba Resumo abre
export function mostrarResumo() {
  mostrarNumeros(true);
  desenharGraficos();
}

// ---------- Gráficos (Chart.js) ----------
async function carregarChartJs() {
  if (!Chart) {
    Chart = (await import(URL_CHART_JS)).default;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.font.size = 12;
    Chart.defaults.color = cor('--cor-suave');
  }
  return Chart;
}

// Grade e eixos discretos (linha fina, sólida), legenda própria em HTML, tooltip escuro
function opcoesComuns(formatarValor, empilhado = false) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: animacaoDosGraficos(),
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: cor('--cor-texto'),
        padding: 10,
        cornerRadius: 8,
        boxPadding: 4,
        callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatarValor(ctx.parsed.y)}` },
      },
    },
    scales: {
      x: {
        stacked: empilhado,
        grid: { display: false },
        border: { color: cor('--cor-borda-forte') },
      },
      y: {
        stacked: empilhado,
        beginAtZero: true,
        grid: { color: cor('--cor-borda'), lineWidth: 1 },
        border: { display: false },
        ticks: { maxTicksLimit: 5, precision: 0 },
      },
    },
  };
}

// Só o bloco de cima de cada pilha tem a ponta arredondada (4px); a base é reta
function ehTopoDaPilha(ctx) {
  const acima = ctx.chart.data.datasets.slice(ctx.datasetIndex + 1);
  return acima.every((ds) => !ds.data[ctx.dataIndex]);
}

async function desenharGraficos() {
  if (!dados) return;
  let ChartJs;
  try {
    ChartJs = await carregarChartJs();
  } catch {
    avisar('Não foi possível carregar os gráficos agora. Os valores estão em "Ver os valores".', 'erro');
    return;
  }
  const { meses, semanas } = dados;

  // Recebido por mês: uma série só, uma cor só, sem legenda (o título diz o que é)
  const dadosRecebido = {
    labels: meses.map((m) => rotuloMes(m.mes)),
    datasets: [{
      label: 'Recebido',
      data: meses.map((m) => m.total),
      backgroundColor: cor('--cor-grafico-1'),
      maxBarThickness: 24,
      borderRadius: { topLeft: 4, topRight: 4 },
    }],
  };
  if (graficos.recebido) {
    graficos.recebido.data = dadosRecebido;
    graficos.recebido.update();
  } else {
    const opcoes = opcoesComuns(formatarReais);
    opcoes.scales.y.ticks.callback = (valor) => formatarReaisInteiros(valor);
    opcoes.plugins.tooltip.callbacks.title = (itens) =>
      maiuscula(nomeDoMes(dados.meses[itens[0].dataIndex].mes));
    graficos.recebido = new ChartJs(canvasRecebido, { type: 'bar', data: dadosRecebido, options: opcoes });
  }

  // Aulas por semana: dadas embaixo, faltas em cima, 2px de fundo branco separando os blocos
  const dadosAulas = {
    labels: semanas.map((s) => formatarData(s.semana).slice(0, 5)),
    datasets: [
      {
        label: 'Dadas',
        data: semanas.map((s) => s.dadas),
        backgroundColor: cor('--cor-grafico-1'),
        maxBarThickness: 24,
        borderRadius: (ctx) => (ehTopoDaPilha(ctx) ? { topLeft: 4, topRight: 4 } : 0),
      },
      {
        label: 'Faltas',
        data: semanas.map((s) => s.faltas),
        backgroundColor: cor('--cor-grafico-2'),
        maxBarThickness: 24,
        borderRadius: { topLeft: 4, topRight: 4 },
        borderSkipped: false,
        borderColor: cor('--cor-superficie'),
        borderWidth: (ctx) => (ctx.chart.data.datasets[0].data[ctx.dataIndex] ? { bottom: 2 } : 0),
      },
    ],
  };
  if (graficos.aulas) {
    graficos.aulas.data = dadosAulas;
    graficos.aulas.update();
  } else {
    const opcoes = opcoesComuns((n) => plural(n, 'aula', 'aulas'), true);
    opcoes.plugins.tooltip.callbacks.title = (itens) => `Semana de ${itens[0].label}`;
    graficos.aulas = new ChartJs(canvasAulas, { type: 'bar', data: dadosAulas, options: opcoes });
  }
}
