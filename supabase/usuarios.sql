-- ════════════════════════════════════════════════════════════════════════════
--  Alta de jurados y administrador
--
--  1) Supabase → Authentication → Users → "Add user" → "Create new user"
--     Email:    <usuario>@jurado.lobitos.test   (ej. jurado1@jurado.lobitos.test)
--     Password: la que le darás al jurado
--     ✔ Auto Confirm User
--     (En la web el jurado solo escribe "jurado1"; el dominio se agrega solo.)
--
--  2) Después de crearlos, ejecuta esto ajustando nombres reales:
-- ════════════════════════════════════════════════════════════════════════════

insert into public.perfiles (id, usuario, nombre, rol)
select u.id, split_part(u.email, '@', 1), v.nombre, v.rol
from auth.users u
join (values
  ('jurado1', 'Nombre del Jurado 1', 'jurado'),
  ('jurado2', 'Nombre del Jurado 2', 'jurado'),
  ('jurado3', 'Nombre del Jurado 3', 'jurado'),
  ('admin',   'Organización',        'admin')
) as v(usuario, nombre, rol) on split_part(u.email, '@', 1) = v.usuario
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol;

-- Verificar:
-- select usuario, nombre, rol from public.perfiles order by rol, usuario;
