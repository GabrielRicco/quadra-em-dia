# Horário fixo ao criar o pacote · plano de implementação

> **Para quem for executar:** siga as tarefas na ordem, marcando os passos (`- [ ]`). Desenho aprovado: `docs/desenhos/2026-11-19-horario-fixo.md`.

**Objetivo:** ao criar um pacote, escolher opcionalmente os dias da semana e o horário de cada dia, e já criar as aulas agendadas (RF10, CA15, CA16).

**Arquitetura:** tudo na tela, sem mudança no banco. Duas funções puras em `js/regras.js` calculam as aulas e os conflitos; `js/pacotes.js` monta a seção do modal, consulta as aulas já marcadas no prazo do pacote e salva o pacote e depois as aulas num envio só, desfazendo o pacote se as aulas falharem. A agenda recarrega com um evento novo, `aulas-mudaram`.

**Tecnologias:** HTML, CSS e JavaScript puro (módulos ES), Supabase (supabase-js 2.45.4), `node --test`.

## Restrições globais

- Mensagens exatas do SPEC: conflito = `Já existe uma aula neste horário.`
- Nunca `alert()`, `confirm()` ou `prompt()`; texto do usuário ou do banco só com `textContent` (função `el()`).
- Cores só pelos tokens de `:root` em `style.css`.
- Teste que depende da data usa "hoje" fixo (`HOJE = '2026-11-19'`, uma quinta-feira).
- Sem biblioteca nova e sem mudança em `sql/schema.sql`.
- Commits pequenos, em português (`feat:`, `test:`, `docs:`), terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Tarefa 1: funções puras do horário fixo (regras e testes)

**Arquivos:**
- Modificar: `js/formato.js` (nova função `diaDaSemana`)
- Modificar: `js/regras.js` (imports, `MENSAGENS.horarioFaltando`, `gerarAulasDoPadrao`, `conflitosDoPadrao`, `avisoDoPadrao`)
- Testar: `testes/regras.test.js` (7 testes novos)

**Interfaces:**
- Produz `diaDaSemana(data: 'AAAA-MM-DD') → 0..6` (0 = domingo), em `formato.js`.
- Produz `gerarAulasDoPadrao({ compra: 'AAAA-MM-DD', quantidade: number, horarios: [{ dia: 0..6, hora: 'HH:MM' }], duracao: minutos, agora: Date }) → { aulas: [{ inicio: Date, fim: Date }], naoCouberam: number }`.
- Produz `conflitosDoPadrao(aulasNovas, aulasExistentes) → Array<aulaExistente | null>`, com o mesmo tamanho de `aulasNovas`.
- Produz `avisoDoPadrao(cabem: number, quantidade: number, vencimento: 'AAAA-MM-DD') → string | null`.
- Produz `MENSAGENS.horarioFaltando = 'Informe o horário de cada dia escolhido.'`.

- [ ] **Passo 1: escrever os testes que falham**

Em `testes/regras.test.js`, acrescentar `gerarAulasDoPadrao, conflitosDoPadrao, avisoDoPadrao,` à lista importada de `../js/regras.js` (depois de `validarPrazoDaAula,`), e logo abaixo desse import:

```js
import { dataISO, formatarHora } from '../js/formato.js';
```

No fim do arquivo:

