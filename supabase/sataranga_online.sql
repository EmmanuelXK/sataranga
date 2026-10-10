-- SATARANGA online play on the shared YUDO project.
-- Additive and namespaced. Does not alter oomi_*, ping_*, yuddha tables,
-- rating_stats, family_ratings schema, or auth config.
-- Clocks are stored here and advanced with now(), never with a client number.
-- Moves are written only by these functions. The app checks each move with
-- the locked engine before it calls sataranga_commit_move, and again on load.

create table if not exists public.sataranga_games (
  id uuid primary key default gen_random_uuid(),
  white_id uuid not null references auth.users (id) on delete cascade,
  black_id uuid references auth.users (id) on delete cascade,
  time_class text not null check (time_class in ('blitz', 'rapid')),
  rated boolean not null default true,
  initial_ms integer not null,
  increment_ms integer not null,
  white_ms integer not null,
  black_ms integer not null,
  clock_updated_at timestamptz not null default now(),
  side_to_move text not null default 'w' check (side_to_move in ('w', 'b')),
  ply integer not null default 0,
  moves jsonb not null default '[]'::jsonb,
  status text not null default 'waiting' check (status in ('waiting', 'live', 'finished', 'aborted')),
  result text check (result in ('1-0', '0-1', '1/2-1/2')),
  result_kind text,
  winner_id uuid,
  invite_code text unique,
  draw_offer text check (draw_offer in ('w', 'b')),
  white_last_seen_at timestamptz,
  black_last_seen_at timestamptz,
  rated_applied boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.sataranga_moves (
  game_id uuid not null references public.sataranga_games (id) on delete cascade,
  ply integer not null,
  from_sq integer not null check (from_sq between 0 and 63),
  to_sq integer not null check (to_sq between 0 and 63),
  promotion boolean not null default false,
  player_id uuid not null references auth.users (id) on delete cascade,
  played_at timestamptz not null default now(),
  primary key (game_id, ply)
);

create table if not exists public.sataranga_queue (
  user_id uuid primary key references auth.users (id) on delete cascade,
  time_class text not null check (time_class in ('blitz', 'rapid')),
  rated boolean not null,
  joined_at timestamptz not null default now()
);

create index if not exists sataranga_queue_match
  on public.sataranga_queue (time_class, rated, joined_at);

create index if not exists sataranga_games_players
  on public.sataranga_games (white_id, black_id, status);

alter table public.sataranga_moves replica identity full;

alter table public.sataranga_games enable row level security;
alter table public.sataranga_moves enable row level security;
alter table public.sataranga_queue enable row level security;

drop policy if exists sataranga_games_select on public.sataranga_games;
create policy sataranga_games_select
  on public.sataranga_games
  for select
  to authenticated
  using ((select auth.uid()) = white_id or (select auth.uid()) = black_id);

drop policy if exists sataranga_moves_select on public.sataranga_moves;
create policy sataranga_moves_select
  on public.sataranga_moves
  for select
  to authenticated
  using (
    exists (
      select 1 from public.sataranga_games g
      where g.id = game_id
        and ((select auth.uid()) = g.white_id or (select auth.uid()) = g.black_id)
    )
  );

drop policy if exists sataranga_queue_select on public.sataranga_queue;
create policy sataranga_queue_select
  on public.sataranga_queue
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.sataranga_games from anon, authenticated;
revoke all on public.sataranga_moves from anon, authenticated;
revoke all on public.sataranga_queue from anon, authenticated;
grant select on public.sataranga_games to authenticated;
grant select on public.sataranga_moves to authenticated;
grant select on public.sataranga_queue to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sataranga_games'
  ) then
    alter publication supabase_realtime add table public.sataranga_games;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sataranga_moves'
  ) then
    alter publication supabase_realtime add table public.sataranga_moves;
  end if;
end $$;

