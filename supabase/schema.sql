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

-- ─── SORTEO DEL ORDEN DE PRESENTACIÓN ──────────────────────────────────────
-- Estado del sorteo por categoría.
--   sorteo_revelados: cuántos turnos ya se mostraron en la pantalla del sorteo
--   sorteo_intentos:  cuántas veces se sorteó (transparencia: se muestra al público)
alter table public.categorias
  add column sorteado_en       timestamptz,
  add column sorteo_revelados  int not null default 0,
  add column sorteo_intentos   int not null default 0;

-- Resultado del sorteo. Solo el admin lo lee directamente; el público recibe
-- únicamente los turnos ya revelados, vía orden_presentacion().
create table public.sorteo (
  concursante_id  bigint primary key references public.concursantes (id) on delete cascade,
  categoria_id    text   not null references public.categorias (id),
  turno           int    not null,
  unique (categoria_id, turno)
);

alter table public.sorteo enable row level security;
create policy "sorteo_lectura" on public.sorteo
  for select to authenticated using (public.es_admin());
-- Sin políticas de escritura: solo se escribe a través de sortear().

-- Sorteo hecho por la base de datos (nadie elige el resultado desde el navegador).
-- No se puede repetir si la categoría ya tiene calificaciones.
create function public.sortear(p_categoria text) returns int
language plpgsql volatile security definer set search_path = '' as $$
declare n int;
begin
  if not public.es_admin() then
    raise exception 'Solo la organización puede sortear';
  end if;
  if exists (select 1 from public.calificaciones k
             join public.concursantes x on x.id = k.concursante_id
             where x.categoria_id = p_categoria) then
    raise exception 'La categoría ya tiene calificaciones; no se puede volver a sortear';
  end if;

  delete from public.sorteo where categoria_id = p_categoria;
  insert into public.sorteo (concursante_id, categoria_id, turno)
  select id, categoria_id, row_number() over (order by random())
  from public.concursantes where categoria_id = p_categoria;
  get diagnostics n = row_count;

  update public.categorias
     set sorteado_en = now(), sorteo_revelados = 0, sorteo_intentos = sorteo_intentos + 1
   where id = p_categoria;
  return n;
end $$;

revoke execute on function public.sortear(text) from public, anon;
grant execute on function public.sortear(text) to authenticated;

-- Turnos visibles: el público y los jurados ven solo los ya revelados; el admin, todos.
create function public.orden_presentacion()
returns table (categoria_id text, concursante_id bigint, turno int)
language sql stable security definer set search_path = '' as $$
  select s.categoria_id, s.concursante_id, s.turno
  from public.sorteo s
  join public.categorias c on c.id = s.categoria_id
  where s.turno <= c.sorteo_revelados or public.es_admin()
  order by s.categoria_id, s.turno
$$;

grant execute on function public.orden_presentacion() to anon, authenticated;

-- ─── TURNOS FIJOS (migración 004) ──────────────────────────────────────────
create table public.turnos_fijos (
  concursante_id  bigint primary key references public.concursantes (id) on delete cascade,
  categoria_id    text   not null references public.categorias (id),
  turno           int    not null check (turno >= 1),
  unique (categoria_id, turno)
);

-- La categoría siempre se toma del concursante (no se confía en lo que envía el navegador).
create function public.turnos_fijos_categoria() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.categoria_id := (select categoria_id from public.concursantes where id = new.concursante_id);
  return new;
end $$;

create trigger turnos_fijos_categoria before insert or update on public.turnos_fijos
for each row execute function public.turnos_fijos_categoria();

-- Solo el admin, y solo mientras no se haya empezado a revelar turnos en esa categoría.
alter table public.turnos_fijos enable row level security;
create policy "fijos_lectura" on public.turnos_fijos
  for select to authenticated using (public.es_admin());
create policy "fijos_insert" on public.turnos_fijos
  for insert to authenticated
  with check (public.es_admin() and not exists (
    select 1 from public.categorias c where c.id = categoria_id and c.sorteo_revelados > 0));
create policy "fijos_update" on public.turnos_fijos
  for update to authenticated
  using (public.es_admin() and not exists (
    select 1 from public.categorias c where c.id = categoria_id and c.sorteo_revelados > 0))
  with check (public.es_admin() and not exists (
    select 1 from public.categorias c where c.id = categoria_id and c.sorteo_revelados > 0));
create policy "fijos_delete" on public.turnos_fijos
  for delete to authenticated
  using (public.es_admin() and not exists (
    select 1 from public.categorias c where c.id = categoria_id and c.sorteo_revelados > 0));

-- El resultado del sorteo recuerda qué turnos fueron asignados.
alter table public.sorteo add column fijo boolean not null default false;

-- Sorteo: primero los turnos fijos; los demás concursantes se reparten al azar
-- entre los turnos que quedan libres.
create or replace function public.sortear(p_categoria text) returns int
language plpgsql volatile security definer set search_path = '' as $$
declare n int;
begin
  if not public.es_admin() then
    raise exception 'Solo la organización puede sortear';
  end if;
  if exists (select 1 from public.calificaciones k
             join public.concursantes x on x.id = k.concursante_id
             where x.categoria_id = p_categoria) then
    raise exception 'La categoría ya tiene calificaciones; no se puede volver a sortear';
  end if;

  select count(*) into n from public.concursantes where categoria_id = p_categoria;
  if exists (select 1 from public.turnos_fijos where categoria_id = p_categoria and turno > n) then
    raise exception 'Hay un turno fijo mayor que la cantidad de concursantes (%)', n;
  end if;

  delete from public.sorteo where categoria_id = p_categoria;

  insert into public.sorteo (concursante_id, categoria_id, turno, fijo)
  select concursante_id, categoria_id, turno, true
  from public.turnos_fijos where categoria_id = p_categoria;

  insert into public.sorteo (concursante_id, categoria_id, turno, fijo)
  select r.id, p_categoria, l.t, false
  from (select x.id, row_number() over (order by random()) as rn
        from public.concursantes x
        where x.categoria_id = p_categoria
          and not exists (select 1 from public.turnos_fijos f where f.concursante_id = x.id)) r
  join (select t, row_number() over (order by t) as rn
        from generate_series(1, n) as t
        where not exists (select 1 from public.turnos_fijos f
                          where f.categoria_id = p_categoria and f.turno = t)) l
    on l.rn = r.rn;

  update public.categorias
     set sorteado_en = now(), sorteo_revelados = 0, sorteo_intentos = sorteo_intentos + 1
   where id = p_categoria;
  return n;
end $$;

-- orden_presentacion() ahora también indica si el turno fue asignado.
drop function if exists public.orden_presentacion();
create function public.orden_presentacion()
returns table (categoria_id text, concursante_id bigint, turno int, fijo boolean)
language sql stable security definer set search_path = '' as $$
  select s.categoria_id, s.concursante_id, s.turno, s.fijo
  from public.sorteo s
  join public.categorias c on c.id = s.categoria_id
  where s.turno <= c.sorteo_revelados or public.es_admin()
  order by s.categoria_id, s.turno
$$;

grant execute on function public.orden_presentacion() to anon, authenticated;

-- ─── REALTIME ───────────────────────────────────────────────────────────────
-- La página pública escucha "categorias" (cuando el admin publica).
-- El panel admin escucha "calificaciones" (progreso en vivo).
alter publication supabase_realtime add table public.categorias;
alter publication supabase_realtime add table public.calificaciones;