```js
// ---------- RF10 · horário fixo ao criar o pacote ----------
// Quinta-feira, 19/11/2026, 10h no fuso do aparelho
const AGORA = new Date(2026, 10, 19, 10, 0);
const TER_7H = { dia: 2, hora: '07:00' };
const QUI_18H = { dia: 4, hora: '18:00' };
const quando = ({ aulas }) => aulas.map((a) => `${dataISO(a.inicio)} ${formatarHora(a.inicio)}`);
const padrao = (opcoes) =>
  gerarAulasDoPadrao({ compra: HOJE, quantidade: 8, duracao: 60, agora: AGORA, ...opcoes });

test('RF10 · gera as aulas nos dias e horários de cada dia, em ordem', () => {
  const r = padrao({ quantidade: 4, horarios: [TER_7H, QUI_18H] });
  assert.deepEqual(quando(r), ['2026-11-19 18:00', '2026-11-24 07:00', '2026-11-26 18:00', '2026-12-01 07:00']);
  assert.equal(formatarHora(r.aulas[0].fim), '19:00');
  assert.equal(r.naoCouberam, 0);
});

test('RF10 · para ao completar a quantidade; sem dia marcado não gera nada', () => {
  assert.deepEqual(quando(padrao({ quantidade: 2, horarios: [TER_7H, QUI_18H] })), ['2026-11-19 18:00', '2026-11-24 07:00']);
  assert.deepEqual(padrao({ horarios: [] }), { aulas: [], naoCouberam: 0 });
});

test('RF10 e CA16 · para no vencimento (inclusive) e conta as que não couberam', () => {
  const r = padrao({ horarios: [{ dia: 6, hora: '08:00' }] }); // sábados; vence em 19/12, um sábado
  assert.deepEqual(quando(r), ['2026-11-21 08:00', '2026-11-28 08:00', '2026-12-05 08:00', '2026-12-12 08:00', '2026-12-19 08:00']);
  assert.equal(r.naoCouberam, 3);
});

test('RF10 · compra registrada com data passada começa de hoje', () => {
  const r = padrao({ compra: '2026-11-10', horarios: [QUI_18H] }); // vence em 10/12, uma quinta
  assert.deepEqual(quando(r), ['2026-11-19 18:00', '2026-11-26 18:00', '2026-12-03 18:00', '2026-12-10 18:00']);
  assert.equal(r.naoCouberam, 4);
});

test('RF10 · hoje só entra se o horário ainda não passou', () => {
  const r = padrao({ quantidade: 2, horarios: [QUI_18H], agora: new Date(2026, 10, 19, 18, 30) });
  assert.deepEqual(quando(r), ['2026-11-26 18:00', '2026-12-03 18:00']);
});

test('CA15 · conflito com aula já marcada; cancelada não conta e aula colada não conflita', () => {
  const novas = padrao({ quantidade: 3, horarios: [TER_7H, QUI_18H] }).aulas; // 19/11 18h, 24/11 7h, 26/11 18h
  const em = (dia, hora, min = 0) => new Date(2026, 10, dia, hora, min).toISOString();
  const existentes = [
    { id: 'colada', pacote_id: 'x', inicio: em(19, 17), fim: em(19, 18), status: 'dada' },
    { id: 'cancelada', pacote_id: 'x', inicio: em(24, 7), fim: em(24, 8), status: 'cancelada' },
    { id: 'heitor', pacote_id: 'x', inicio: em(26, 17, 30), fim: em(26, 18, 30), status: 'agendada' },
  ];
  assert.deepEqual(conflitosDoPadrao(novas, existentes).map((a) => a?.id ?? null), [null, null, 'heitor']);
});

test('CA16 · aviso quando o horário fixo não cabe até o vencimento', () => {
  assert.equal(avisoDoPadrao(5, 8, '2026-12-19'),
    'Só cabem 5 das 8 aulas até o vencimento (19/12). As outras 3 você agenda à mão ou elas se perdem.');
  assert.equal(avisoDoPadrao(1, 2, '2026-12-19'),
    'Só cabe 1 das 2 aulas até o vencimento (19/12). A outra você agenda à mão ou ela se perde.');
  assert.equal(avisoDoPadrao(0, 4, '2026-12-19'), 'Nenhuma aula deste horário cabe até o vencimento (19/12).');
  assert.equal(avisoDoPadrao(8, 8, '2026-12-19'), null);
  assert.equal(avisoDoPadrao(0, NaN, '2026-12-19'), null); // quantidade ainda não digitada
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npm test`
Esperado: FALHA, porque `gerarAulasDoPadrao` não é exportada por `js/regras.js` (SyntaxError no import).

- [ ] **Passo 3: implementar**

Em `js/formato.js`, logo depois de `inicioDaSemana`:

```js
// 'AAAA-MM-DD' → dia da semana (0 = domingo), sem o fuso mudar o dia
export function diaDaSemana(data) {
  return diaLocal(data).getDay();
}
```

