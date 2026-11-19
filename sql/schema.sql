-- =============================================================
-- Quadra em Dia · schema.sql
-- Rodar inteiro no Supabase: SQL Editor > New query > colar > Run
-- Regras de negócio (RN) e critérios (CA) referem-se ao SPEC.md
-- =============================================================

-- Necessária para a regra de horário sobreposto (RN03)
create extension if not exists btree_gist with schema extensions;

-- -------------------------------------------------------------
-- Tabelas
-- -------------------------------------------------------------
create table public.alunos (
  id            uuid primary key default gen_random_uuid(),
  professor_id  uuid not null default auth.uid()
                references auth.users(id) on delete cascade,
  nome          text not null,
  telefone      text,
  nivel         text not null default 'iniciante',
  ativo         boolean not null default true,
  observacoes   text,
  criado_em     timestamptz not null default now(),

  -- RN01
  constraint alunos_nome_tamanho
    check (char_length(btrim(nome)) between 2 and 80),
  constraint alunos_telefone_tamanho
    check (telefone is null or char_length(telefone) <= 20),
  constraint alunos_nivel_valido
    check (nivel in ('iniciante', 'intermediario', 'avancado')),
  constraint alunos_observacoes_tamanho
    check (observacoes is null or char_length(observacoes) <= 500)
);

create table public.pacotes (
  id               uuid primary key default gen_random_uuid(),
  professor_id     uuid not null default auth.uid()
                   references auth.users(id) on delete cascade,
  aluno_id         uuid not null references public.alunos(id) on delete cascade,
  quantidade_aulas integer not null,
  valor            numeric(10,2) not null,
  inicio           date not null default current_date,
  pago             boolean not null default false,
  pago_em          date,
  forma_pagamento  text not null default 'pix',
  criado_em        timestamptz not null default now(),

  -- RN02
  constraint pacotes_quantidade_valor
    check (quantidade_aulas between 1 and 50 and valor > 0 and valor <= 10000),
  -- RN05 (parte 1: pago <=> tem data). A data futura é barrada no trigger.
  constraint pacotes_pago_consistente
    check ((pago and pago_em is not null) or (not pago and pago_em is null)),
  constraint pacotes_forma_valida
    check (forma_pagamento in ('pix', 'dinheiro', 'transferencia', 'cartao'))
);

create table public.aulas (
  id            uuid primary key default gen_random_uuid(),
  professor_id  uuid not null default auth.uid()
                references auth.users(id) on delete cascade,
  pacote_id     uuid not null references public.pacotes(id) on delete cascade,
  inicio        timestamptz not null,
  fim           timestamptz not null,
  status        text not null default 'agendada',
  criado_em     timestamptz not null default now(),

  constraint aulas_duracao
    check (fim - inicio between interval '15 minutes' and interval '240 minutes'),
  constraint aulas_status_valido
    check (status in ('agendada', 'dada', 'falta', 'cancelada')),
  -- RN03: o mesmo professor não tem duas aulas (não canceladas) sobrepostas
  constraint aulas_sem_sobreposicao
    exclude using gist (
      professor_id with =,
      tstzrange(inicio, fim) with &&
    ) where (status <> 'cancelada')
);

create index alunos_professor_idx  on public.alunos (professor_id);
create index pacotes_professor_idx on public.pacotes (professor_id);
create index pacotes_aluno_idx     on public.pacotes (aluno_id);
create index aulas_pacote_idx      on public.aulas (pacote_id);
create index aulas_inicio_idx      on public.aulas (professor_id, inicio);

-- -------------------------------------------------------------
-- Triggers das regras que um check não consegue expressar
-- As mensagens são as mesmas dos critérios de aceitação.
-- -------------------------------------------------------------

-- RN05 (parte 2): data de pagamento não pode ser no futuro.
-- Também impede reduzir a quantidade de aulas abaixo das já usadas.
create or replace function public.validar_pacote()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  usadas integer;
begin
  if new.pago_em is not null
     and new.pago_em > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Informe a data do pagamento (não pode ser no futuro).';
  end if;

  if tg_op = 'UPDATE' and new.quantidade_aulas < old.quantidade_aulas then
    select count(*) into usadas
      from public.aulas
     where pacote_id = new.id and status in ('dada', 'falta');
    if new.quantidade_aulas < usadas then
      raise exception 'O pacote já tem % aulas usadas.', usadas;
    end if;
  end if;

  return new;
end;
$$;

create trigger pacotes_validar
  before insert or update on public.pacotes
  for each row execute function public.validar_pacote();

-- RN04: aula só vira "dada" ou "falta" se o pacote tiver saldo.
create or replace function public.validar_saldo_aula()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  qtd    integer;
  usadas integer;
begin
  if new.status in ('dada', 'falta')
     and (tg_op = 'INSERT'
          or old.status not in ('dada', 'falta')
          or old.pacote_id <> new.pacote_id) then

    -- trava o pacote para dois cliques ao mesmo tempo não passarem juntos
    select quantidade_aulas into qtd
      from public.pacotes where id = new.pacote_id for update;

    select count(*) into usadas
      from public.aulas
     where pacote_id = new.pacote_id
       and status in ('dada', 'falta')
       and id <> new.id;

    if usadas >= qtd then
      raise exception 'Este pacote não tem mais aulas. Crie um novo pacote para o aluno.';
    end if;
  end if;

  return new;
end;
$$;

create trigger aulas_validar_saldo
  before insert or update on public.aulas
  for each row execute function public.validar_saldo_aula();

