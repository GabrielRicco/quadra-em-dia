// Testes dos formatos brasileiros (js/formato.js). Rodar com: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lerValorEmReais,
  formatarReais,
  formatarNumero,
  formatarData,
  dataISO,
  iniciais,
  normalizarTexto,
  formatarHora,
  juntarDataHora,
  limitesDoDia,
  somarDias,
  duracaoEmMinutos,
  rotuloDoDia,
  dataPorExtenso,
  formatarDiaCurto,
  inicioDaSemana,
  nomeDoMes,
  rotuloMes,
  formatarReaisInteiros,
} from '../js/formato.js';

test('busca ignora acento, maiúscula e espaço nas pontas', () => {
  assert.equal(normalizarTexto('  João ÁVILA '), 'joao avila');
  assert.equal(normalizarTexto(null), '');
});

test('lê valor digitado do jeito brasileiro', () => {
  assert.equal(lerValorEmReais('400'), 400);
  assert.equal(lerValorEmReais('400,50'), 400.5);
  assert.equal(lerValorEmReais('1.234,56'), 1234.56);
  assert.equal(lerValorEmReais('R$ 1.500'), 1500);
  assert.equal(lerValorEmReais('400.50'), 400.5); // ponto como decimal também vale
  assert.equal(lerValorEmReais('10,005'), 10.01); // arredonda para centavos
});

test('valor digitado inválido vira NaN (e a regra RN02 recusa)', () => {
  assert.ok(Number.isNaN(lerValorEmReais('')));
  assert.ok(Number.isNaN(lerValorEmReais('abc')));
  assert.ok(Number.isNaN(lerValorEmReais('-50')));
});

test('formata reais e datas sem mudar o dia por causa do fuso', () => {
  const espacoComum = (texto) => texto.replace(/\s/g, ' ');
  assert.equal(espacoComum(formatarReais(1234.5)), 'R$ 1.234,50');
  assert.equal(formatarNumero(400), '400,00');
  assert.equal(formatarData('2026-11-05'), '05/11/2026');
  assert.equal(dataISO(new Date(2026, 10, 12, 23, 30)), '2026-11-12');
});

test('iniciais do nome para o avatar', () => {
  assert.equal(iniciais('Ana Clara Souza'), 'AS');
  assert.equal(iniciais('  bia  '), 'B');
});

test('agenda: hora, duração e limites do dia no fuso do aparelho', () => {
  const inicio = juntarDataHora('2026-11-19', '08:30');
  assert.equal(formatarHora(inicio.toISOString()), '08:30');
  assert.equal(duracaoEmMinutos(inicio.toISOString(), new Date(2026, 10, 19, 9, 30).toISOString()), 60);

  const { de, ate } = limitesDoDia('2026-11-19');
  assert.equal(de, new Date(2026, 10, 19).toISOString());
  assert.equal(ate, new Date(2026, 10, 20).toISOString());

  assert.equal(somarDias('2026-11-30', 1), '2026-12-01');
  assert.equal(somarDias('2026-01-01', -1), '2025-12-31');
});

test('título e data do dia escritos em português', () => {
  assert.equal(rotuloDoDia('2026-11-19', '2026-11-19'), 'Hoje');
  assert.equal(rotuloDoDia('2026-11-20', '2026-11-19'), 'Amanhã');
  assert.equal(rotuloDoDia('2026-11-18', '2026-11-19'), 'Ontem');
  assert.equal(rotuloDoDia('2026-11-21', '2026-11-19'), 'Sábado');
  assert.equal(dataPorExtenso('2026-11-19'), '19 de novembro');
  assert.equal(formatarDiaCurto(new Date(2026, 10, 19, 8).toISOString()), 'qui, 19/11');
});

test('resumo: semana começa na segunda, mês por extenso e reais sem centavos no eixo', () => {
  assert.equal(inicioDaSemana('2026-11-19'), '2026-11-16'); // quinta → segunda
  assert.equal(inicioDaSemana('2026-11-22'), '2026-11-16'); // domingo ainda é da mesma semana
  assert.equal(inicioDaSemana('2026-11-16'), '2026-11-16');
  assert.equal(nomeDoMes('2026-11'), 'novembro');
  assert.equal(rotuloMes('2026-03'), 'mar');
  assert.equal(formatarReaisInteiros(1500).replace(/\s/g, ' '), 'R$ 1.500');
});
