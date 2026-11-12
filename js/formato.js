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

// "Ana Clara Souza" → "AS" (avatar das listas)
export function iniciais(nome) {
  const partes = String(nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const ultima = partes.length > 1 ? partes.at(-1)[0] : '';
  return (partes[0][0] + ultima).toUpperCase();
}
