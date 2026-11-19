// Formatos brasileiros de dinheiro e data, e leitura do que a pessoa digita.
// Funções puras (sem DOM, sem rede), testadas em testes/formato.test.js.

const REAIS = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const NUMERO = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatarReais(valor) {
  return REAIS.format(Number(valor));
}

// 400 → "400,00" (para preencher o campo de valor na edição)
export function formatarNumero(valor) {
  return NUMERO.format(Number(valor));
}

// "400", "400,50", "1.234,56", "R$ 1.500", "400.50" → número com centavos.
// Texto que não é valor → NaN (e validarPacote recusa com a mensagem do CA02).
export function lerValorEmReais(texto) {
  let t = String(texto ?? '').trim().replace(/^R\$/i, '').replace(/\s/g, '');
  if (!t) return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); // 1.234,56
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ''); // 1.500 = mil e quinhentos
  if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
  return Math.round(Number(t) * 100) / 100;
}

// 'AAAA-MM-DD' → 'DD/MM/AAAA', sem new Date() para o fuso não mudar o dia
export function formatarData(iso) {
  if (!iso) return '';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

// Date → 'AAAA-MM-DD' no fuso do aparelho (toISOString usaria UTC e erraria à noite)
export function dataISO(data) {
  const doisDigitos = (n) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
}

// Situação da aula como aparece na tela
export const SITUACOES = { agendada: 'Agendada', dada: 'Dada', falta: 'Falta', cancelada: 'Cancelada' };

// ---------- Agenda: dia e hora no fuso do aparelho ----------
// Nomes escritos aqui (e não pelo Intl) para o resultado não depender do idioma instalado.
const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// ---------- Resumo ----------
const REAIS_INTEIROS = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0,
});

// 1500 → "R$ 1.500" (eixo dos gráficos)
export function formatarReaisInteiros(valor) {
  return REAIS_INTEIROS.format(Number(valor));
}

// '2026-11' → "novembro" / "nov"
export function nomeDoMes(anoMes) {
  return MESES[Number(anoMes.slice(5, 7)) - 1];
}
export function rotuloMes(anoMes) {
  return MESES_CURTOS[Number(anoMes.slice(5, 7)) - 1];
}

// Segunda-feira da semana do dia (a semana vai de segunda a domingo)
export function inicioDaSemana(data) {
  const diaDaSemana = diaLocal(data).getDay(); // 0 = domingo
  return somarDias(data, -((diaDaSemana + 6) % 7));
}

const doisDigitos = (n) => String(n).padStart(2, '0');

// 'AAAA-MM-DD' → Date à meia-noite local
function diaLocal(data) {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

// Instante do banco (timestamptz) → "08:30"
export function formatarHora(instante) {
  const d = new Date(instante);
  return `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
}

// Campos do formulário ('AAAA-MM-DD' e 'HH:MM') → Date no fuso do aparelho
export function juntarDataHora(data, hora) {
  const [h, min] = hora.split(':').map(Number);
  const d = diaLocal(data);
  d.setHours(h, min, 0, 0);
  return d;
}

// Começo do dia e começo do dia seguinte, em ISO, para buscar as aulas do dia
export function limitesDoDia(data) {
  const de = diaLocal(data);
  const ate = new Date(de.getFullYear(), de.getMonth(), de.getDate() + 1);
  return { de: de.toISOString(), ate: ate.toISOString() };
}

export function somarDias(data, dias) {
  const d = diaLocal(data);
  return dataISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias));
}

export function duracaoEmMinutos(inicio, fim) {
  return Math.round((new Date(fim) - new Date(inicio)) / 60_000);
}

// Título da agenda: "Hoje", "Amanhã", "Ontem" ou o dia da semana
export function rotuloDoDia(data, hoje) {
  if (data === hoje) return 'Hoje';
  if (data === somarDias(hoje, 1)) return 'Amanhã';
  if (data === somarDias(hoje, -1)) return 'Ontem';
  return DIAS[diaLocal(data).getDay()];
}

// '2026-11-19' → "19 de novembro"
export function dataPorExtenso(data) {
  const d = diaLocal(data);
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

// Instante → "qui, 19/11" (lista de aulas do pacote)
export function formatarDiaCurto(instante) {
  const d = new Date(instante);
  return `${DIAS_CURTOS[d.getDay()]}, ${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}`;
}

// "  João ÁVILA " → "joao avila": para buscar sem ligar para acento e maiúscula
export function normalizarTexto(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// "Ana Clara Souza" → "AS" (avatar das listas)
export function iniciais(nome) {
  const partes = String(nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const ultima = partes.length > 1 ? partes.at(-1)[0] : '';
  return (partes[0][0] + ultima).toUpperCase();
}
