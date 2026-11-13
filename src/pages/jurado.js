import '../style.css'
import { supabase } from '../lib/supabase.js'
import { requerirIngreso, salir } from '../lib/auth.js'
import { CRITERIOS, TOTAL_MAX } from '../lib/rubrica.js'
import { esc, $, $$, fmt, toast } from '../lib/ui.js'

const app = $('#app')

const estado = {
  perfil: null,
  categorias: [],
  concursantes: [],
  notas: new Map(),      // concursante_id → fila de calificaciones
  categoria: null,
  seleccionado: null,
  sucio: false,
}

// ─── INICIO ──────────────────────────────────────────────────────────────────

estado.perfil = await requerirIngreso(app, { titulo: 'Ingreso del jurado' })
$('#jurado-nombre').textContent = estado.perfil.nombre
$('#btn-salir').hidden = false
$('#btn-salir').addEventListener('click', () => {
  if (estado.sucio && !confirm('Tienes una calificación sin guardar. ¿Salir de todos modos?')) return
  salir()
})

window.addEventListener('beforeunload', (e) => { if (estado.sucio) e.preventDefault() })

await cargar()

// Si la organización publica una categoría mientras el jurado está dentro,
// el formulario pasa a solo lectura.
supabase.channel('jurado-categorias')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'categorias' }, ({ new: cat }) => {
    const c = estado.categorias.find((x) => x.id === cat.id)
    if (c) { c.publicada = cat.publicada; render() }
  })
  .subscribe()

// ─── DATOS ───────────────────────────────────────────────────────────────────

async function cargar() {
  app.innerHTML = `<p class="px-5 py-20 text-center font-sans text-slate">Cargando…</p>`

  const [cats, cons, notas] = await Promise.all([
    supabase.from('categorias').select('*').order('orden'),
    supabase.from('concursantes').select('*').order('orden', { nullsFirst: false }).order('nombre'),
    supabase.from('calificaciones').select('*').eq('jurado_id', estado.perfil.id),
  ])

  const err = cats.error || cons.error || notas.error
  if (err) {
    app.innerHTML = `<p class="px-5 py-20 text-center font-sans text-brick">No se pudo cargar la información: ${esc(err.message)}</p>`
    return
  }

  estado.categorias   = cats.data
  estado.concursantes = cons.data
  estado.notas        = new Map(notas.data.map((n) => [n.concursante_id, n]))
  estado.categoria  ??= estado.categorias.find((c) => !c.publicada && delCat(c.id).length)?.id ?? estado.categorias[0]?.id
  render()
}

const delCat = (id) => estado.concursantes.filter((c) => c.categoria_id === id)
const catActual = () => estado.categorias.find((c) => c.id === estado.categoria)

// ─── RENDER ──────────────────────────────────────────────────────────────────

function render() {
  const lista = delCat(estado.categoria)
  if (!estado.seleccionado || !lista.some((c) => c.id === estado.seleccionado)) {
    estado.seleccionado = (lista.find((c) => !estado.notas.has(c.id)) ?? lista[0])?.id ?? null
  }

  app.innerHTML = `
    <div class="mx-auto max-w-7xl px-5 py-6 sm:px-8">
      <nav class="flex flex-wrap gap-2 font-sans" aria-label="Categorías">${estado.categorias.map(tab).join('')}</nav>
      <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(300px,380px)_1fr]">
        <section aria-label="Concursantes">
          ${lista.length ? `<ol class="flex flex-col gap-2">${lista.map(itemLista).join('')}</ol>`
                         : `<p class="rounded-sm bg-white p-6 font-sans text-slate">Aún no hay concursantes en esta categoría.</p>`}
        </section>
        <section id="panel" aria-live="polite">${panel()}</section>
      </div>
    </div>`

  $$('[data-cat]').forEach((b) => b.addEventListener('click', () => cambiar(() => {
    estado.categoria = b.dataset.cat
    estado.seleccionado = null
  })))
  $$('[data-con]').forEach((b) => b.addEventListener('click', () => cambiar(() => {
    estado.seleccionado = Number(b.dataset.con)
  })))
  conectarFormulario()
}

function cambiar(fn) {
  if (estado.sucio && !confirm('Tienes una calificación sin guardar. ¿Descartarla?')) return
  estado.sucio = false
  fn()
  render()
}

