create table if not exists sataranga_profile (
  user_id text primary key,
  coins integer not null default 0,
  rating integer not null default 400,
  wins integer not null default 0,
  heads integer not null default 0,
  streak integer not null default 0,
  last_claim text not null default '',
  updated_at timestamptz not null default now()
);
