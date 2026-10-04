alter table sataranga_profile add column if not exists losses integer not null default 0;
alter table sataranga_profile add column if not exists draws integer not null default 0;