create or replace function public.sataranga_pack(p_game public.sataranga_games, p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_white text;
  v_black text;
begin
  select coalesce(nullif(display_name, ''), nullif(username, ''), 'White')
    into v_white from public.profiles where id = p_game.white_id;
  select coalesce(nullif(display_name, ''), nullif(username, ''), 'Black')
    into v_black from public.profiles where id = p_game.black_id;
  return jsonb_build_object(
    'ok', true,
    'id', p_game.id,
    'white_id', p_game.white_id,
    'black_id', p_game.black_id,
    'time_class', p_game.time_class,
    'rated', p_game.rated,
    'initial_ms', p_game.initial_ms,
    'increment_ms', p_game.increment_ms,
    'white_ms', p_game.white_ms,
    'black_ms', p_game.black_ms,
    'clock_updated_at', p_game.clock_updated_at,
    'side_to_move', p_game.side_to_move,
    'ply', p_game.ply,
    'moves', p_game.moves,
    'status', p_game.status,
    'result', p_game.result,
    'result_kind', p_game.result_kind,
    'invite_code', p_game.invite_code,
    'draw_offer', p_game.draw_offer,
    'you', case
      when p_uid = p_game.white_id then 'w'
      when p_uid = p_game.black_id then 'b'
      else null
    end,
    'white_name', coalesce(v_white, 'White'),
    'black_name', coalesce(v_black, 'Black'),
    'server_now', now()
  );
end;
$$;

create or replace function public.sataranga_sync_family(p_user uuid, p_pool text, p_bump boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rating integer;
begin
  select rating into v_rating
    from public.rating_stats
    where user_id = p_user and time_class = p_pool;
  if v_rating is null then
    return;
  end if;
  insert into public.family_ratings (user_id, family, rating, games_played)
  values (p_user, 'sataranga', v_rating, case when p_bump then 1 else 0 end)
  on conflict (user_id, family) do update
    set rating = excluded.rating,
        games_played = public.family_ratings.games_played + case when p_bump then 1 else 0 end;
end;
$$;

revoke all on function public.sataranga_sync_family(uuid, text, boolean) from public, anon, authenticated;

create or replace function public.sataranga_clocks(p_game public.sataranga_games, p_now timestamptz)
returns table (white_ms integer, black_ms integer, flagged text)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_elapsed integer := 0;
  v_white integer := p_game.white_ms;
  v_black integer := p_game.black_ms;
begin
  if p_game.status = 'live' and p_game.black_id is not null then
    v_elapsed := greatest(0, floor(extract(epoch from (p_now - p_game.clock_updated_at)) * 1000)::integer);
    if p_game.side_to_move = 'w' then
      v_white := greatest(0, p_game.white_ms - v_elapsed);
    else
      v_black := greatest(0, p_game.black_ms - v_elapsed);
    end if;
  end if;
  return query select v_white, v_black, case
    when p_game.status = 'live' and p_game.black_id is not null and p_game.side_to_move = 'w' and v_white <= 0 then 'w'
    when p_game.status = 'live' and p_game.black_id is not null and p_game.side_to_move = 'b' and v_black <= 0 then 'b'
    else null
  end;
end;
$$;

create or replace function public.sataranga_enqueue(p_time text, p_rated boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_other uuid;
  v_ms integer;
  v_inc integer;
  v_white uuid;
  v_black uuid;
  v_game public.sataranga_games;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in.');
  end if;
  if p_time = 'blitz' then
    v_ms := 180000; v_inc := 2000;
  elsif p_time = 'rapid' then
    v_ms := 300000; v_inc := 10000;
  else
    return jsonb_build_object('ok', false, 'error', 'Use blitz or rapid.');
  end if;

  perform pg_advisory_xact_lock(481516234);

  insert into public.sataranga_queue (user_id, time_class, rated, joined_at)
  values (v_uid, p_time, p_rated, now())
  on conflict (user_id) do update
    set time_class = excluded.time_class, rated = excluded.rated, joined_at = excluded.joined_at;

  select q.user_id into v_other
    from public.sataranga_queue q
    where q.user_id <> v_uid and q.time_class = p_time and q.rated = p_rated
    order by q.joined_at
    limit 1;

  if v_other is null then
    return jsonb_build_object('ok', true, 'queued', true);
  end if;

  if (select joined_at from public.sataranga_queue where user_id = v_other)
     <= (select joined_at from public.sataranga_queue where user_id = v_uid) then
    v_white := v_other;
    v_black := v_uid;
  else
    v_white := v_uid;
    v_black := v_other;
  end if;

  delete from public.sataranga_queue where user_id in (v_uid, v_other);

  insert into public.sataranga_games (
    white_id, black_id, time_class, rated, initial_ms, increment_ms,
    white_ms, black_ms, clock_updated_at, status, white_last_seen_at, black_last_seen_at
  ) values (
    v_white, v_black, p_time, p_rated, v_ms, v_inc,
    v_ms, v_ms, now(), 'live',
    case when v_white = v_uid then now() else null end,
    case when v_black = v_uid then now() else null end
  )
  returning * into v_game;

  return public.sataranga_pack(v_game, v_uid) || jsonb_build_object('queued', false);
end;
$$;

create or replace function public.sataranga_leave_queue()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in.');
  end if;
  delete from public.sataranga_queue where user_id = v_uid;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.sataranga_invite(p_time text, p_rated boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ms integer;
  v_inc integer;
  v_code text;
  v_game public.sataranga_games;
  v_n integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in.');
  end if;
  if p_time = 'blitz' then
    v_ms := 180000; v_inc := 2000;
  elsif p_time = 'rapid' then
    v_ms := 300000; v_inc := 10000;
  else
    return jsonb_build_object('ok', false, 'error', 'Use blitz or rapid.');
  end if;

  update public.sataranga_games
    set status = 'aborted', result_kind = 'abort', finished_at = now(), updated_at = now()
    where white_id = v_uid and status = 'waiting';

  v_code := null;
  for v_n in 1..8 loop
    v_code := '';
    while length(v_code) < 5 loop
      v_code := v_code || substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + floor(random() * 31)::integer, 1);
    end loop;
    exit when not exists (select 1 from public.sataranga_games where invite_code = v_code);
  end loop;

  insert into public.sataranga_games (
    white_id, time_class, rated, initial_ms, increment_ms, white_ms, black_ms,
    status, invite_code, white_last_seen_at
  ) values (
    v_uid, p_time, p_rated, v_ms, v_inc, v_ms, v_ms,
    'waiting', v_code, now()
  )
  returning * into v_game;

  delete from public.sataranga_queue where user_id = v_uid;
  return public.sataranga_pack(v_game, v_uid);
end;
$$;

create or replace function public.sataranga_join(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.sataranga_games;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in.');
  end if;
  select * into v_game
    from public.sataranga_games
    where invite_code = lower(trim(p_code)) and status = 'waiting' and black_id is null
    for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'That code is not waiting.');
  end if;
  if v_game.white_id = v_uid then
    return public.sataranga_pack(v_game, v_uid);
  end if;
  update public.sataranga_games
    set black_id = v_uid,
        status = 'live',
        clock_updated_at = now(),
        white_ms = initial_ms,
        black_ms = initial_ms,
        black_last_seen_at = now(),
        updated_at = now()
    where id = v_game.id
    returning * into v_game;
  delete from public.sataranga_queue where user_id = v_uid;
  return public.sataranga_pack(v_game, v_uid);
end;
$$;

create or replace function public.sataranga_active()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.sataranga_games;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in.');
  end if;
  select * into v_game
    from public.sataranga_games
    where (white_id = v_uid or black_id = v_uid)
      and status in ('waiting', 'live')
    order by updated_at desc
    limit 1;
  if not found then
    return jsonb_build_object('ok', true, 'game', null);
  end if;
  return public.sataranga_pack(v_game, v_uid);
end;
$$;

create or replace function public.sataranga_open(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.sataranga_games;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in.');
  end if;
  update public.sataranga_games
    set white_last_seen_at = case when white_id = v_uid then now() else white_last_seen_at end,
        black_last_seen_at = case when black_id = v_uid then now() else black_last_seen_at end,
        updated_at = now()
    where id = p_id and (white_id = v_uid or black_id = v_uid)
    returning * into v_game;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'That game is not yours.');
  end if;
  return public.sataranga_pack(v_game, v_uid);
end;
$$;

create or replace function public.sataranga_finish(
  p_game public.sataranga_games,
  p_result text,
  p_kind text,
  p_winner uuid
) returns public.sataranga_games
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.sataranga_games;
begin
  update public.sataranga_games
    set status = case when p_kind = 'abort' then 'aborted' else 'finished' end,
        result = p_result,
        result_kind = p_kind,
        winner_id = p_winner,
        draw_offer = null,
        finished_at = now(),
        updated_at = now()
    where id = p_game.id
    returning * into v_game;
  return v_game;
end;
$$;

revoke all on function public.sataranga_finish(public.sataranga_games, text, text, uuid) from public, anon, authenticated;

create or replace function public.sataranga_commit_move(p_id uuid, p_from integer, p_to integer, p_promotion boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.sataranga_games;
  v_now timestamptz := now();
  v_white integer;
  v_black integer;
  v_flag text;
  v_side text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in.');
  end if;
  select * into v_game from public.sataranga_games where id = p_id for update;
  if v_game.id is null or (v_game.white_id <> v_uid and v_game.black_id is distinct from v_uid) then
    return jsonb_build_object('ok', false, 'error', 'That game is not yours.');
  end if;
  if v_game.status <> 'live' or v_game.black_id is null then
    return jsonb_build_object('ok', false, 'error', 'This game is not in play.');
  end if;
  v_side := case when v_uid = v_game.white_id then 'w' else 'b' end;
  if v_side <> v_game.side_to_move then
    return jsonb_build_object('ok', false, 'error', 'Not your turn.');
  end if;
  if p_from < 0 or p_from > 63 or p_to < 0 or p_to > 63 or p_from = p_to then
    return jsonb_build_object('ok', false, 'error', 'That square is off the board.');
  end if;

  select c.white_ms, c.black_ms, c.flagged into v_white, v_black, v_flag
    from public.sataranga_clocks(v_game, v_now) c;

  if v_flag is not null then
    v_game := public.sataranga_finish(
      v_game,
      case when v_flag = 'w' then '0-1' else '1-0' end,
      'time',
      case when v_flag = 'w' then v_game.black_id else v_game.white_id end
    );
    update public.sataranga_games set white_ms = v_white, black_ms = v_black where id = v_game.id;
    select * into v_game from public.sataranga_games where id = v_game.id;
    return public.sataranga_pack(v_game, v_uid);
  end if;

  if v_side = 'w' then
    v_white := v_white + v_game.increment_ms;
  else
    v_black := v_black + v_game.increment_ms;
  end if;

  insert into public.sataranga_moves (game_id, ply, from_sq, to_sq, promotion, player_id)
  values (v_game.id, v_game.ply + 1, p_from, p_to, coalesce(p_promotion, false), v_uid);

  update public.sataranga_games
    set moves = v_game.moves || jsonb_build_array(jsonb_build_object(
          'from', p_from, 'to', p_to, 'promotion', coalesce(p_promotion, false)
        )),
        ply = v_game.ply + 1,
        side_to_move = case when v_side = 'w' then 'b' else 'w' end,
        white_ms = v_white,
        black_ms = v_black,
        clock_updated_at = v_now,
        draw_offer = null,
        white_last_seen_at = case when v_side = 'w' then v_now else white_last_seen_at end,
        black_last_seen_at = case when v_side = 'b' then v_now else black_last_seen_at end,
        updated_at = v_now
    where id = v_game.id
    returning * into v_game;

  return public.sataranga_pack(v_game, v_uid);
end;
$$;

create or replace function public.sataranga_resign(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.sataranga_games;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in.');
  end if;
  select * into v_game from public.sataranga_games where id = p_id for update;
  if v_game.id is null or (v_game.white_id <> v_uid and v_game.black_id is distinct from v_uid) then
    return jsonb_build_object('ok', false, 'error', 'That game is not yours.');
  end if;
  if v_game.status <> 'live' then
    return public.sataranga_pack(v_game, v_uid);
  end if;
  v_game := public.sataranga_finish(
    v_game,
    case when v_uid = v_game.white_id then '0-1' else '1-0' end,
    'resign',
    case when v_uid = v_game.white_id then v_game.black_id else v_game.white_id end
  );
  return public.sataranga_pack(v_game, v_uid);
end;
$$;

create or replace function public.sataranga_offer_draw(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.sataranga_games;
  v_side text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in.');
  end if;
  select * into v_game from public.sataranga_games where id = p_id for update;
  if v_game.id is null or v_game.status <> 'live' or (v_game.white_id <> v_uid and v_game.black_id is distinct from v_uid) then
    return jsonb_build_object('ok', false, 'error', 'No live game to offer.');
  end if;
  v_side := case when v_uid = v_game.white_id then 'w' else 'b' end;
  if v_game.draw_offer is not null and v_game.draw_offer <> v_side then
    v_game := public.sataranga_finish(v_game, '1/2-1/2', 'draw', null);
    return public.sataranga_pack(v_game, v_uid);
  end if;
  update public.sataranga_games
    set draw_offer = v_side, updated_at = now()
    where id = v_game.id
    returning * into v_game;
  return public.sataranga_pack(v_game, v_uid);
end;
$$;

create or replace function public.sataranga_answer_draw(p_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.sataranga_games;
  v_side text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in.');
  end if;
  select * into v_game from public.sataranga_games where id = p_id for update;
  if v_game.id is null or (v_game.white_id <> v_uid and v_game.black_id is distinct from v_uid) then
    return jsonb_build_object('ok', false, 'error', 'That game is not yours.');
  end if;
  v_side := case when v_uid = v_game.white_id then 'w' else 'b' end;
  if v_game.status <> 'live' or v_game.draw_offer is null or v_game.draw_offer = v_side then
    return public.sataranga_pack(v_game, v_uid);
  end if;
  if p_accept then
    v_game := public.sataranga_finish(v_game, '1/2-1/2', 'draw', null);
  else
    update public.sataranga_games set draw_offer = null, updated_at = now() where id = v_game.id returning * into v_game;
  end if;
  return public.sataranga_pack(v_game, v_uid);
end;
$$;

create or replace function public.sataranga_abort(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.sataranga_games;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in.');
  end if;
  select * into v_game from public.sataranga_games where id = p_id for update;
  if v_game.id is null or (v_game.white_id <> v_uid and v_game.black_id is distinct from v_uid) then
    return jsonb_build_object('ok', false, 'error', 'That game is not yours.');
  end if;
  if v_game.status in ('finished', 'aborted') then
    return public.sataranga_pack(v_game, v_uid);
  end if;
  if v_game.status = 'waiting' or v_game.ply < 2 then
    v_game := public.sataranga_finish(v_game, null, 'abort', null);
    return public.sataranga_pack(v_game, v_uid);
  end if;
  return jsonb_build_object('ok', false, 'error', 'Too late to abort. Resign, or play on.');
end;
$$;

create or replace function public.sataranga_claim_time(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.sataranga_games;
  v_white integer;
  v_black integer;
  v_flag text;
  v_now timestamptz := now();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in.');
  end if;
  select * into v_game from public.sataranga_games where id = p_id for update;
  if v_game.id is null or (v_game.white_id <> v_uid and v_game.black_id is distinct from v_uid) then
    return jsonb_build_object('ok', false, 'error', 'That game is not yours.');
  end if;
  if v_game.status <> 'live' then
    return public.sataranga_pack(v_game, v_uid);
  end if;
  select c.white_ms, c.black_ms, c.flagged into v_white, v_black, v_flag
    from public.sataranga_clocks(v_game, v_now) c;
  if v_flag is null then
    update public.sataranga_games
      set white_last_seen_at = case when white_id = v_uid then v_now else white_last_seen_at end,
          black_last_seen_at = case when black_id = v_uid then v_now else black_last_seen_at end
      where id = v_game.id
      returning * into v_game;
    return public.sataranga_pack(v_game, v_uid);
  end if;
  update public.sataranga_games set white_ms = v_white, black_ms = v_black where id = v_game.id;
  v_game := public.sataranga_finish(
    v_game,
    case when v_flag = 'w' then '0-1' else '1-0' end,
    'time',
    case when v_flag = 'w' then v_game.black_id else v_game.white_id end
  );
  return public.sataranga_pack(v_game, v_uid);
end;
$$;

create or replace function public.sataranga_rate(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.sataranga_games;
  v_body jsonb;
  v_before integer;
  v_after integer;
  v_bump boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in.');
  end if;
  select * into v_game from public.sataranga_games where id = p_id for update;
  if v_game.id is null or (v_game.white_id <> v_uid and v_game.black_id is distinct from v_uid) then
    return jsonb_build_object('ok', false, 'error', 'That game is not yours.');
  end if;
  if v_game.status <> 'finished' or v_game.rated is not true or v_game.result is null or v_game.black_id is null then
    return jsonb_build_object('ok', true, 'applied', false, 'reason', 'Not a finished rated game.');
  end if;
  if v_game.result_kind = 'abort' then
    return jsonb_build_object('ok', true, 'applied', false, 'reason', 'Aborted games are not rated.');
  end if;

  select rating into v_before
    from public.rating_stats
    where user_id = v_uid and time_class = v_game.time_class;

  if v_game.rated_applied then
    select rating into v_after
      from public.rating_stats
      where user_id = v_uid and time_class = v_game.time_class;
    return jsonb_build_object(
      'ok', true, 'applied', false, 'duplicate', true,
      'before', v_before, 'after', v_after,
      'delta', coalesce(v_after, 0) - coalesce(v_before, v_after, 0)
    );
  end if;

  v_body := public.apply_rated_game(
    v_game.id, v_game.time_class, v_game.white_id, v_game.black_id, v_game.result, coalesce(v_game.result_kind, 'unspecified')
  );
  v_bump := coalesce((v_body->>'duplicate')::boolean, false) = false and coalesce((v_body->>'applied')::boolean, false);
  perform public.sataranga_sync_family(v_game.white_id, v_game.time_class, v_bump);
  perform public.sataranga_sync_family(v_game.black_id, v_game.time_class, v_bump);
  update public.sataranga_games set rated_applied = true, updated_at = now() where id = v_game.id;

  select rating into v_after
    from public.rating_stats
    where user_id = v_uid and time_class = v_game.time_class;

  return jsonb_build_object(
    'ok', true,
    'applied', v_bump,
    'duplicate', coalesce((v_body->>'duplicate')::boolean, false),
    'before', coalesce(v_before, v_after),
    'after', v_after,
    'delta', coalesce(v_after, 0) - coalesce(v_before, v_after, 0),
    'pool', v_game.time_class,
    'family', 'sataranga'
  );
end;
$$;

create or replace function public.sataranga_rate_bot(
  p_game_id uuid,
  p_level integer,
  p_side text,
  p_result text,
  p_kind text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_side text;
  v_opp integer;
  v_rd double precision;
  v_before integer;
  v_after integer;
  v_body jsonb;
  v_bump boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in.');
  end if;
  v_side := case when p_side in ('w', 'white') then 'white' when p_side in ('b', 'black') then 'black' else null end;
  if v_side is null or p_result not in ('1-0', '0-1', '1/2-1/2') then
    return jsonb_build_object('ok', false, 'error', 'Bad bot result.');
  end if;
  if p_level = 1 then v_opp := 800; v_rd := 220;
  elsif p_level = 2 then v_opp := 1000; v_rd := 180;
  elsif p_level = 3 then v_opp := 1400; v_rd := 140;
  else v_opp := 1800; v_rd := 110;
  end if;

  select rating into v_before from public.rating_stats where user_id = v_uid and time_class = 'bot';

  v_body := public.apply_solo_rated_game(
    p_game_id, 'bot', v_uid, v_side, p_result, coalesce(p_kind, 'unspecified'), v_opp, v_rd, null
  );
  v_bump := coalesce((v_body->>'duplicate')::boolean, false) = false;
  perform public.sataranga_sync_family(v_uid, 'bot', v_bump);

  select rating into v_after from public.rating_stats where user_id = v_uid and time_class = 'bot';
  return jsonb_build_object(
    'ok', true,
    'applied', coalesce((v_body->>'applied')::boolean, v_bump),
    'duplicate', coalesce((v_body->>'duplicate')::boolean, false),
    'before', coalesce(v_before, v_after),
    'after', v_after,
    'delta', coalesce(v_after, 0) - coalesce(v_before, v_after, 0),
    'pool', 'bot',
    'family', 'sataranga'
  );
end;
$$;

create or replace function public.sataranga_rating()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_family integer;
  v_games integer;
  v_blitz integer;
  v_rapid integer;
  v_bot integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in.');
  end if;
  perform private.seed_family_ratings(v_uid);
  perform private.seed_rating_stats(v_uid);
  select rating, games_played into v_family, v_games
    from public.family_ratings where user_id = v_uid and family = 'sataranga';
  select rating into v_blitz from public.rating_stats where user_id = v_uid and time_class = 'blitz';
  select rating into v_rapid from public.rating_stats where user_id = v_uid and time_class = 'rapid';
  select rating into v_bot from public.rating_stats where user_id = v_uid and time_class = 'bot';
  return jsonb_build_object(
    'ok', true,
    'family', 'sataranga',
    'rating', coalesce(v_family, 1000),
    'games', coalesce(v_games, 0),
    'blitz', coalesce(v_blitz, 1000),
    'rapid', coalesce(v_rapid, 1000),
    'bot', coalesce(v_bot, 1000)
  );
end;
$$;

create or replace function public.sataranga_leaderboard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_rows
  from (
    select
      f.user_id,
      coalesce(nullif(p.display_name, ''), nullif(p.username, ''), 'Player') as name,
      f.rating,
      f.games_played
    from public.family_ratings f
    left join public.profiles p on p.id = f.user_id
    where f.family = 'sataranga' and f.games_played > 0
    order by f.rating desc, f.games_played desc
    limit 50
  ) t;
  return jsonb_build_object('ok', true, 'family', 'sataranga', 'rows', v_rows);
end;
$$;

create or replace function public.sataranga_delete_account()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_auth boolean := false;
  v_err text := null;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in.');
  end if;
  delete from public.sataranga_moves
    where player_id = v_uid
       or game_id in (select id from public.sataranga_games where white_id = v_uid or black_id = v_uid);
  delete from public.sataranga_games where white_id = v_uid or black_id = v_uid;
  delete from public.sataranga_queue where user_id = v_uid;
  delete from public.sataranga_profile where user_id = v_uid;
  begin
    delete from auth.users where id = v_uid;
    v_auth := true;
  exception when others then
    v_auth := false;
    v_err := sqlerrm;
  end;
  return jsonb_build_object('ok', true, 'auth_deleted', v_auth, 'auth_error', v_err);
end;
$$;

revoke all on function public.sataranga_pack(public.sataranga_games, uuid) from public, anon, authenticated;
revoke all on function public.sataranga_clocks(public.sataranga_games, timestamptz) from public, anon, authenticated;
revoke all on function public.sataranga_commit_move(uuid, integer, integer, boolean) from public, anon;
revoke all on function public.sataranga_resign(uuid) from public, anon;
revoke all on function public.sataranga_offer_draw(uuid) from public, anon;
revoke all on function public.sataranga_answer_draw(uuid, boolean) from public, anon;
revoke all on function public.sataranga_abort(uuid) from public, anon;
revoke all on function public.sataranga_claim_time(uuid) from public, anon;
revoke all on function public.sataranga_rate(uuid) from public, anon;
revoke all on function public.sataranga_rate_bot(uuid, integer, text, text, text) from public, anon;
revoke all on function public.sataranga_rating() from public, anon;
revoke all on function public.sataranga_leaderboard() from public, anon;
revoke all on function public.sataranga_delete_account() from public, anon;

grant execute on function public.sataranga_enqueue(text, boolean) to authenticated;
grant execute on function public.sataranga_leave_queue() to authenticated;
grant execute on function public.sataranga_invite(text, boolean) to authenticated;
grant execute on function public.sataranga_join(text) to authenticated;
grant execute on function public.sataranga_active() to authenticated;
grant execute on function public.sataranga_open(uuid) to authenticated;
grant execute on function public.sataranga_commit_move(uuid, integer, integer, boolean) to authenticated;
grant execute on function public.sataranga_resign(uuid) to authenticated;
grant execute on function public.sataranga_offer_draw(uuid) to authenticated;
grant execute on function public.sataranga_answer_draw(uuid, boolean) to authenticated;
grant execute on function public.sataranga_abort(uuid) to authenticated;
grant execute on function public.sataranga_claim_time(uuid) to authenticated;
grant execute on function public.sataranga_rate(uuid) to authenticated;
grant execute on function public.sataranga_rate_bot(uuid, integer, text, text, text) to authenticated;
grant execute on function public.sataranga_rating() to authenticated;
grant execute on function public.sataranga_leaderboard() to authenticated;
grant execute on function public.sataranga_delete_account() to authenticated;

revoke all on function public.sataranga_enqueue(text, boolean) from public, anon;
revoke all on function public.sataranga_leave_queue() from public, anon;
revoke all on function public.sataranga_invite(text, boolean) from public, anon;
revoke all on function public.sataranga_join(text) from public, anon;
revoke all on function public.sataranga_active() from public, anon;
revoke all on function public.sataranga_open(uuid) from public, anon;
grant execute on function public.sataranga_enqueue(text, boolean) to authenticated;
grant execute on function public.sataranga_leave_queue() to authenticated;
grant execute on function public.sataranga_invite(text, boolean) to authenticated;
grant execute on function public.sataranga_join(text) to authenticated;
grant execute on function public.sataranga_active() to authenticated;
grant execute on function public.sataranga_open(uuid) to authenticated;
