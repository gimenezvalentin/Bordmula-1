-- ============================================================================
-- Bórdmula 1 — esquema de base de datos + políticas RLS
-- Correr una sola vez en:  Supabase → SQL Editor → New query → Run
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ROSTER DE DIARIOS (los "equipos" del campeonato)
-- ---------------------------------------------------------------------------
create table if not exists papers (
  id       text primary key,                       -- 'clarin', 'la-nacion', ...
  name     text not null,
  color    text not null default '#14140F',        -- color de "librea"
  text_on  text not null default '#ffffff',        -- color de texto sobre la librea
  active   boolean not null default true,          -- aparece en la grilla
  sort     int not null default 0                  -- orden en la grilla
);

-- ---------------------------------------------------------------------------
-- FECHAS / GRANDES PREMIOS (una por programa)
-- ---------------------------------------------------------------------------
create table if not exists events (
  id           text primary key,                   -- '2026-09-03'
  date         date not null,
  label        text not null default '',           -- 'GP Buenos Aires'
  notes        text not null default '',
  published_at timestamptz
);

-- ---------------------------------------------------------------------------
-- RESULTADOS: una fila por (fecha, diario)
-- ---------------------------------------------------------------------------
create table if not exists results (
  id         uuid primary key default gen_random_uuid(),
  event_id   text not null references events(id) on delete cascade,
  paper_id   text not null references papers(id),
  kind       text not null check (kind in ('score','choco','sin-motor')),
  value      numeric(3,1) not null default 0,      -- 0.0 – 10.0 (solo si kind='score')
  comment    text not null default '',
  image_path text,                                 -- 'tapas/2026-09-03/clarin.jpg'
  unique (event_id, paper_id)
);

create index if not exists results_event_idx on results (event_id);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY: lee cualquiera, escribe solo con sesión autenticada
-- ---------------------------------------------------------------------------
alter table papers  enable row level security;
alter table events  enable row level security;
alter table results enable row level security;

drop policy if exists "read papers"   on papers;
drop policy if exists "read events"   on events;
drop policy if exists "read results"  on results;
drop policy if exists "write papers"  on papers;
drop policy if exists "write events"  on events;
drop policy if exists "write results" on results;

create policy "read papers"  on papers  for select using (true);
create policy "read events"  on events  for select using (true);
create policy "read results" on results for select using (true);

create policy "write papers"  on papers  for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "write events"  on events  for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "write results" on results for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- SEED del roster (colores editables después desde el botón "Diarios")
-- ---------------------------------------------------------------------------
insert into papers (id, name, color, text_on, sort) values
  ('clarin',    'Clarín',    '#D6001C', '#ffffff', 10),
  ('la-nacion', 'La Nación', '#0A2A66', '#ffffff', 20),
  ('ole',       'Olé',       '#111111', '#ffffff', 30),
  ('cronica',   'Crónica',   '#FFD200', '#14140f', 40)
on conflict (id) do nothing;

-- ============================================================================
-- STORAGE (hacer por interfaz, no por SQL):
--   1) Storage → New bucket → nombre "tapas" → marcar "Public bucket"
--   2) Storage → Policies → bucket "tapas" → New policy:
--        - SELECT  : para "anon" y "authenticated"   → USING (true)
--        - INSERT/UPDATE/DELETE : solo "authenticated"
--      (el editor de políticas de Storage tiene plantillas para esto)
-- ============================================================================