Em `js/regras.js`, trocar o import por:

```js
import {
  normalizarTexto, limitesDoDia, inicioDaSemana, somarDias, dataISO,
  juntarDataHora, diaDaSemana, formatarData,
} from './formato.js';
```

Em `MENSAGENS`, depois de `prazoPacote`:

```js
  // horário fixo do pacote (RF10): dia marcado sem horário
  horarioFaltando: 'Informe o horário de cada dia escolhido.',
```

Depois de `validarPrazoDaAula`:

```js
// ---------- RF10 · horário fixo ao criar o pacote ----------
// horarios: [{ dia, hora }], com dia da semana (0 = domingo) e hora 'HH:MM'; duracao em minutos;
// agora: o instante atual (recebido para o teste não depender do relógio).
// As aulas começam na data da compra (ou hoje, se a compra foi registrada com data passada; hoje só
// se o horário ainda não passou) e vão até completar a quantidade ou chegar o vencimento (RN07).
export function gerarAulasDoPadrao({ compra, quantidade, horarios, duracao, agora }) {
  const aulas = [];
  if (!horarios.length || !(quantidade > 0)) return { aulas, naoCouberam: 0 };
  const hoje = dataISO(agora);
  const vencimento = vencimentoDoPacote(compra);
  for (let dia = compra > hoje ? compra : hoje; dia <= vencimento && aulas.length < quantidade; dia = somarDias(dia, 1)) {
    const horario = horarios.find((h) => h.dia === diaDaSemana(dia));
    if (!horario) continue;
    const inicio = juntarDataHora(dia, horario.hora);
    if (inicio > agora) aulas.push({ inicio, fim: new Date(inicio.getTime() + duracao * 60_000) });
  }
  return { aulas, naoCouberam: quantidade - aulas.length };
}

// CA15 · para cada aula nova, a aula já marcada (não cancelada) que bate com ela (RN03), ou null
export function conflitosDoPadrao(aulasNovas, aulasExistentes) {
  const ativas = aulasExistentes.filter((a) => a.status !== 'cancelada');
  return aulasNovas.map((nova) => ativas.find((a) => horariosSobrepostos(nova, a)) ?? null);
}

// CA16 · aviso quando o horário fixo não cabe até o vencimento; null quando cabe tudo
export function avisoDoPadrao(cabem, quantidade, vencimento) {
  const faltam = quantidade - cabem;
  if (!(faltam > 0)) return null;
  const ate = `até o vencimento (${formatarData(vencimento).slice(0, 5)})`;
  if (cabem === 0) return `Nenhuma aula deste horário cabe ${ate}.`;
  const cabe = cabem === 1 ? 'Só cabe 1' : `Só cabem ${cabem}`;
  const resto = faltam === 1
    ? 'A outra você agenda à mão ou ela se perde.'
    : `As outras ${faltam} você agenda à mão ou elas se perdem.`;
  return `${cabe} das ${quantidade} aulas ${ate}. ${resto}`;
}
```

(`horariosSobrepostos` está mais abaixo no mesmo arquivo; por ser `function`, já existe quando `conflitosDoPadrao` roda.)

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npm test` e depois `TZ=UTC npm test`
Esperado: `pass 42`, `fail 0` nas duas.

- [ ] **Passo 5: commit**

```bash
git add js/formato.js js/regras.js testes/regras.test.js
git commit -m "feat: regras do horário fixo do pacote (RF10, CA15, CA16) com testes"
```

---

### Tarefa 2: seção "Horário fixo" no modal do pacote

**Arquivos:**
- Modificar: `index.html` (modal `#dialogo-pacote`, depois do bloco "Data da compra / Forma de pagamento")
- Modificar: `style.css` (regra `.visualmente-oculto, .chip input` e estilos novos no fim da seção do modal do pacote)
- Modificar: `js/pacotes.js` (imports, seção nova, `abrirFormulario`, envio do formulário)
- Modificar: `js/hoje.js` (ouvir `aulas-mudaram`)

