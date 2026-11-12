# AGENTS.md · Quadra em Dia

Leia o `SPEC.md` antes de qualquer tarefa. Ele manda; este arquivo diz como trabalhar.

## Stack
- HTML, CSS e JavaScript puro (módulos ES). Sem framework, sem build.
- Supabase (Postgres + Auth) via `@supabase/supabase-js@2.45.4` carregado do jsDelivr.
- Publicação: GitHub Pages, a partir da branch `main`, pasta raiz.
- Testes: `node --test` (nativo do Node 20+), sem dependências.

## Estrutura
```
index.html          tela de login e app
style.css
js/config.js        URL do projeto e chave PUBLICÁVEL do Supabase
js/supabase.js      cria o cliente do Supabase (único lugar)
js/regras.js        regras de negócio e tradução dos erros do banco, como funções puras (sem DOM, sem rede)
js/tela.js          utilitários de tela: el() monta elementos só com texto, confirmar() e avisar()
js/app.js           login, abas e carga dos dados ao entrar
js/alunos.js        aba Alunos (uma aba por arquivo)
sql/schema.sql      tabelas, constraints, triggers e políticas de RLS
testes/regras.test.js
package.json        "type": "module" e script "test"
```

## Comandos
- Rodar localmente: `python -m http.server 8000` e abrir http://localhost:8000
- Rodar os testes: `npm test` (equivale a `node --test`, que acha todos os arquivos *.test.js)

## Convenções
- Toda regra de negócio fica em `js/regras.js` e é usada pela tela; o banco repete a mesma regra.
- Mensagens de erro são exatamente as dos critérios de aceitação do SPEC.
- Texto vindo do usuário ou do banco é mostrado SEMPRE com `textContent`. Nunca `innerHTML` com dados.
- Nunca `alert()`, `confirm()` ou `prompt()` do navegador. Confirmação usa `confirmar()` (modal próprio) e aviso usa `avisar()`, ambos de `js/tela.js`.
- Visual moderno e minimalista: cores, raios e sombras só pelos tokens em `:root` do `style.css`.
- Ao fim de cada pedido, o agente atualiza o `IA.md` com uma linha: data, o que foi pedido, o que foi entregue e o que o usuário recusou ou mudou, com o motivo que ele deu. Não inventar avaliação que o usuário não fez; o que ainda não foi testado fica marcado como "aguardando teste".
- Datas no banco em `date`; valores em `numeric(10,2)`.
- Commits pequenos, em português, no formato `feat:`, `fix:`, `test:`, `docs:`.

## O agente NÃO pode
- Colocar a chave secreta (`sb_secret_...` ou `service_role`) em qualquer arquivo.
- Desativar RLS ou criar política com `using (true)` para escrita.
- Alterar `sql/schema.sql`, apagar arquivos ou mudar o SPEC sem parar e perguntar antes.
- Adicionar bibliotecas novas sem perguntar.
- Dizer que algo "está pronto" sem que os testes passem e sem o passo de teste no navegador.
