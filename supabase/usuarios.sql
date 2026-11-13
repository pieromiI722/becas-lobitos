-- ════════════════════════════════════════════════════════════════════════════
--  Alta de jurados y administrador (ejecutar en SQL Editor después de schema.sql)
--  Idempotente: si el usuario ya existe, solo actualiza contraseña y perfil.
--  En la web se ingresa solo con el usuario (ej. "mzuniga"); el email interno
--  es <usuario>@jurado.lobitos.test.
--  ⚠ Reemplaza las contraseñas antes de ejecutar. La versión con contraseñas
--    reales vive en supabase/privado/ (fuera de git).
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  r    record;
  uid  uuid;
  mail text;
begin
  for r in select * from (values
    -- usuario,        nombre,                                   rol,      contraseña
    ('mzuniga',        'Dra. María Teresa Zúñiga Norero',        'jurado', 'CAMBIAR'),
    ('ecarhuallanqui', 'Dr. Edilberto Carhuallanqui Berrocal',   'jurado', 'CAMBIAR'),
    ('carriola',       'Dra. Consuelo Arriola Jorge',            'jurado', 'CAMBIAR'),
    ('admin',          'Academia Lobitos',                       'admin',  'CAMBIAR')
  ) as v(usuario, nombre, rol, pass)
  loop
    if r.pass = 'CAMBIAR' or length(r.pass) < 8 then
      raise exception 'Contraseña inválida para %', r.usuario;
    end if;

    mail := r.usuario || '@jurado.lobitos.test';
    select id into uid from auth.users where email = mail;

    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change)
      values (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail,
        extensions.crypt(r.pass, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
        '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid, uid::text,
              jsonb_build_object('sub', uid::text, 'email', mail, 'email_verified', true),
              'email', now(), now(), now());
    else
      update auth.users
         set encrypted_password = extensions.crypt(r.pass, extensions.gen_salt('bf')), updated_at = now()
       where id = uid;
    end if;

    insert into public.perfiles (id, usuario, nombre, rol)
    values (uid, r.usuario, r.nombre, r.rol)
    on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol;
  end loop;
end $$;

-- Verificar:
-- select usuario, nombre, rol from public.perfiles order by rol, usuario;