**Interfaces:**
- Consome da Tarefa 1: `gerarAulasDoPadrao`, `conflitosDoPadrao`, `avisoDoPadrao`, `MENSAGENS.conflito`, `MENSAGENS.horarioFaltando`.
- Produz o evento `aulas-mudaram` no `document`, disparado depois que o pacote com horário fixo é salvo.

- [ ] **Passo 1: HTML da seção**

Em `index.html`, logo depois do `</div>` que fecha o `campos-lado-a-lado` de "Data da compra" e "Forma de pagamento" (antes de `<p id="pacote-saldo"`):

```html
        <!-- RF10 · horário fixo (só ao criar o pacote): já agenda as aulas -->
        <div id="pacote-padrao" class="padrao" role="group" aria-labelledby="padrao-titulo">
          <p id="padrao-titulo" class="padrao-titulo">Horário fixo <span class="opcional">(opcional: já agenda as aulas)</span></p>
          <div class="dias-semana">
            <label class="dia-semana"><input type="checkbox" name="padrao-dia" value="1"><span>Seg</span></label>
            <label class="dia-semana"><input type="checkbox" name="padrao-dia" value="2"><span>Ter</span></label>
            <label class="dia-semana"><input type="checkbox" name="padrao-dia" value="3"><span>Qua</span></label>
            <label class="dia-semana"><input type="checkbox" name="padrao-dia" value="4"><span>Qui</span></label>
            <label class="dia-semana"><input type="checkbox" name="padrao-dia" value="5"><span>Sex</span></label>
            <label class="dia-semana"><input type="checkbox" name="padrao-dia" value="6"><span>Sáb</span></label>
            <label class="dia-semana"><input type="checkbox" name="padrao-dia" value="0"><span>Dom</span></label>
          </div>
          <div id="padrao-horas" class="padrao-horas"></div>
          <div id="padrao-campo-duracao" class="campo" hidden>
            <label for="padrao-duracao">Duração de cada aula</label>
            <select id="padrao-duracao">
              <option value="30">30 minutos</option>
              <option value="45">45 minutos</option>
              <option value="60" selected>1 hora</option>
              <option value="90">1 hora e meia</option>
              <option value="120">2 horas</option>
            </select>
          </div>
          <div id="padrao-previa" class="historico padrao-previa" hidden>
            <p id="padrao-resumo" class="historico-titulo" aria-live="polite"></p>
            <p id="padrao-aviso" class="aviso-padrao" aria-live="polite" hidden></p>
            <ul id="padrao-lista"></ul>
          </div>
        </div>
```

- [ ] **Passo 2: CSS**

Em `style.css`, trocar `.visualmente-oculto, .chip input {` por `.visualmente-oculto, .chip input, .dia-semana input {`. Depois da regra `.historico li + li { … }`, acrescentar:

```css
/* Horário fixo do pacote (RF10) */
.padrao { display: grid; gap: 0.75rem; padding-top: 1rem; border-top: 1px solid var(--cor-borda); }
.padrao-titulo { margin: 0; font-size: 0.875rem; font-weight: 500; }
.dias-semana { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.dia-semana { position: relative; cursor: pointer; }
.dia-semana span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.9rem;
  min-height: 2.5rem;
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--cor-borda);
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--cor-texto);
  background: var(--cor-neutra-clara);
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;
}
.dia-semana:hover span { border-color: var(--cor-borda-forte); }
.dia-semana input:checked + span { color: var(--cor-sobre-verde); background: var(--cor-primaria); border-color: var(--cor-primaria); }
.dia-semana input:focus-visible + span { outline: 2px solid var(--cor-primaria); outline-offset: 2px; }
.padrao-horas { display: grid; gap: 0.5rem; }
.padrao-hora { display: grid; grid-template-columns: 5.5rem 1fr; align-items: center; gap: 0.75rem; }
.padrao-hora input[aria-invalid="true"] { border-color: var(--cor-erro); }
.padrao-previa li.conflito { flex-wrap: wrap; color: var(--cor-erro); background: var(--cor-erro-clara); }
.padrao-previa .conflito-texto { flex-basis: 100%; font-size: 0.8rem; font-weight: 500; }
.aviso-padrao {
  margin: 0;
  padding: 0.6rem 0.8rem;
  font-size: 0.875rem;
  color: var(--cor-alerta);
  background: var(--cor-alerta-clara);
  border-radius: var(--raio-pequeno);
}
```

