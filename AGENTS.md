# AGENTS.md · Quadra em Dia

Leia o `SPEC.md` antes de qualquer tarefa. Ele manda; este arquivo diz como trabalhar.

## Stack
- HTML, CSS e JavaScript puro (módulos ES). Sem framework, sem build.
- Supabase (Postgres + Auth) via `@supabase/supabase-js@2.45.4` carregado do jsDelivr.
- Bibliotecas aprovadas em 12/11, também pelo jsDelivr e com versão fixa: Motion (`motion@14.7.1`) para animações e Chart.js (`chart.js@4.6.1`) para os gráficos do Resumo. Qualquer outra: perguntar antes.
- Publicação: GitHub Pages, a partir da branch `main`, pasta raiz.
- Testes: `node --test` (nativo do Node 20+), sem dependências.

## Estrutura
```
index.html          tela de login e app
style.css
js/config.js        URL do projeto e chave PUBLICÁVEL do Supabase
js/supabase.js      cria o cliente do Supabase (único lugar)
js/regras.js        regras de negócio, filtros e tradução dos erros do banco, como funções puras (sem DOM, sem rede)
js/formato.js       reais e datas no formato brasileiro, leitura de valor digitado (funções puras)
js/tela.js          utilitários de tela: el() monta elementos só com texto, confirmar() e avisar()
js/animacoes.js     todas as animações (Motion); respeita prefers-reduced-motion
js/autocompletar.js campo com sugestões (combobox acessível) para escolher aluno; use no lugar de <select> longo
js/app.js           login, abas e carga dos dados ao entrar
js/alunos.js        aba Alunos (uma aba por arquivo)
js/pacotes.js       aba Pacotes: cadastro, marcar pago, busca, filtros e aulas do pacote
js/hoje.js          aba Hoje: agenda por dia (lista) ou por mês (calendário), agendar/editar/excluir aula, botões dada/falta/cancelada
js/resumo.js        aba Resumo: números do mês, gráficos (Chart.js baixado só ao abrir a aba) e tabela de cada gráfico
                    (as abas conversam por eventos: "alunos-mudaram" e "pacotes-mudaram")
sql/schema.sql      tabelas, constraints, triggers e políticas de RLS
testes/regras.test.js
testes/formato.test.js
package.json        "type": "module" e script "test"
```

## Comandos
- Rodar localmente: `python -m http.server 8000` e abrir http://localhost:8000
- Rodar os testes: `npm test` (equivale a `node --test`, que acha todos os arquivos *.test.js)
- CI: `.github/workflows/testes.yml` roda `npm test` no GitHub Actions a cada push e PR (Node 24, fuso America/Sao_Paulo). Push com teste quebrando deixa o selo do README vermelho.

## Convenções
- Toda regra de negócio fica em `js/regras.js` e é usada pela tela; o banco repete a mesma regra.
- Mensagens de erro são exatamente as dos critérios de aceitação do SPEC.
- Texto vindo do usuário ou do banco é mostrado SEMPRE com `textContent`. Nunca `innerHTML` com dados.
- Nunca `alert()`, `confirm()` ou `prompt()` do navegador. Confirmação usa `confirmar()` (modal próprio) e aviso usa `avisar()`, ambos de `js/tela.js`.
- Visual moderno e minimalista, com topo e faixa do título no verde da quadra: cores, raios e sombras só pelos tokens em `:root` do `style.css`.
- Gráficos: cores só pelos tokens `--cor-grafico-*` (validadas para daltonismo e contraste; trocar só depois de validar de novo), uma série = uma cor e sem legenda, toda série com legenda em HTML, todo gráfico com a tabela de valores em "Ver os valores".
- Animação só pelas funções de `js/animacoes.js`, que não animam nada para quem ativou `prefers-reduced-motion`. Modal abre e fecha com `abrirDialogo()` e `fecharDialogo()`, nunca `showModal()`/`close()` direto.
- Ao fim de cada pedido, o agente atualiza o `IA.md` com uma linha: data, o que foi pedido, o que foi entregue e o que o usuário recusou ou mudou, com o motivo que ele deu. Não inventar avaliação que o usuário não fez; o que ainda não foi testado fica marcado como "aguardando teste".
- Datas no banco em `date`; valores em `numeric(10,2)`.
- Commits pequenos, em português, no formato `feat:`, `fix:`, `test:`, `docs:`.

## O agente NÃO pode
- Colocar a chave secreta (`sb_secret_...` ou `service_role`) em qualquer arquivo.
- Desativar RLS ou criar política com `using (true)` para escrita.
- Alterar `sql/schema.sql`, apagar arquivos ou mudar o SPEC sem parar e perguntar antes.
- Adicionar bibliotecas novas sem perguntar.
- Dizer que algo "está pronto" sem que os testes passem e sem o passo de teste no navegador.
