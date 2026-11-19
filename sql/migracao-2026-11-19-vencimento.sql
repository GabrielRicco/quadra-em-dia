-- =============================================================
-- Quadra em Dia · migração de 19/11/2026 · RN07 (vencimento do pacote)
-- Para um banco que JÁ foi criado com o schema.sql antigo:
-- rodar UMA vez no Supabase: SQL Editor > New query > colar > Run.
-- (Um banco novo não precisa: o schema.sql já traz esta parte.)
-- Pode rodar de novo sem problema: só substitui funções e triggers.
-- =============================================================

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