- [ ] **Passo 3: JavaScript da seção (`js/pacotes.js`)**

Trocar os imports de `./regras.js` e `./formato.js` por:

```js
import {
  validarPacote, validarPagamento, validarReducaoAulas,
  pacotesAcabando, filtrarPacotes, traduzirErroBanco,
  pacoteVencido, vencimentoDoPacote,
  gerarAulasDoPadrao, conflitosDoPadrao, avisoDoPadrao, MENSAGENS,
} from './regras.js';
import {
  lerValorEmReais, formatarReais, formatarNumero, formatarData, dataISO, iniciais,
  formatarDiaCurto, formatarHora, SITUACOES, limitesDoDia,
} from './formato.js';
```

Antes da seção `// ---------- Excluir ----------`, acrescentar:

```js
// ---------- Horário fixo ao criar o pacote (RF10, CA15 e CA16) ----------
const secaoPadrao = document.getElementById('pacote-padrao');
const diasPadrao = [...document.querySelectorAll('input[name="padrao-dia"]')];
const horasPadrao = document.getElementById('padrao-horas');
const campoDuracaoPadrao = document.getElementById('padrao-campo-duracao');
const duracaoPadrao = document.getElementById('padrao-duracao');
const previaPadrao = document.getElementById('padrao-previa');
const resumoPadrao = document.getElementById('padrao-resumo');
const avisoPadrao = document.getElementById('padrao-aviso');
const listaPadrao = document.getElementById('padrao-lista');
const NOMES_DOS_DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const horaDoDia = new Map(); // dia da semana → 'HH:MM' digitado (fica guardado ao desmarcar e marcar de novo)
let periodo = { compra: null, aulas: [], busca: Promise.resolve() }; // aulas já marcadas no prazo do pacote

// Na ordem da tela: segunda a domingo
function diasEscolhidos() {
  return diasPadrao.filter((caixa) => caixa.checked).map((caixa) => Number(caixa.value));
}

function horariosEscolhidos() {
  return diasEscolhidos().map((dia) => ({ dia, hora: horaDoDia.get(dia) ?? '' }));
}

function limparPadrao() {
  diasPadrao.forEach((caixa) => { caixa.checked = false; });
  horaDoDia.clear();
  duracaoPadrao.value = '60';
  periodo = { compra: null, aulas: [], busca: Promise.resolve() };
  desenharHorasDoPadrao();
  atualizarPrevia();
}

// Uma linha "Terça [07:00]" por dia marcado
function desenharHorasDoPadrao() {
  horasPadrao.replaceChildren(...diasEscolhidos().map((dia) => {
    const id = `padrao-hora-${dia}`;
    return el('div', { class: 'padrao-hora' },
      el('label', { for: id }, NOMES_DOS_DIAS[dia]),
      el('input', {
        id,
        type: 'time',
        value: horaDoDia.get(dia) ?? '',
        required: true,
        'data-dia': dia,
        oninput: (evento) => {
          horaDoDia.set(dia, evento.target.value);
          atualizarPrevia();
        },
      }),
    );
  }));
}

// Aulas não canceladas entre o começo do padrão e o vencimento, para achar conflito (RN03).
// Busca uma vez por data da compra; devolve a promessa para o envio poder esperar.
function carregarAulasDoPeriodo() {
  const compra = campos.inicio.value || dataISO(new Date());
  if (periodo.compra === compra) return periodo.busca;
  const atual = { compra, aulas: [] };
  atual.busca = buscarAulasDoPeriodo(compra).then((aulas) => {
    atual.aulas = aulas;
    if (periodo === atual) atualizarPrevia();
  });
  periodo = atual;
  return atual.busca;
}

async function buscarAulasDoPeriodo(compra) {
  const hoje = dataISO(new Date());
  const { de } = limitesDoDia(compra > hoje ? compra : hoje);
  const { ate } = limitesDoDia(vencimentoDoPacote(compra));
  const { data, error } = await supabase
    .from('aulas')
    .select('id, pacote_id, inicio, fim, status')
    .neq('status', 'cancelada')
    .lt('inicio', ate)
    .gt('fim', de);
  if (error) {
    avisar(traduzirErroBanco(error), 'erro');
    return []; // sem a lista, o banco ainda recusa o conflito ao salvar
  }
  return data;
}

// null quando nenhum dia foi marcado (pacote sem horário fixo) ou quando o pacote está sendo editado
function calcularPadrao() {
  const horarios = horariosEscolhidos();
  if (editando || !horarios.length) return null;
  const compra = campos.inicio.value || dataISO(new Date());
  const quantidade = Number(campos.quantidade.value);
  const { aulas, naoCouberam } = gerarAulasDoPadrao({
    compra,
    quantidade,
    horarios: horarios.filter((h) => h.hora),
    duracao: Number(duracaoPadrao.value),
    agora: new Date(),
  });
  return {
    compra,
    quantidade,
    aulas,
    naoCouberam,
    semHora: horarios.filter((h) => !h.hora).map((h) => h.dia),
    conflitos: conflitosDoPadrao(aulas, periodo.compra === compra ? periodo.aulas : []),
  };
}

// A lista "Vai agendar…" acompanha cada mudança; conflito aparece na hora (CA15)
function atualizarPrevia() {
  const padrao = calcularPadrao();
  campoDuracaoPadrao.hidden = !padrao;
  previaPadrao.hidden = !padrao;
  if (!padrao) return;

  const vencimento = vencimentoDoPacote(padrao.compra);
  const qtdOk = Number.isInteger(padrao.quantidade) && padrao.quantidade >= 1;
  const mostrar = !padrao.semHora.length && qtdOk;
  const n = padrao.aulas.length;

  if (padrao.semHora.length) resumoPadrao.textContent = MENSAGENS.horarioFaltando;
  else if (!qtdOk) resumoPadrao.textContent = 'Informe a quantidade de aulas para ver as datas.';
  else resumoPadrao.textContent = `Vai agendar ${n} ${n === 1 ? 'aula' : 'aulas'} até o vencimento (${formatarData(vencimento).slice(0, 5)}):`;

  const aviso = mostrar ? avisoDoPadrao(n, padrao.quantidade, vencimento) : null;
  avisoPadrao.hidden = !aviso;
  avisoPadrao.textContent = aviso ?? '';

  const nomeDoAluno = (pacoteId) => pacotes.find((p) => p.id === pacoteId)?.aluno_nome ?? 'outro aluno';
  listaPadrao.replaceChildren(...(mostrar ? padrao.aulas : []).map((aula, i) => {
    const outra = padrao.conflitos[i];
    const quando = el('span', {}, `${formatarDiaCurto(aula.inicio)} · ${formatarHora(aula.inicio)}`);
    if (!outra) return el('li', {}, quando);
    return el('li', { class: 'conflito' }, quando,
      el('span', { class: 'conflito-texto' },
        `${MENSAGENS.conflito} Aula de ${nomeDoAluno(outra.pacote_id)}, ${formatarHora(outra.inicio)}–${formatarHora(outra.fim)}.`));
  }));
  listaPadrao.hidden = !mostrar || !n;

  // O campo de horário do dia com conflito fica marcado como inválido
  const diasComConflito = new Set(padrao.aulas.filter((_, i) => padrao.conflitos[i]).map((a) => a.inicio.getDay()));
  horasPadrao.querySelectorAll('input').forEach((campo) => {
    if (diasComConflito.has(Number(campo.dataset.dia))) campo.setAttribute('aria-invalid', 'true');
    else campo.removeAttribute('aria-invalid');
  });
}

diasPadrao.forEach((caixa) => caixa.addEventListener('change', () => {
  const dia = Number(caixa.value);
  // O dia marcado depois do primeiro já vem com o horário do primeiro
  if (caixa.checked && !horaDoDia.get(dia)) {
    const primeiro = horariosEscolhidos().find((h) => h.dia !== dia && h.hora);
    if (primeiro) horaDoDia.set(dia, primeiro.hora);
  }
  desenharHorasDoPadrao();
  if (caixa.checked) carregarAulasDoPeriodo();
  atualizarPrevia();
}));

campos.quantidade.addEventListener('input', atualizarPrevia);
duracaoPadrao.addEventListener('change', atualizarPrevia);
campos.inicio.addEventListener('change', () => {
  if (diasEscolhidos().length) carregarAulasDoPeriodo();
  atualizarPrevia();
});
```

