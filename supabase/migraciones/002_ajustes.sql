-- ════════════════════════════════════════════════════════════════════════════
--  Migración 002 — Ajuste de promedios por la organización
--  Ejecutar UNA vez en: Supabase → SQL Editor → New query → pegar → Run
--  (La base se creó con la versión anterior de schema.sql.)
-- ════════════════════════════════════════════════════════════════════════════
begin;

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

-- La función cambia de columnas: hay que borrarla y crearla de nuevo.
drop function if exists public.resultados();

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

commit;
