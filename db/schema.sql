-- Posadita — esquema de base de datos
-- Ejecuta este archivo completo en Supabase → SQL Editor (o con psql).
-- Es idempotente: puedes correrlo más de una vez.

create table if not exists events (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  admin_token      text not null unique,
  name             text not null check (char_length(name) between 2 and 120),
  description      text check (char_length(description) <= 1000),
  location         text check (char_length(location) <= 200),
  event_at         timestamptz,
  timezone         text not null default 'America/Mexico_City',
  max_amount_mxn   integer not null check (max_amount_mxn between 1 and 1000000),
  signup_deadline  timestamptz,
  capacity         integer check (capacity between 3 and 200),
  organizer_name   text not null,
  organizer_email  text not null,
  status           text not null default 'open' check (status in ('open', 'drawn')),
  drawn_at         timestamptz,
  reminder_sent_at timestamptz,
  created_at       timestamptz not null default now()
);

create table if not exists participants (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  email         text not null check (char_length(email) <= 254),
  phone         text,                      -- E.164, p. ej. +526621234567
  access_token  text not null unique,
  is_organizer  boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (event_id, email)
);
create index if not exists participants_event_idx on participants(event_id);

create table if not exists wishlist_items (
  id              uuid primary key default gen_random_uuid(),
  participant_id  uuid not null references participants(id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 140),
  note            text check (char_length(note) <= 1000),
  url             text check (char_length(url) <= 2000),
  image_path      text,
  est_price_mxn   integer check (est_price_mxn between 0 and 1000000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists wishlist_items_participant_idx on wishlist_items(participant_id);

-- Quién le regala a quién. Solo se lee con el access_token del que regala.
create table if not exists assignments (
  event_id     uuid not null references events(id) on delete cascade,
  giver_id     uuid not null references participants(id) on delete cascade,
  receiver_id  uuid not null references participants(id) on delete cascade,
  primary key (event_id, giver_id),
  unique (event_id, receiver_id),
  check (giver_id <> receiver_id)
);

-- Pares que no deben tocarse entre sí (p. ej. parejas). a_id < b_id.
create table if not exists exclusions (
  event_id  uuid not null references events(id) on delete cascade,
  a_id      uuid not null references participants(id) on delete cascade,
  b_id      uuid not null references participants(id) on delete cascade,
  primary key (event_id, a_id, b_id),
  check (a_id < b_id)
);

-- Invitaciones del organizador. Solo quien acepta se vuelve participante.
create table if not exists invitations (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  email         text not null check (char_length(email) <= 254),
  token         text not null unique,
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  unique (event_id, email)
);
create index if not exists invitations_event_idx on invitations(event_id);
-- Último envío del correo de invitación (para no reenviarlo en ráfaga).
alter table invitations add column if not exists last_sent_at timestamptz;

-- Para "¿perdiste tu panel?": buscar eventos por correo del organizador.
create index if not exists events_organizer_email_idx on events(organizer_email);

-- Número de evento (6 dígitos) para entrar desde el inicio con número + correo.
-- Los eventos que ya existían reciben uno al azar, sin repetir.
alter table events add column if not exists code integer check (code between 100000 and 999999);
do $$
declare
  r record;
  c int;
begin
  for r in select id from events where code is null loop
    loop
      c := 100000 + floor(random() * 900000)::int;
      exit when not exists (select 1 from events where code = c);
    end loop;
    update events set code = c where id = r.id;
  end loop;
end $$;
create unique index if not exists events_code_key on events(code);
alter table events alter column code set not null;

-- Límite de peticiones en ventanas fijas (anti-abuso de correo). Se limpia a diario.
create table if not exists rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  count         integer not null default 0,
  primary key (key, window_start)
);

-- Códigos de 4 dígitos para entrar al evento con el correo. Solo se guarda el hash.
create table if not exists login_codes (
  id          bigint generated always as identity primary key,
  event_id    uuid not null references events(id) on delete cascade,
  email       text not null,
  code_hash   text not null,
  expires_at  timestamptz not null,
  attempts    integer not null default 0,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists login_codes_lookup_idx on login_codes(event_id, email, created_at desc);
-- 'login' = entrar al evento; 'invite' = confirmar el correo al aceptar una invitación.
alter table login_codes add column if not exists purpose text not null default 'login' check (purpose in ('login', 'invite'));

-- Sesiones del navegador (cookie). Solo se guarda el hash del token; caducan y
-- se borran al cerrar sesión o al generar un enlace personal nuevo.
create table if not exists sessions (
  id              uuid primary key default gen_random_uuid(),
  participant_id  uuid not null references participants(id) on delete cascade,
  token_hash      text not null unique,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null
);
create index if not exists sessions_participant_idx on sessions(participant_id);

create table if not exists notifications (
  id              bigint generated always as identity primary key,
  event_id        uuid not null references events(id) on delete cascade,
  participant_id  uuid references participants(id) on delete set null,
  channel         text not null default 'email',
  kind            text not null,           -- registered | organizer | draw | reminder | invitation | login_code | invite_code | join_code | new_link | access_resend | admin_recovery
  status          text not null,           -- sent | failed | logged
  error           text,
  created_at      timestamptz not null default now()
);
create index if not exists notifications_event_idx on notifications(event_id);

-- La app se conecta directo a Postgres desde el servidor (rol postgres), que
-- no está sujeto a RLS. Activamos RLS sin políticas para que la API pública de
-- Supabase (anon key) NO pueda leer nada.
alter table events          enable row level security;
alter table participants    enable row level security;
alter table wishlist_items  enable row level security;
alter table assignments     enable row level security;
alter table exclusions      enable row level security;
alter table notifications   enable row level security;
alter table invitations     enable row level security;
alter table login_codes     enable row level security;
alter table rate_limits     enable row level security;
alter table sessions        enable row level security;

-- Enlace genérico para unirse sin invitación directa (/u/[join_token]).
-- El organizador lo puede desactivar o generar uno nuevo (el anterior deja de servir).
alter table events add column if not exists join_token text;
alter table events add column if not exists join_enabled boolean not null default true;
update events
  set join_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  where join_token is null;
create unique index if not exists events_join_token_key on events(join_token);
-- Default en la BD: así crear eventos sigue funcionando aunque el código desplegado aún sea el anterior.
alter table events alter column join_token
  set default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
alter table events alter column join_token set not null;

-- 'join' = confirmar el correo al unirse con el enlace genérico.
alter table login_codes drop constraint if exists login_codes_purpose_check;
alter table login_codes add constraint login_codes_purpose_check check (purpose in ('login', 'invite', 'join'));
