# SPEC · Quadra em Dia

> Agenda de aulas e controle de pacotes para professores de tênis.

## 1. Problema

**Frase-teste:** O professor de tênis hoje controla aulas e pacotes pelo WhatsApp e pela agenda do celular, e perde tempo e dinheiro com esquecimento: não sabe de cabeça quais aulas tem hoje nem quanto falta para cada aluno terminar o pacote. Com o Quadra em Dia, ele abre o app e vê as aulas do dia, o saldo de cada aluno e quem precisa renovar ou pagar.

## 2. Público

- **Usuário principal:** professor de tênis autônomo que vende pacotes de aulas (nunca aula avulsa).
- **Usuário real consultado:** meu pai, professor de tênis.
- **Conversa com o usuário real:**
  - Como controla hoje: pelo WhatsApp e pela agenda do celular.
  - Quantos alunos tem: em média 20.
  - O que mais atrapalha: o esquecimento; saber quais são as aulas de hoje; saber quanto falta para cada aluno terminar o pacote.
  - Como o aluno paga: Pix.

## 3. Escopo do MVP

### Dentro
- Login com e-mail e senha; cada professor só vê os próprios dados.
- Cadastro completo de **alunos**, **pacotes** e **aulas**.
- Tela "Hoje": as aulas do dia em ordem de horário.
- Saldo de cada pacote (aulas contratadas menos aulas usadas).
- Painel com filtro, busca e resumo.

### Fora (pode virar diferencial depois)
- Lembrete automático por WhatsApp.
- Cobrança Pix automática (QR Code).
- Acesso do aluno ao sistema.
- Aulas em grupo com vários alunos na mesma aula.

## 4. Entidades

Relações: um **aluno** tem vários **pacotes**; um **pacote** tem várias **aulas**.

**Aluno** (`alunos`)
| Campo | Tipo | Observação |
|---|---|---|
| id | uuid | gerado |
| professor_id | uuid | dono do registro (usuário logado) |
| nome | texto | obrigatório |
| telefone | texto | opcional |
| nivel | texto | iniciante, intermediário ou avançado |
| ativo | sim/não | aluno que parou fica inativo |
| observacoes | texto | opcional |

**Pacote** (`pacotes`)
| Campo | Tipo | Observação |
|---|---|---|
| id | uuid | gerado |
| professor_id | uuid | dono |
| aluno_id | uuid | aluno do pacote |
| quantidade_aulas | inteiro | aulas contratadas |
| valor | número | preço do pacote |
| inicio | data | data da compra |
| pago | sim/não | |
| pago_em | data | data do Pix |
| forma_pagamento | texto | padrão "pix" |

**Aula** (`aulas`)
| Campo | Tipo | Observação |
|---|---|---|
| id | uuid | gerado |
| professor_id | uuid | dono |
| pacote_id | uuid | pacote de onde a aula sai |
| inicio | data e hora | começo da aula |
| fim | data e hora | fim da aula (duração de 15 a 240 min; padrão 60) |
| status | texto | agendada, dada, falta ou cancelada |

**Saldo do pacote** = quantidade_aulas − aulas com status *dada* ou *falta*. Aula *cancelada* não consome.

## 5. Requisitos funcionais

- **RF01** · Criar conta, entrar e sair com e-mail e senha.
- **RF02** · Criar, listar, editar e excluir alunos.
- **RF03** · Criar, listar, editar e excluir pacotes de um aluno.
- **RF04** · Agendar, listar, editar e excluir aulas de um pacote.
- **RF05** · Tela "Hoje": aulas do dia, com nome do aluno, horário e saldo do pacote, e botões "dada", "falta" e "cancelada".
- **RF06** · Marcar um pacote como pago, com data do pagamento.
- **RF07** · Painel com busca por nome do aluno e filtros (pacote pago / em aberto, saldo acabando).
- **RF08** · Resumo: total recebido no mês, total a receber (pacotes não pagos), alunos com saldo de 2 aulas ou menos.

## 6. Regras de negócio

Todas validadas **na tela** (mensagem clara) **e no banco** (constraint, trigger ou RLS).

- **RN01** · Nome do aluno tem de 2 a 80 caracteres.
- **RN02** · Pacote tem de 1 a 50 aulas e valor maior que zero e no máximo R$ 10.000,00.
- **RN03** · O professor não pode ter duas aulas não canceladas com horários sobrepostos.
- **RN04** · Uma aula só pode ser marcada como dada ou falta se o pacote ainda tiver saldo.
- **RN05** · Pacote pago precisa de data de pagamento, que não pode ser no futuro. Pacote não pago não tem data.
- **RN06** · Não é possível excluir um aluno que tem pacote não pago. A alternativa é marcá-lo como inativo.

## 7. Critérios de aceitação

| # | Dado / quando | Então (mensagem exata) |
|---|---|---|
| CA01 | Salvo aluno com nome de 1 letra | "O nome precisa ter entre 2 e 80 caracteres." |
| CA02 | Salvo pacote com 0 aulas, 60 aulas ou valor 0 | "O pacote precisa ter de 1 a 50 aulas e valor entre R$ 0,01 e R$ 10.000,00." |
| CA03 | Agendo aula às 9h00 com outra das 8h30 às 9h30 | "Já existe uma aula neste horário." |
| CA04 | Marco como dada uma aula de pacote com saldo 0 | "Este pacote não tem mais aulas. Crie um novo pacote para o aluno." |
| CA05 | Marco pacote como pago sem data ou com data futura | "Informe a data do pagamento (não pode ser no futuro)." |
| CA06 | Excluo aluno com pacote não pago | "Este aluno tem pacote não pago. Marque como inativo em vez de excluir." |
| CA07 | Pacote de 8 aulas com 6 dadas e 1 cancelada | Saldo exibido: 2 aulas, e o aluno aparece em "saldo acabando". |
| CA08 | Abro "Hoje" | Vejo só as aulas de hoje, em ordem de horário. |
| CA09 | Entro com a conta B | Não vejo nenhum dado da conta A. |
| CA10 | Chamo a API sem login, só com a chave publicável | Nenhum dado é retornado ou alterado. |
| CA11 | Abro o app no celular | Tudo usável sem rolar para os lados. |

## 8. Decisões confirmadas com o usuário real

- O pacote não vence por data: só acaba quando as aulas acabam.
- Falta do aluno sem avisar consome uma aula do pacote (status "falta").
