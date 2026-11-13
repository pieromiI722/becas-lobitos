-- ════════════════════════════════════════════════════════════════════════════
--  Concurso de Declamación — Academia Lobitos
--  Ejecutar UNA vez en: Supabase → SQL Editor → New query → pegar → Run
-- ════════════════════════════════════════════════════════════════════════════

-- ─── CATEGORÍAS ─────────────────────────────────────────────────────────────
create table public.categorias (
  id            text primary key,
  nombre        text not null,
  descripcion   text,
  orden         int  not null,
  publicada     boolean not null default false,
  publicada_en  timestamptz
);

insert into public.categorias (id, nombre, descripcion, orden) values
  ('primaria_a', 'Primaria A', '1°, 2° y 3° grado', 1),
  ('primaria_b', 'Primaria B', '4°, 5° y 6° grado', 2),
  ('secundaria', 'Secundaria', null,                3),
  ('master',     'Máster',     null,                4),
  ('avanzados',  'Avanzados',  null,                5);

-- ─── PERFILES (jurados y administradores) ───────────────────────────────────
-- Solo quien tenga una fila aquí puede calificar. Crear el usuario en
-- Authentication → Users y luego insertar su perfil (ver supabase/usuarios.sql).
create table public.perfiles (
  id       uuid primary key references auth.users (id) on delete cascade,
  usuario  text not null unique,
  nombre   text not null,
  rol      text not null default 'jurado' check (rol in ('jurado', 'admin'))
);

-- ─── CONCURSANTES ───────────────────────────────────────────────────────────
create table public.concursantes (
  id            bigint generated always as identity primary key,
  categoria_id  text not null references public.categorias (id),
  orden         int,
  nombre        text not null,
  institucion   text,
  poema         text,
  created_at    timestamptz not null default now()
);
create index on public.concursantes (categoria_id, orden);

-- ─── CALIFICACIONES ─────────────────────────────────────────────────────────
-- Una fila por (jurado, concursante). Rúbrica sobre 100 puntos.
create table public.calificaciones (
  id                  bigint generated always as identity primary key,
  jurado_id           uuid   not null default auth.uid() references public.perfiles (id) on delete cascade,
  concursante_id      bigint not null references public.concursantes (id) on delete cascade,
  interpretacion      numeric(4,1) not null check (interpretacion     between 0 and 25),
  expresion_vocal     numeric(4,1) not null check (expresion_vocal    between 0 and 20),
  diccion             numeric(4,1) not null check (diccion            between 0 and 15),
  expresion_corporal  numeric(4,1) not null check (expresion_corporal between 0 and 15),
  dominio_escenico    numeric(4,1) not null check (dominio_escenico   between 0 and 10),
  memorizacion        numeric(4,1) not null check (memorizacion       between 0 and 5),
  conexion            numeric(4,1) not null check (conexion           between 0 and 10),
  total numeric(5,1) generated always as (
    interpretacion + expresion_vocal + diccion + expresion_corporal
    + dominio_escenico + memorizacion + conexion
  ) stored,
  observaciones       text,
  updated_at          timestamptz not null default now(),
  unique (jurado_id, concursante_id)
);
create index on public.calificaciones (concursante_id);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

create trigger calificaciones_touch before update on public.calificaciones
for each row execute function public.touch_updated_at();

-- ─── AJUSTES DE LA ORGANIZACIÓN ─────────────────────────────────────────────
-- Promedio final fijado por el admin antes de publicar (p. ej. para resolver
-- empates). Tabla aparte porque "concursantes" es pública y el ajuste no debe
-- verse hasta que la categoría se publique.
create table public.ajustes (
  concursante_id  bigint primary key references public.concursantes (id) on delete cascade,
  promedio        numeric(5,2) not null check (promedio between 0 and 100),
  updated_at      timestamptz not null default now()
);

create trigger ajustes_touch before update on public.ajustes
for each row execute function public.touch_updated_at();

-- ─── HELPERS DE ROL ─────────────────────────────────────────────────────────
create function public.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin')
$$;

create function public.es_jurado() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where id = auth.uid())
$$;

-- ¿La categoría del concursante ya fue publicada? (bloquea ediciones)
create function public.concursante_publicado(p_concursante bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select c.publicada from public.concursantes x
    join public.categorias c on c.id = x.categoria_id
    where x.id = p_concursante), false)
$$;

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.categorias     enable row level security;
alter table public.perfiles       enable row level security;
alter table public.concursantes   enable row level security;
alter table public.calificaciones enable row level security;