-- RN06: não excluir aluno com pacote não pago.
create or replace function public.impedir_exclusao_aluno()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from public.pacotes
              where aluno_id = old.id and not pago) then
    raise exception 'Este aluno tem pacote não pago. Marque como inativo em vez de excluir.';
  end if;
  return old;
end;
$$;

create trigger alunos_impedir_exclusao
  before delete on public.alunos
  for each row execute function public.impedir_exclusao_aluno();

-- -------------------------------------------------------------
-- Saldo de cada pacote (respeita o RLS de quem consulta)
-- -------------------------------------------------------------
create view public.pacotes_com_saldo
with (security_invoker = true) as
select p.*,
       a.nome as aluno_nome,
       count(au.id) filter (where au.status in ('dada', 'falta'))::int as usadas,
       (p.quantidade_aulas
        - count(au.id) filter (where au.status in ('dada', 'falta')))::int as saldo
  from public.pacotes p
  join public.alunos a on a.id = p.aluno_id
  left join public.aulas au on au.pacote_id = p.id
 group by p.id, a.nome;

-- -------------------------------------------------------------
-- Segurança: RLS "cada professor só vê e mexe no que é seu"
-- -------------------------------------------------------------
alter table public.alunos  enable row level security;
alter table public.pacotes enable row level security;
alter table public.aulas   enable row level security;

-- Visitante sem login não acessa nada (CA10)
revoke all on public.alunos, public.pacotes, public.aulas, public.pacotes_com_saldo from anon;
grant select, insert, update, delete on public.alunos, public.pacotes, public.aulas to authenticated;
grant select on public.pacotes_com_saldo to authenticated;

-- alunos
create policy "professor lê seus alunos" on public.alunos
  for select to authenticated using (professor_id = (select auth.uid()));
create policy "professor cria seus alunos" on public.alunos
  for insert to authenticated with check (professor_id = (select auth.uid()));
create policy "professor edita seus alunos" on public.alunos
  for update to authenticated
  using (professor_id = (select auth.uid()))
  with check (professor_id = (select auth.uid()));
create policy "professor apaga seus alunos" on public.alunos
  for delete to authenticated using (professor_id = (select auth.uid()));

-- pacotes: além de ser dono, o aluno do pacote também precisa ser dele
create policy "professor lê seus pacotes" on public.pacotes
  for select to authenticated using (professor_id = (select auth.uid()));
create policy "professor cria seus pacotes" on public.pacotes
  for insert to authenticated with check (
    professor_id = (select auth.uid())
    and exists (select 1 from public.alunos a
                 where a.id = aluno_id and a.professor_id = (select auth.uid())));
create policy "professor edita seus pacotes" on public.pacotes
  for update to authenticated
  using (professor_id = (select auth.uid()))
  with check (
    professor_id = (select auth.uid())
    and exists (select 1 from public.alunos a
                 where a.id = aluno_id and a.professor_id = (select auth.uid())));
create policy "professor apaga seus pacotes" on public.pacotes
  for delete to authenticated using (professor_id = (select auth.uid()));

-- aulas: o pacote da aula também precisa ser dele
create policy "professor lê suas aulas" on public.aulas
  for select to authenticated using (professor_id = (select auth.uid()));
create policy "professor cria suas aulas" on public.aulas
  for insert to authenticated with check (
    professor_id = (select auth.uid())
    and exists (select 1 from public.pacotes p
                 where p.id = pacote_id and p.professor_id = (select auth.uid())));
create policy "professor edita suas aulas" on public.aulas
  for update to authenticated
  using (professor_id = (select auth.uid()))
  with check (
    professor_id = (select auth.uid())
    and exists (select 1 from public.pacotes p
                 where p.id = pacote_id and p.professor_id = (select auth.uid())));
create policy "professor apaga suas aulas" on public.aulas
  for delete to authenticated using (professor_id = (select auth.uid()));

-- -------------------------------------------------------------
-- RN07 · vencimento do pacote (acrescentado em 19/11; quem já tinha o banco
-- criado roda sql/migracao-2026-11-19-vencimento.sql, que é este mesmo trecho)
-- -------------------------------------------------------------
-- RN07: o pacote vence 30 dias depois da compra (pedido do usuário real em 19/11).
-- Aula que não foi cancelada não pode ficar depois do vencimento; as aulas que
-- sobrarem se perdem. A tela repete a regra (js/regras.js, validarPrazoDaAula).
create or replace function public.validar_aula_no_prazo()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  compra date;
begin
  if new.status <> 'cancelada' then
    select inicio into compra from public.pacotes where id = new.pacote_id;
    if (new.inicio at time zone 'America/Sao_Paulo')::date > compra + 30 then
      raise exception 'Esta aula fica depois do vencimento do pacote. Crie um novo pacote para o aluno.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists aulas_validar_prazo on public.aulas;
create trigger aulas_validar_prazo
  before insert or update on public.aulas
  for each row execute function public.validar_aula_no_prazo();

-- Mudar a data da compra não pode deixar aulas para fora do novo vencimento.
create or replace function public.validar_prazo_do_pacote()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.inicio <> old.inicio and exists (
    select 1
      from public.aulas au
     where au.pacote_id = new.id
       and au.status <> 'cancelada'
       and (au.inicio at time zone 'America/Sao_Paulo')::date > new.inicio + 30
  ) then
    raise exception 'Já existem aulas depois do novo vencimento deste pacote. Mude essas aulas antes.';
  end if;
  return new;
end;
$$;

drop trigger if exists pacotes_validar_prazo on public.pacotes;
create trigger pacotes_validar_prazo
  before update on public.pacotes
  for each row execute function public.validar_prazo_do_pacote();
