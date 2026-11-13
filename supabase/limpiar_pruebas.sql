-- ════════════════════════════════════════════════════════════════════════════
--  Dejar la base lista para el concurso (borra TODO lo generado en pruebas)
--  Ejecutar en: Supabase → SQL Editor → New query → pegar → Run
--
--  Borra: calificaciones, ajustes de promedio y sorteos.
--  Reinicia: publicación y contadores de sorteo de todas las categorías.
--  NO toca: concursantes, jurados, administrador ni contraseñas.
-- ════════════════════════════════════════════════════════════════════════════
begin;

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
  (select count(*) from public.concursantes)   as concursantes;   -- debe seguir en 63
