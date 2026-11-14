-- ════════════════════════════════════════════════════════════════════════════
--  Dejar la base lista para el concurso (borra TODO lo generado en pruebas)
--  ⚠ Solo para ANTES del concurso: si ya hay turnos revelados o calificaciones, se detiene solo.
--  Ejecutar en: Supabase → SQL Editor → New query → pegar → Run
--
--  Borra: calificaciones, ajustes de promedio y sorteos.
--  Reinicia: publicación y contadores de sorteo de todas las categorías.
--  NO toca: concursantes, jurados, administrador, contraseñas ni turnos fijos
--           (Secundaria: Romero Balbin = turno 1, Santos Román = turno 2;
--            Máster: Rebeca Esteban Barzola = último turno).
-- ════════════════════════════════════════════════════════════════════════════
begin;

-- Candado: si el concurso ya empezó (turnos revelados o calificaciones cargadas),
-- el script se detiene sin borrar nada.
do $$
begin
  if exists (select 1 from public.categorias where sorteo_revelados > 0)
     or exists (select 1 from public.calificaciones) then
    raise exception 'DETENIDO: ya hay sorteos revelados o calificaciones del concurso. Este script los borraría. No se hizo ningún cambio.';
  end if;
end $$;

delete from public.calificaciones;
delete from public.ajustes;
delete from public.sorteo;

update public.categorias
   set publicada        = false,
       publicada_en     = null,
       sorteado_en      = null,
       sorteo_revelados = 0,
       sorteo_intentos  = 0;

commit;

-- Verificación (todo debe dar 0 / false):
select
  (select count(*) from public.calificaciones) as calificaciones,
  (select count(*) from public.ajustes)        as ajustes,
  (select count(*) from public.sorteo)         as sorteos,
  (select count(*) from public.categorias where publicada or sorteo_intentos > 0) as categorias_con_estado,
  (select count(*) from public.concursantes)   as concursantes;   -- debe seguir en 72
