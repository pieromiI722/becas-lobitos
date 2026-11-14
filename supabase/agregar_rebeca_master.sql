-- ════════════════════════════════════════════════════════════════════════════
--  Nueva concursante en Máster — TODO EN UNO
--  Ejecutar UNA vez en: Supabase → SQL Editor → New query → pegar → Run
--  (Si se ejecuta dos veces no duplica nada.)
--
--  Máster:  Rebeca Esteban Barzola — «El último beso» → ÚLTIMO turno de la categoría
--
--  · Si Máster aún NO se sorteó: queda como turno fijo = último; sortear() la respeta
--    y reparte al azar a los demás.
--  · Si Máster YA se sorteó: se agrega al final del orden (último turno + 1) sin tocar
--    los turnos de nadie. En /sorteo aparece como siguiente por revelar.
-- ════════════════════════════════════════════════════════════════════════════
begin;

-- 1. Concursante
insert into public.concursantes (categoria_id, orden, nombre, poema)
select 'master',
       (select coalesce(max(orden), 0) + 1 from public.concursantes where categoria_id = 'master'),
       'Rebeca Esteban Barzola',
       'El último beso'
where not exists (select 1 from public.concursantes where nombre = 'Rebeca Esteban Barzola');

-- 2. Turno fijo = último de Máster (cuenta ya incluye a Rebeca)
insert into public.turnos_fijos (concursante_id, turno)
select id, (select count(*) from public.concursantes where categoria_id = 'master')
from public.concursantes where nombre = 'Rebeca Esteban Barzola'
on conflict (concursante_id) do update set turno = excluded.turno;

-- 3. Si Máster ya tiene sorteo, agregarla al final del orden existente
insert into public.sorteo (concursante_id, categoria_id, turno, fijo)
select x.id, 'master', (select max(turno) + 1 from public.sorteo where categoria_id = 'master'), true
from public.concursantes x
where x.nombre = 'Rebeca Esteban Barzola'
  and exists (select 1 from public.sorteo where categoria_id = 'master')
on conflict (concursante_id) do nothing;

commit;

-- Verificación: Rebeca debe aparecer con el turno más alto de Máster
select x.nombre, x.poema, f.turno as turno_fijo, s.turno as turno_sorteo,
       (select count(*) from public.concursantes where categoria_id = 'master') as total_master
from public.concursantes x
left join public.turnos_fijos f on f.concursante_id = x.id
left join public.sorteo s       on s.concursante_id = x.id
where x.nombre = 'Rebeca Esteban Barzola';