Em `abrirFormulario`, depois da linha `campoPagoEm.hidden = !campos.pago.checked;`:

```js
  // RF10 · horário fixo só ao criar o pacote
  secaoPadrao.hidden = Boolean(pacote);
  limparPadrao();
```

No envio do formulário, trocar o trecho a partir de `if (invalido) return mostrarAviso(erroForm, invalido);` até o fim do `form.addEventListener('submit', …)` por:

```js
  if (invalido) return mostrarAviso(erroForm, invalido);

  // RF10 · horário fixo: dia sem horário ou conflito (CA15) não deixam salvar nada
  let padrao = null;
  if (!pacote && diasEscolhidos().length) {
    await carregarAulasDoPeriodo(); // garante a lista de aulas já marcadas antes de checar conflito
    padrao = calcularPadrao();
    atualizarPrevia();
    const campoHora = (dia) => document.getElementById(`padrao-hora-${dia}`);
    if (padrao.semHora.length) {
      mostrarAviso(erroForm, MENSAGENS.horarioFaltando);
      return campoHora(padrao.semHora[0]).focus();
    }
    const primeiroConflito = padrao.conflitos.findIndex(Boolean);
    if (primeiroConflito >= 0) {
      mostrarAviso(erroForm, MENSAGENS.conflito);
      return campoHora(padrao.aulas[primeiroConflito].inicio.getDay()).focus();
    }
  }

  travarBotoes(form, true);
  const { data, error } = pacote
    ? await supabase.from('pacotes').update(dados).eq('id', pacote.id).select('id').single()
    : await supabase.from('pacotes').insert(dados).select('id').single();
  if (error) {
    travarBotoes(form, false);
    return mostrarAviso(erroForm, traduzirErroBanco(error));
  }

  // As aulas do horário fixo vão num envio só: entram todas ou nenhuma.
  // Se falharem, o pacote recém-criado é apagado, para nada ficar pela metade.
  const agendadas = padrao?.aulas.length ?? 0;
  if (agendadas) {
    const { error: erroAulas } = await supabase.from('aulas').insert(padrao.aulas.map((aula) => ({
      pacote_id: data.id,
      inicio: aula.inicio.toISOString(),
      fim: aula.fim.toISOString(),
      status: 'agendada',
    })));
    if (erroAulas) {
      await supabase.from('pacotes').delete().eq('id', data.id);
      travarBotoes(form, false);
      return mostrarAviso(erroForm, traduzirErroBanco(erroAulas));
    }
  }
  travarBotoes(form, false);

  fecharDialogo(dialogo);
  if (pacote) avisar('Pacote atualizado.');
  else if (agendadas) avisar(`Pacote salvo e ${agendadas} ${agendadas === 1 ? 'aula agendada' : 'aulas agendadas'}.`);
  else avisar('Pacote criado.');
  await carregarPacotes(data.id);
  if (agendadas) document.dispatchEvent(new Event('aulas-mudaram'));
});
```

