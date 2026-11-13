-- ════════════════════════════════════════════════════════════════════════════
--  Migración 004 — Turnos fijos asignados por la organización
--  Ejecutar UNA vez en: Supabase → SQL Editor → New query → pegar → Run
--
--  Antes de sortear, el admin puede fijar el turno de algunos concursantes
--  (p. ej. que alguien empiece primero). sortear() respeta esos turnos y sortea
--  al azar solo los demás. Los turnos fijos quedan marcados (fijo = true) y se
--  muestran como "Turno asignado" para que el sorteo sea transparente.
-- ════════════════════════════════════════════════════════════════════════════
begin;

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

commit;