function tab(c) {
  const lista = delCat(c.id)
  const hechos = lista.filter((x) => estado.notas.has(x.id)).length
  const activo = c.id === estado.categoria
  return `
    <button type="button" data-cat="${c.id}" aria-pressed="${activo}"
            class="cursor-pointer rounded-sm border-[1.5px] px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal
                   ${activo ? 'border-ink bg-ink text-paper' : 'border-sand bg-white text-ink hover:border-ink'}">
      ${esc(c.nombre)}
      <span class="ml-1.5 font-normal ${activo ? 'text-mist' : 'text-slate'}">${hechos}/${lista.length}</span>
      ${c.publicada ? `<span class="ml-1.5 rounded-sm bg-gold px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink">Publicada</span>` : ''}
    </button>`
}

function itemLista(c) {
  const nota = estado.notas.get(c.id)
  const activo = c.id === estado.seleccionado
  return `
    <li>
      <button type="button" data-con="${c.id}" aria-current="${activo}"
              class="flex w-full cursor-pointer items-center gap-3 rounded-sm border-l-[5px] bg-white px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal
                     ${activo ? 'border-teal ring-2 ring-teal' : nota ? 'border-gold hover:bg-sand-200/50' : 'border-sand hover:bg-sand-200/50'}">
        <span class="w-7 shrink-0 font-sans text-sm font-bold text-slate">${c.orden ?? '·'}</span>
        <span class="min-w-0 flex-1">
          <span class="block truncate font-semibold leading-tight">${esc(c.nombre)}</span>
          ${c.institucion ? `<span class="block truncate font-sans text-xs text-slate">${esc(c.institucion)}</span>` : ''}
        </span>
        <span class="shrink-0 font-sans text-sm font-bold ${nota ? 'text-teal' : 'text-sand-600'}">${nota ? fmt(nota.total, 1) : 'Pendiente'}</span>
      </button>
    </li>`
}

function panel() {
  const c = estado.concursantes.find((x) => x.id === estado.seleccionado)
  if (!c) return ''
  const nota = estado.notas.get(c.id)
  const bloqueado = catActual()?.publicada

  return `
    <form id="calif-form" class="lob-rise bg-white p-6 sm:p-8" novalidate>
      <p class="font-sans text-[11px] uppercase tracking-[0.18em] text-teal">${esc(catActual()?.nombre)} · Nº ${c.orden ?? '—'}</p>
      <h2 class="mt-1 text-2xl font-bold leading-tight sm:text-[2rem]">${esc(c.nombre)}</h2>
      ${c.institucion ? `<p class="mt-1 font-sans text-sm text-slate">${esc(c.institucion)}</p>` : ''}
      ${c.poema ? `<p class="mt-2 font-sans text-sm"><span class="text-[11px] uppercase tracking-[0.14em] text-slate">Poema</span> <span class="font-semibold">${esc(c.poema)}</span></p>` : ''}

      ${bloqueado ? `<p class="mt-4 rounded-sm bg-gold/30 px-4 py-3 font-sans text-sm">Esta categoría ya fue publicada. Las calificaciones están cerradas.</p>` : ''}

      <fieldset class="mt-6 flex flex-col font-sans" ${bloqueado ? 'disabled' : ''}>
        <legend class="sr-only">Criterios de evaluación</legend>
        ${CRITERIOS.map((k, i) => filaCriterio(k, i, nota?.[k.campo])).join('')}
      </fieldset>

      <label class="mt-5 flex flex-col gap-1.5 font-sans text-[11px] uppercase tracking-[0.14em] text-slate">
        Observaciones (opcional, no se publican)
        <textarea name="observaciones" rows="2" ${bloqueado ? 'disabled' : ''}
                  class="rounded-sm border-[1.5px] border-sand bg-white px-3.5 py-2.5 text-base normal-case tracking-normal text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal">${esc(nota?.observaciones ?? '')}</textarea>
      </label>

      <div class="mt-6 flex flex-wrap items-center justify-between gap-4 border-t-[3px] border-ink pt-5">
        <p class="font-sans">
          <span class="text-[11px] uppercase tracking-[0.18em] text-slate">Total</span>
          <span id="total" class="ml-2 text-4xl font-extrabold tabular-nums">${fmt(nota?.total ?? 0, 1)}</span>
          <span class="text-lg text-slate">/ ${TOTAL_MAX}</span>
        </p>
        ${bloqueado ? '' : `
        <button id="btn-guardar" type="submit"
                class="min-h-[52px] cursor-pointer rounded-sm bg-teal px-8 py-3.5 font-sans text-base font-semibold text-paper transition-colors hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-wait disabled:opacity-60">
          ${nota ? 'Actualizar calificación' : 'Guardar calificación'}
        </button>`}
      </div>
      <p id="form-msg" class="mt-3 min-h-[1.25em] font-sans text-sm text-brick"></p>
    </form>`
}

