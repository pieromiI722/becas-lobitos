import { supabase, configurado, aEmail } from './supabase.js'
import { esc } from './ui.js'

/** Devuelve el perfil del usuario logueado o null. */
export async function perfilActual() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data } = await supabase.from('perfiles').select('*').eq('id', session.user.id).maybeSingle()
  return data ?? { sinPerfil: true }
}

export async function salir() {
  await supabase.auth.signOut()
  location.reload()
}

/**
 * Pinta el formulario de ingreso en `root` y resuelve cuando hay un perfil válido.
 * @param {HTMLElement} root
 * @param {{ titulo: string, rolRequerido?: 'admin' }} opts
 */
export async function requerirIngreso(root, { titulo, rolRequerido } = {}) {
  if (!configurado) {
    root.innerHTML = aviso('Falta configurar Supabase', 'Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el archivo .env (o en Vercel).')
    return new Promise(() => {})
  }

  const perfil = await perfilActual()
  if (perfil && !perfil.sinPerfil && (!rolRequerido || perfil.rol === rolRequerido)) return perfil

  let error = ''
  if (perfil?.sinPerfil) error = 'Tu usuario no está habilitado como jurado. Avisa a la organización.'
  else if (perfil && rolRequerido) error = 'Esta sección es solo para la organización.'
  if (perfil) await supabase.auth.signOut()

  return new Promise((resolve) => {
    root.innerHTML = formulario(titulo, error)
    const form = root.querySelector('#login-form')
    const btn  = root.querySelector('#login-btn')
    const msg  = root.querySelector('#login-msg')

    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(form)
      btn.disabled = true
      btn.textContent = 'Ingresando…'
      msg.textContent = ''

      const { error: err } = await supabase.auth.signInWithPassword({
        email: aEmail(fd.get('usuario')),
        password: String(fd.get('password')),
      })

      if (err) {
        msg.textContent = 'Usuario o contraseña incorrectos.'
      } else {
        const p = await perfilActual()
        if (p && !p.sinPerfil && (!rolRequerido || p.rol === rolRequerido)) return resolve(p)
        msg.textContent = p?.sinPerfil
          ? 'Tu usuario no está habilitado como jurado.'
          : 'Esta sección es solo para la organización.'
        await supabase.auth.signOut()
      }
      btn.disabled = false
      btn.textContent = 'Ingresar'
    })
  })
}

function formulario(titulo, error) {
  return `
  <div class="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-12">
    <p class="text-[11px] uppercase tracking-[0.24em] text-teal sm:text-xs">Concurso de Declamación</p>
    <h1 class="mt-2 text-[2rem] font-bold leading-tight">${esc(titulo)}</h1>
    <form id="login-form" class="mt-8 flex flex-col gap-4 font-sans" novalidate>
      <label class="flex flex-col gap-1.5 text-[11px] uppercase tracking-[0.14em] text-slate sm:text-xs">
        Usuario
        <input name="usuario" required autocomplete="username" autocapitalize="none" spellcheck="false"
               class="min-h-[52px] rounded-sm border-[1.5px] border-sand bg-white px-3.5 py-3 text-base normal-case tracking-normal text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal">
      </label>
      <label class="flex flex-col gap-1.5 text-[11px] uppercase tracking-[0.14em] text-slate sm:text-xs">
        Contraseña
        <input name="password" type="password" required autocomplete="current-password"
               class="min-h-[52px] rounded-sm border-[1.5px] border-sand bg-white px-3.5 py-3 text-base normal-case tracking-normal text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal">
      </label>
      <button id="login-btn" type="submit"
              class="mt-2 min-h-[52px] cursor-pointer rounded-sm bg-teal px-7 py-3.5 text-base font-semibold text-paper transition-colors hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-wait disabled:opacity-60">Ingresar</button>
      <p id="login-msg" class="min-h-[1.5em] text-sm text-brick" aria-live="polite">${esc(error)}</p>
    </form>
  </div>`
}

export function aviso(titulo, texto) {
  return `
  <div class="mx-auto max-w-xl px-5 py-20 text-center">
    <h1 class="text-2xl font-bold">${esc(titulo)}</h1>
    <p class="mt-3 font-sans text-slate">${esc(texto)}</p>
  </div>`
}
