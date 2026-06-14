-- ============================================================
--  МАРШ ИМПЕРИЙ — схема общего онлайн-мира для Supabase
--  Вставьте этот скрипт целиком в Supabase → SQL Editor → Run.
--  Скрипт идемпотентен: можно запускать повторно.
-- ============================================================

-- 1) Замки игроков (публичные снимки на общей карте) --------
create table if not exists public.players (
  id           uuid primary key references auth.users(id) on delete cascade,
  nick         text   not null default 'Лорд',
  faction      text   not null default 'highland',
  x            int    not null default 1200,
  y            int    not null default 760,
  power        int    not null default 0,
  castle_level int    not null default 1,
  shield_until bigint not null default 0,   -- ms-эпоха
  last_seen    bigint not null default 0,   -- ms-эпоха
  created_at   timestamptz not null default now()
);
alter table public.players enable row level security;

drop policy if exists players_select_all  on public.players;
drop policy if exists players_insert_own  on public.players;
drop policy if exists players_update_own  on public.players;
create policy players_select_all on public.players
  for select to authenticated using (true);
create policy players_insert_own on public.players
  for insert to authenticated with check (auth.uid() = id);
create policy players_update_own on public.players
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- 2) Общая лента событий ------------------------------------
create table if not exists public.events (
  id    uuid primary key default gen_random_uuid(),
  at    bigint not null,
  icon  text   not null default '',
  text  text   not null,
  actor uuid   references auth.users(id) on delete set null
);
alter table public.events enable row level security;

drop policy if exists events_select_all  on public.events;
drop policy if exists events_insert_own  on public.events;
create policy events_select_all on public.events
  for select to authenticated using (true);
create policy events_insert_own on public.events
  for insert to authenticated with check (auth.uid() = actor);

-- 3) Атаки на игроков (донесения + отложенный урон) ----------
create table if not exists public.attacks (
  id            uuid primary key default gen_random_uuid(),
  attacker      uuid references auth.users(id) on delete set null,
  attacker_nick text    not null default '',
  defender      uuid    not null references auth.users(id) on delete cascade,
  at            bigint  not null,
  win           boolean not null default false,
  loot          jsonb   not null default '{}'::jsonb,
  troop_loss    real    not null default 0,
  report        text    not null default '',
  applied       boolean not null default false
);
alter table public.attacks enable row level security;

drop policy if exists attacks_select_party    on public.attacks;
drop policy if exists attacks_insert_attacker on public.attacks;
drop policy if exists attacks_update_defender on public.attacks;
-- видят обе стороны боя
create policy attacks_select_party on public.attacks
  for select to authenticated using (auth.uid() = defender or auth.uid() = attacker);
-- атакующий создаёт донесение защитнику
create policy attacks_insert_attacker on public.attacks
  for insert to authenticated with check (auth.uid() = attacker);
-- защитник помечает применённым
create policy attacks_update_defender on public.attacks
  for update to authenticated using (auth.uid() = defender) with check (auth.uid() = defender);

create index if not exists attacks_defender_idx on public.attacks (defender, applied);

-- 4) Realtime: события и атаки приходят мгновенно ------------
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.events';  exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.attacks'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.players'; exception when duplicate_object then null; end;
end $$;

-- 5) Права консоли: dev-режим и выданные права ---------------
alter table public.players add column if not exists is_dev boolean not null default false;
alter table public.players add column if not exists perms  text[]  not null default '{}';

-- 6) Подарки ресурсов (gift) — начисляются получателю ---------
create table if not exists public.gifts (
  id          uuid primary key default gen_random_uuid(),
  recipient   uuid    not null references auth.users(id) on delete cascade,
  sender_nick text    not null default '',
  resource    text    not null,
  amount      int     not null default 0,
  applied     boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.gifts enable row level security;
drop policy if exists gifts_select_own on public.gifts;
drop policy if exists gifts_update_own on public.gifts;
-- получатель видит и помечает свои подарки; ВСТАВКА — только через RPC (security definer)
create policy gifts_select_own on public.gifts
  for select to authenticated using (auth.uid() = recipient);
create policy gifts_update_own on public.gifts
  for update to authenticated using (auth.uid() = recipient) with check (auth.uid() = recipient);
create index if not exists gifts_recipient_idx on public.gifts (recipient, applied);

-- 7) RPC: выдать/забрать право (только dev) -------------------
create or replace function public.console_set_perm(p_target text, p_perm text, p_add boolean)
returns text language plpgsql security definer set search_path = public as $$
declare v_dev boolean; v_target uuid;
begin
  select is_dev into v_dev from public.players where id = auth.uid();
  if not coalesce(v_dev, false) then raise exception 'Только разработчик может выдавать права'; end if;
  if p_perm not in ('view','helper') then raise exception 'Право должно быть view или helper'; end if;
  select id into v_target from public.players where id::text = p_target or nick = p_target limit 1;
  if v_target is null then raise exception 'Игрок не найден: %', p_target; end if;
  if p_add then
    update public.players
      set perms = (select array(select distinct e from unnest(coalesce(perms,'{}') || array[p_perm]) e))
      where id = v_target;
  else
    update public.players set perms = array_remove(coalesce(perms,'{}'), p_perm) where id = v_target;
  end if;
  return 'ok';
end $$;

-- 8) RPC: подарить ресурсы (dev — из воздуха, helper — из своих)
create or replace function public.console_gift(p_target text, p_resource text, p_amount int, p_from_air boolean)
returns text language plpgsql security definer set search_path = public as $$
declare v_dev boolean; v_perms text[]; v_target uuid; v_nick text;
begin
  select is_dev, perms, nick into v_dev, v_perms, v_nick from public.players where id = auth.uid();
  if p_from_air then
    if not coalesce(v_dev, false) then raise exception 'Из воздуха дарит только разработчик'; end if;
  else
    if not (coalesce(v_dev,false) or ('helper' = any(coalesce(v_perms,'{}')))) then
      raise exception 'Нужно право helper или dev'; end if;
  end if;
  if p_resource not in ('iron','wood','silver','food','gold') then raise exception 'Неверный ресурс'; end if;
  if p_amount <= 0 then raise exception 'Сумма должна быть > 0'; end if;
  select id into v_target from public.players where id::text = p_target or nick = p_target limit 1;
  if v_target is null then raise exception 'Игрок не найден: %', p_target; end if;
  insert into public.gifts(recipient, sender_nick, resource, amount, applied)
    values (v_target, coalesce(v_nick,'союзник'), p_resource, p_amount, false);
  return 'ok';
end $$;

grant execute on function public.console_set_perm(text, text, boolean) to authenticated;
grant execute on function public.console_gift(text, text, int, boolean) to authenticated;

-- 9) Realtime для подарков -----------------------------------
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.gifts'; exception when duplicate_object then null; end;
end $$;

-- Готово. Включите Email-провайдер в Authentication → Providers
-- (по желанию отключите "Confirm email" для быстрого теста).
-- Чтобы стать разработчиком: в игре открой консоль (`) и введи:  unlock <код>

