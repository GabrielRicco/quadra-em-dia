# Quadra em Dia 🎾

[![Testes](https://github.com/GabrielRicco/quadra-em-dia/actions/workflows/testes.yml/badge.svg)](https://github.com/GabrielRicco/quadra-em-dia/actions/workflows/testes.yml)

Agenda de aulas e controle de pacotes para professores de tênis: as aulas de hoje, o saldo de cada pacote e quem já pagou.

**No ar:** https://gabrielricco.github.io/quadra-em-dia/

Projeto final de Tópicos Avançados de Programação (UNI-RN). Problema, regras e critérios de aceitação em [SPEC.md](SPEC.md).

## Tecnologias
- HTML, CSS e JavaScript puro, publicado no GitHub Pages
- Supabase: banco Postgres, login (Auth) e segurança por linha (RLS)
- Testes com o executor nativo do Node (`node --test`)

## Como rodar
1. Crie um projeto no [Supabase](https://supabase.com) e rode `sql/schema.sql` no SQL Editor.
2. Em `js/config.js`, coloque a URL do projeto e a chave **publicável** (`sb_publishable_...`).
3. Sirva a pasta: `python -m http.server 8000` e abra http://localhost:8000

## Como rodar os testes
Requer Node 20 ou mais novo.
```
npm test
```
Os mesmos testes rodam sozinhos no GitHub Actions a cada push e pull request ([.github/workflows/testes.yml](.github/workflows/testes.yml)), no fuso de São Paulo. O selo no topo deste README mostra se o último push passou.

## Segurança
- A chave publicável fica no navegador; quem protege os dados é o RLS: cada professor só lê e altera os próprios alunos, pacotes e aulas.
- Visitante sem login não tem permissão em nenhuma tabela.
- Nenhuma chave secreta está no repositório.
