# IA.md · Registro do uso de IA

Ferramentas: Claude (claude.ai) para planejar e escrever o SPEC; Claude Code (no VS Code) para construir.

| Data | O que pedi | O que aceitei | O que rejeitei ou mudei, e por quê |
|---|---|---|---|
| 12/11 | Ajuda para planejar o projeto a partir dos slides e do calendário | Plano por dias e escolha do caminho B (HTML/JS + Supabase) | _[preencher]_ |
| 12/11 | Primeira versão do SPEC.md e do AGENTS.md | Estrutura do SPEC, regras e critérios de aceitação | A 1ª versão tratava cobrança como mensalidade. Depois da conversa com meu pai (usuário real), trocamos por **pacote de aulas + aula**, porque o problema dele é saber as aulas do dia e quanto falta em cada pacote. |
| 12/11 | schema.sql com regras e RLS | Tabelas, constraints, triggers e políticas "cada professor vê o que é seu"; a IA testou o schema num Postgres local antes de entregar | _[o que eu conferi ao rodar no Supabase]_ |
| 12/11 | Esqueleto com login, regras.js e 9 testes | _[preencher depois de revisar o diff]_ | _[preencher]_ |
| 12/11 | (Claude Code) Diagnóstico do projeto, primeiros commits e cadastro de alunos | Diagnóstico: testes passando, banco criado e API sem login devolvendo 401 nas 3 tabelas; commits separados por assunto; aba Alunos (RF02) com RN01 e RN06; função que traduz o erro do banco para a mensagem exata do SPEC, com 2 testes novos (11 no total) | Testei no navegador e **recusei o `confirm()` nativo** que o agente usou para excluir: quero modais próprios, no visual do app, e virou regra no AGENTS.md. Também achei o visual com cara de site antigo e pedi um mais moderno e minimalista. O agente tentou dar push direto na `main` e foi barrado pela minha trava (hook): o push fica comigo. |
| 12/11 | (Claude Code) Modais próprios no lugar do `confirm()` e novo visual minimalista | `confirmar()` e `avisar()` em `js/tela.js`; fonte Geist, fundo claro e uma cor de destaque; abas com ícones (barra inferior no celular); lista de alunos com iniciais; "Excluir" dentro do modal de edição; modais que sobem de baixo no celular | Aceitei os modais próprios. Achei o visual ainda **muito branco** e sem vida: pedi animações com a biblioteca Motion e gráficos. O agente concordou com as animações, mas sugeriu deixar os gráficos para o Resumo, porque sem Pacotes e Aulas eles mostrariam dados inventados; aceitei. |