- [ ] **Passo 4: a agenda recarrega (`js/hoje.js`)**

Depois do bloco `document.addEventListener('pacotes-mudaram', …)`:

```js
// Aulas criadas fora da agenda (horário fixo do pacote, RF10): busca de novo
document.addEventListener('aulas-mudaram', () => {
  if (carregou) carregarAulas({ animar: false });
});
```

- [ ] **Passo 5: testes automáticos**

Rodar: `npm test`
Esperado: `pass 42`, `fail 0` (nada de tela quebra os testes das regras).

- [ ] **Passo 6: teste no navegador (Chrome sem janela, conta de teste)**

Com o servidor em http://localhost:8000, um script fora do repositório (na pasta temporária do agente) entra com a conta de teste e confere:
1. "Novo pacote" mostra a seção "Horário fixo"; abrir um pacote existente não mostra.
2. Aluno de demonstração, 4 aulas, R$ 200, terça e quinta: a quinta já vem com o horário da terça; a lista "Vai agendar 4 aulas…" aparece em ordem.
3. Escolher, de propósito, o dia e horário de uma aula que já existe: a linha fica vermelha na hora com "Já existe uma aula neste horário. Aula de …", e Salvar mostra "Já existe uma aula neste horário." sem criar o pacote (conferir no banco que não há pacote novo).
4. Pacote de 8 aulas só num dia da semana: aparece o aviso amarelo "Só cabem … das 8 aulas…".
5. Mudar para um horário livre e salvar: aviso "Pacote salvo e 4 aulas agendadas."; no banco, o pacote novo com as 4 aulas agendadas; na agenda (modo Mês), as aulas aparecem.
6. Celular (390 px): sem rolagem para os lados no modal.
7. Limpeza: apagar o pacote criado (as aulas vão junto) e conferir que a conta voltou ao que era.