-- Categorías: todos leen; solo admin publica.
create policy "categorias_lectura" on public.categorias
  for select to anon, authenticated using (true);
create policy "categorias_admin" on public.categorias
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

-- Perfiles: cada uno ve el suyo; admin ve todos.
create policy "perfiles_lectura" on public.perfiles
  for select to authenticated using (id = auth.uid() or public.es_admin());

-- Concursantes: lista pública; solo admin edita.
create policy "concursantes_lectura" on public.concursantes
  for select to anon, authenticated using (true);
create policy "concursantes_admin_ins" on public.concursantes
  for insert to authenticated with check (public.es_admin());
create policy "concursantes_admin_upd" on public.concursantes
  for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "concursantes_admin_del" on public.concursantes
  for delete to authenticated using (public.es_admin());

-- Calificaciones: el jurado ve y edita SOLO las suyas, y solo mientras la
-- categoría no esté publicada. El admin ve todas. El público no ve ninguna.
create policy "calif_lectura" on public.calificaciones
  for select to authenticated using (jurado_id = auth.uid() or public.es_admin());
create policy "calif_insert" on public.calificaciones
  for insert to authenticated
  with check (jurado_id = auth.uid() and public.es_jurado()
              and not public.concursante_publicado(concursante_id));
create policy "calif_update" on public.calificaciones
  for update to authenticated
  using (jurado_id = auth.uid() and not public.concursante_publicado(concursante_id))
  with check (jurado_id = auth.uid() and not public.concursante_publicado(concursante_id));
create policy "calif_admin_del" on public.calificaciones
  for delete to authenticated using (public.es_admin());

-- Ajustes: solo el admin, y solo mientras la categoría no esté publicada.
alter table public.ajustes enable row level security;
create policy "ajustes_lectura" on public.ajustes
  for select to authenticated using (public.es_admin());
create policy "ajustes_insert" on public.ajustes
  for insert to authenticated
  with check (public.es_admin() and not public.concursante_publicado(concursante_id));
create policy "ajustes_update" on public.ajustes
  for update to authenticated
  using (public.es_admin() and not public.concursante_publicado(concursante_id))
  with check (public.es_admin() and not public.concursante_publicado(concursante_id));
create policy "ajustes_delete" on public.ajustes
  for delete to authenticated
  using (public.es_admin() and not public.concursante_publicado(concursante_id));

-- ─── RESULTADOS ─────────────────────────────────────────────────────────────
-- Promedio final = ajuste del admin si existe; si no, promedio de los jurados.
-- Desempate automático (si el admin no ajusta): mayor promedio en "Interpretación".
-- El público solo recibe categorías publicadas y nunca ve si hubo ajuste;
-- el admin recibe todas, con el promedio de jurados y la marca de ajuste.
create function public.resultados()
returns table (
  categoria_id         text,
  concursante_id       bigint,
  orden                int,
  nombre               text,
  institucion          text,
  poema                text,
  promedio             numeric,
  jurados_calificaron  int,
  puesto               int,
  promedio_jurados     numeric,
  ajustado             boolean
)
language sql stable security definer set search_path = '' as $$
  with base as (
    select x.categoria_id, x.id, x.orden, x.nombre, x.institucion, x.poema,
           round(avg(k.total), 2)   as prom_jurados,
           avg(k.interpretacion)    as desempate,
           count(k.id)::int         as jurados_calificaron,
           max(a.promedio)          as ajuste
    from public.concursantes x
    join public.categorias c on c.id = x.categoria_id
    left join public.calificaciones k on k.concursante_id = x.id
    left join public.ajustes a on a.concursante_id = x.id
    where c.publicada or public.es_admin()
    group by x.id
  ), fin as (
    select *, coalesce(ajuste, prom_jurados) as prom_final from base
  )
  select categoria_id, id, orden, nombre, institucion, poema, prom_final, jurados_calificaron,
         case when prom_final is null then null
              else (rank() over (partition by categoria_id
                                 order by prom_final desc nulls last, desempate desc nulls last))::int
         end,
         case when public.es_admin() then prom_jurados end,
         case when public.es_admin() then ajuste is not null end
  from fin
  order by categoria_id, prom_final desc nulls last, desempate desc nulls last, orden
$$;

grant execute on function public.resultados() to anon, authenticated;

-- ─── REALTIME ───────────────────────────────────────────────────────────────
-- La página pública escucha "categorias" (cuando el admin publica).
-- El panel admin escucha "calificaciones" (progreso en vivo).
alter publication supabase_realtime add table public.categorias;
alter publication supabase_realtime add table public.calificaciones;
