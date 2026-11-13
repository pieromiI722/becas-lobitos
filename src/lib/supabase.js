import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configurado = Boolean(url && key)

export const supabase = configurado
  ? createClient(url, key, { auth: { persistSession: true, storageKey: 'lobitos-concurso' } })
  : null

// Los jurados escriben solo su usuario ("jurado1"); Supabase Auth necesita un email.
export const DOMINIO_USUARIOS = 'jurado.lobitos.test'

export const aEmail = (usuario) => {
  const u = String(usuario ?? '').trim().toLowerCase()
  return u.includes('@') ? u : `${u}@${DOMINIO_USUARIOS}`
}
