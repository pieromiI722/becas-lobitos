-- ════════════════════════════════════════════════════════════════════════════
--  Migración 003 — Sorteo del orden de presentación
--  Ejecutar UNA vez en: Supabase → SQL Editor → New query → pegar → Run
-- ════════════════════════════════════════════════════════════════════════════
begin;

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

commit;
