# Desenho · Horário fixo ao criar o pacote

Pedido do usuário real (meu pai) em 19/11: ao criar o pacote, já escolher os dias e horários das aulas do aluno e deixar as aulas agendadas. É um padrão para facilitar, não uma obrigação: depois de criadas, as aulas podem ser mudadas uma a uma.

Decidido com o usuário em 19/11, com aprovação para mudar o SPEC (RF10, CA15 e CA16).

## Regras

- **Opcional.** Sem nenhum dia marcado, o pacote é criado como antes.
- **Cada dia da semana marcado tem o próprio horário.** O dia marcado depois do primeiro já vem com o horário do primeiro dia preenchido; e, se ele marcar os dias antes de digitar, os dias ainda vazios seguem o horário digitado até ele mudar um deles à mão (ajuste feito no teste no navegador). Uma duração só para todas as aulas (padrão: 1 hora, as mesmas opções da aula).
- **Começo:** o primeiro dia do padrão a partir da data da compra. Se a compra foi registrada com data passada, começa de hoje. Hoje só entra se o horário ainda não passou.
- **Fim:** quando completa a quantidade de aulas do pacote ou quando chega o vencimento (data da compra + 30 dias, inclusive, RN07), o que vier primeiro.
- **Conflito com aula já marcada** (RN03): a linha aparece em vermelho na hora, com a mensagem "Já existe uma aula neste horário." e o nome do aluno da outra aula. Enquanto houver conflito, Salvar não cria nada e o foco vai para o primeiro erro; ele resolve mudando o horário daquele dia ou desmarcando o dia. Aula que termina exatamente quando a outra começa não é conflito.
- **Não cabe nos 30 dias:** aviso amarelo, sem bloquear: "Só cabem 5 das 8 aulas até o vencimento (19/12). As outras 3 você agenda à mão ou elas se perdem." Salva as que cabem.
- **Só ao criar.** Ao editar um pacote que já existe, a seção não aparece. O padrão não fica guardado.
- As aulas geradas são aulas agendadas normais: não descontam saldo (o saldo só desconta dada e falta) e passam pelas mesmas regras do banco (RN03, RN07).

## Tela

No modal "Novo pacote", abaixo da data da compra, a seção "Horário fixo (opcional)":

```
[Seg] [Ter●] [Qua] [Qui●] [Sex] [Sáb] [Dom]
  Terça    [07:00]
  Quinta   [18:00]
  Duração  [1 hora ▾]

Vai agendar 8 aulas até o vencimento (19/12):
  qui 19/11 · 18:00
  ter 24/11 · 07:00
  qui 26/11 · 18:00   ✕ Já existe uma aula neste horário (Heitor Campos)
  ...
```

(Exemplo com compra em 19/11, uma quinta, antes das 18h.)

A lista é atualizada ao vivo quando mudam os dias, os horários, a duração, a quantidade ou a data da compra. Depois de salvar: "Pacote salvo e 8 aulas agendadas."

## Como funciona por dentro

Sem mudança no banco e sem migração.

- `js/regras.js`, funções puras:
  - `gerarAulasDoPadrao({ compra, quantidade, horarios, duracao, agora })`: `horarios` é uma lista de `{ dia, hora }` (dia da semana de 0 a 6, hora "HH:MM"). Devolve `{ aulas, naoCouberam }`, com as aulas em ordem (`inicio` e `fim` como `Date`).
  - `conflitosDoPadrao(aulasNovas, aulasExistentes)`: para cada aula nova, a aula existente não cancelada que se sobrepõe a ela, ou `null`.
- `js/pacotes.js`: a seção do modal. Busca uma vez as aulas não canceladas do período (de novo se a data da compra mudar), usa o nome do aluno dos pacotes já carregados, monta a lista, bloqueia o Salvar com conflito e salva assim: insere o pacote, depois todas as aulas num único envio (tudo ou nada). Se as aulas falharem, apaga o pacote recém-criado e mostra o erro traduzido.
- `index.html` e `style.css`: a seção, os botões dos dias (no estilo do "Dia / Mês"), a lista, as linhas com erro e o aviso.

## Testes

Novos testes em `testes/regras.test.js`, com "hoje" fixo:

1. Gera nos dias e horários de cada dia, em ordem.
2. Para na quantidade do pacote.
3. Para no vencimento e conta as que não couberam.
4. Compra com data passada começa de hoje.
5. Hoje com horário já passado não entra.
6. Detecta conflito com aula existente; aula cancelada não conta.
7. Aula colada na outra (uma termina quando a outra começa) não é conflito.

No navegador (Chrome sem janela, conta de teste): criar um pacote com horário fixo para um aluno de demonstração, conferir as aulas na agenda, forçar um conflito, e apagar tudo o que foi criado. Depois, o teste do usuário.

## SPEC

- **RF10** · Ao criar um pacote, escolher opcionalmente dias da semana e horário de cada dia; as aulas do pacote são agendadas automaticamente até completar a quantidade ou chegar o vencimento.
- **CA15** · Monto o horário fixo num dia e horário que já tem aula → na hora aparece "Já existe uma aula neste horário." naquela data, e o pacote não é salvo até eu mudar o horário.
- **CA16** · Horário fixo que não cabe até o vencimento → aviso "Só cabem N das M aulas até o vencimento (dd/mm)…", e ao salvar são agendadas as N que cabem.