function filaCriterio(k, i, valor) {
  const v = valor ?? ''
  return `
    <div class="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-b border-sand-200 py-3.5 sm:grid-cols-[1fr_200px_auto]">
      <label for="c-${k.campo}" class="text-[0.9375rem] font-medium leading-snug">
        <span class="text-slate">${i + 1}.</span> ${esc(k.nombre)}
      </label>
      <input type="range" min="0" max="${k.max}" step="0.5" value="${v === '' ? 0 : v}" data-range="${k.campo}" tabindex="-1" aria-hidden="true"
             class="order-last col-span-2 w-full accent-teal sm:order-none sm:col-span-1 ${v === '' ? 'opacity-40' : ''}">
      <span class="flex items-center gap-1.5">
        <input id="c-${k.campo}" name="${k.campo}" type="number" inputmode="decimal" min="0" max="${k.max}" step="0.5" value="${v}" required
               class="w-20 rounded-sm border-[1.5px] border-sand bg-white px-2.5 py-2 text-right text-lg font-bold tabular-nums text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal aria-[invalid=true]:border-brick">
        <span class="w-9 text-sm text-slate">/ ${k.max}</span>
      </span>
    </div>`
}

// ─── FORMULARIO ──────────────────────────────────────────────────────────────

function conectarFormulario() {
  const form = $('#calif-form')
  if (!form) return

  const leer = () => {
    let total = 0, valido = true
    const datos = {}
    for (const k of CRITERIOS) {
      const input = form.elements[k.campo]
      const raw = input.value.trim().replace(',', '.')
      const n = Number(raw)
      const ok = raw !== '' && Number.isFinite(n) && n >= 0 && n <= k.max
      input.setAttribute('aria-invalid', String(raw !== '' && !ok))
      if (!ok) valido = false
      else { datos[k.campo] = n; total += n }
    }
    $('#total').textContent = fmt(total, 1)
    return { datos, valido }
  }

  form.addEventListener('input', (e) => {
    estado.sucio = true
    const campo = e.target.dataset.range
    if (campo) {
      form.elements[campo].value = e.target.value
      e.target.classList.remove('opacity-40')
    } else if (e.target.name && form.elements[e.target.name]?.type === 'number') {
      const r = form.querySelector(`[data-range="${e.target.name}"]`)
      if (r && e.target.value !== '') { r.value = e.target.value; r.classList.remove('opacity-40') }
    }
    leer()
    $('#form-msg').textContent = ''
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const { datos, valido } = leer()
    if (!valido) {
      $('#form-msg').textContent = 'Completa todos los criterios con un puntaje entre 0 y el máximo indicado.'
      const malo = CRITERIOS.map((k) => form.elements[k.campo])
        .find((el) => el.value.trim() === '' || el.getAttribute('aria-invalid') === 'true')
      malo?.focus()
      return
    }

    const btn = $('#btn-guardar')
    btn.disabled = true
    btn.textContent = 'Guardando…'

    const fila = {
      ...datos,
      jurado_id: estado.perfil.id,
      concursante_id: estado.seleccionado,
      observaciones: form.elements.observaciones.value.trim() || null,
    }
    const { data, error } = await supabase
      .from('calificaciones')
      .upsert(fila, { onConflict: 'jurado_id,concursante_id' })
      .select()
      .single()

    if (error) {
      btn.disabled = false
      btn.textContent = 'Reintentar'
      $('#form-msg').textContent = /row-level security/i.test(error.message)
        ? 'No se pudo guardar: la categoría ya está cerrada.'
        : `No se pudo guardar: ${error.message}`
      return
    }

    estado.notas.set(data.concursante_id, data)
    estado.sucio = false
    toast(`Guardado: ${fmt(data.total, 1)} puntos`)

    // Pasa al siguiente concursante pendiente de la misma categoría.
    const siguiente = delCat(estado.categoria).find((c) => !estado.notas.has(c.id))
    if (siguiente) estado.seleccionado = siguiente.id
    render()
  })

  if (!form.querySelector('fieldset').disabled) form.querySelector('input[type=number]')?.focus()
}