- [ ] **Passo 7: commit**

```bash
git add index.html style.css js/pacotes.js js/hoje.js
git commit -m "feat: horário fixo ao criar o pacote já agenda as aulas (RF10)"
```

---

### Tarefa 3: SPEC, README, AGENTS e IA.md

**Arquivos:**
- Modificar: `SPEC.md` (RF10 depois do RF09; CA15 e CA16 depois do CA14)
- Modificar: `README.md` (linha de Pacotes)
- Modificar: `AGENTS.md` (estrutura)
- Modificar: `IA.md` (linha nova)

- [ ] **Passo 1: SPEC**

Depois da linha do RF09:

```markdown
- **RF10** · Ao criar um pacote, escolher opcionalmente os dias da semana e o horário de cada dia; as aulas do pacote são agendadas na hora, até completar a quantidade ou chegar o vencimento. Depois de criadas, são aulas normais, que podem ser mudadas uma a uma. _(Pedido do usuário real em 19/11.)_
```

Depois da linha do CA14:

```markdown
| CA15 | Monto o horário fixo do pacote num dia e horário que já tem aula | Na hora, aquela data aparece com "Já existe uma aula neste horário.", e o pacote não é salvo até eu mudar o horário. |
| CA16 | Monto um horário fixo que não cabe até o vencimento | Aviso "Só cabem N das M aulas até o vencimento (dd/mm)…", e ao salvar são agendadas as N que cabem. |
```

- [ ] **Passo 2: README**

Na linha que começa com `- **Pacotes:**`, trocar `pacotes de aulas por aluno, com saldo,` por `pacotes de aulas por aluno, com horário fixo opcional que já agenda as aulas, saldo,`.

- [ ] **Passo 3: AGENTS**

Na estrutura: a linha de `js/pacotes.js` passa a ser `aba Pacotes: cadastro, horário fixo que já agenda as aulas, marcar pago, busca, filtros e aulas do pacote`; o comentário dos eventos passa a ser `(as abas conversam por eventos: "alunos-mudaram", "pacotes-mudaram" e "aulas-mudaram")`; e, antes de `package.json`, acrescentar:

```
docs/desenhos/      desenho aprovado de cada funcionalidade nova, antes do código
docs/planos/        plano de implementação de cada desenho
```

- [ ] **Passo 4: IA.md**

Linha nova no fim da tabela, com o pedido (horário fixo, pedido do pai), o que foi entregue (desenho e plano antes do código, as perguntas feitas, as duas funções com 7 testes, a seção do modal, o teste no Chrome com limpeza) e o que o usuário decidiu (cada dia com seu horário; começar da compra; erro na hora, em vez de pular o dia, que foi a recomendação do agente; não cabe = avisa e salva o que cabe; caminho só na tela), terminando com `_Aguardando eu testar no navegador._`

- [ ] **Passo 5: commit**

```bash
git add SPEC.md README.md AGENTS.md IA.md docs/planos/2026-11-19-horario-fixo.md
git commit -m "docs: RF10, CA15 e CA16 no SPEC; horário fixo no README, AGENTS e IA.md"
```
