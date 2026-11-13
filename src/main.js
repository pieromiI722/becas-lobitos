import './style.css'
import { supabase, configurado } from './lib/supabase.js'
import { CRITERIOS, TOTAL_MAX } from './lib/rubrica.js'
import { esc, $, $$, fmt } from './lib/ui.js'

// ─── RÚBRICA (sección "Cómo califica el jurado") ─────────────────────────────

const maxPeso = Math.max(...CRITERIOS.map((c) => c.max))
$('#rubrica').innerHTML = CRITERIOS.map((c) => `
  <li>
    <div class="flex items-baseline justify-between gap-4 text-[0.9375rem]">
      <span class="font-medium">${esc(c.nombre)}</span>
      <span class="shrink-0 font-bold tabular-nums">${c.max} pts</span>
    </div>
    <div class="mt-1.5 h-2 bg-sand-200"><div class="h-full bg-teal" style="width:${(c.max / maxPeso) * 100}%"></div></div>
  </li>`).join('') + `
  <li class="mt-1 flex items-baseline justify-between border-t-[3px] border-ink pt-3 text-base font-extrabold">
    <span>Total</span><span class="tabular-nums">${TOTAL_MAX} pts</span>
  </li>`

// ─── RESULTADOS ──────────────────────────────────────────────────────────────

const tabsEl  = $('#tabs')
const panelEl = $('#panel-resultados')

const estado = { categorias: [], concursantes: [], resultados: [], activa: null }

async function cargar() {
  const [cats, cons, res] = await Promise.all([
    supabase.from('categorias').select('*').order('orden'),
    supabase.from('concursantes').select('id, categoria_id, orden, nombre, institucion').order('orden', { nullsFirst: false }).order('nombre'),
    supabase.rpc('resultados'),
  ])
  if (cats.error || cons.error || res.error) {
    panelEl.innerHTML = mensaje('No pudimos cargar los resultados. Recarga la página en unos segundos.')
    return
  }
  estado.categorias   = cats.data
  estado.concursantes = cons.data
  estado.resultados   = res.data

  // Por defecto: la última categoría publicada; si no hay, la primera.
  const publicadas = estado.categorias.filter((c) => c.publicada)
    .sort((a, b) => new Date(b.publicada_en) - new Date(a.publicada_en))
  if (!estado.activa || !estado.categorias.some((c) => c.id === estado.activa)) {
    estado.activa = publicadas[0]?.id ?? estado.categorias[0]?.id
  }
  render()
}

function render() {
  tabsEl.innerHTML = estado.categorias.map((c) => {
    const activa = c.id === estado.activa
    return `
      <button type="button" role="tab" aria-selected="${activa}" data-cat="${c.id}"
              class="shrink-0 cursor-pointer rounded-sm border-[1.5px] px-5 py-3 text-[0.9375rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal
                     ${activa ? 'border-ink bg-ink text-paper' : 'border-sand bg-white text-ink hover:border-ink'}">
        ${esc(c.nombre)}
        ${c.publicada ? `<span class="ml-1.5 inline-block h-2 w-2 rounded-full bg-gold align-middle" aria-label="publicada"></span>` : ''}
      </button>`
  }).join('')

  $$('[data-cat]', tabsEl).forEach((b) => b.addEventListener('click', () => {
    estado.activa = b.dataset.cat
    render()
  }))

  const cat = estado.categorias.find((c) => c.id === estado.activa)
  panelEl.innerHTML = cat?.publicada ? publicada(cat) : pendiente(cat)
}

function publicada(cat) {
  const filas = estado.resultados.filter((r) => r.categoria_id === cat.id && r.puesto != null)
  if (!filas.length) return mensaje('Esta categoría no tiene calificaciones registradas.')

  const podio = filas.filter((r) => r.puesto <= 3)
  const resto = filas.filter((r) => r.puesto > 3)

  return `
    <div class="lob-rise">
      <ol class="grid gap-4 md:grid-cols-3 md:items-end">
        ${podio.map(tarjetaPodio).join('')}
      </ol>
      ${resto.length ? `
        <ol class="mt-8 border-t-[3px] border-ink">
          ${resto.map((r) => `
            <li class="flex items-center gap-4 border-b border-sand-200 py-3.5">
              <span class="w-10 shrink-0 font-sans text-lg font-extrabold tabular-nums text-slate">${r.puesto}°</span>
              <span class="min-w-0 flex-1">
                <span class="block font-semibold leading-tight sm:text-lg">${esc(r.nombre)}</span>
                ${r.institucion ? `<span class="block truncate font-sans text-sm text-slate">${esc(r.institucion)}</span>` : ''}
              </span>
              <span class="shrink-0 font-sans text-lg font-bold tabular-nums">${fmt(r.promedio)}</span>
            </li>`).join('')}
        </ol>` : ''}
      <p class="mt-5 font-sans text-xs text-slate">Puntaje sobre ${TOTAL_MAX}. Publicado el ${new Date(cat.publicada_en).toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' })}.</p>
    </div>`
}

const PODIO = {
  1: { orden: 'md:order-2', caja: 'bg-ink text-paper md:pb-12', medalla: 'bg-gold text-ink', etiqueta: 'Campeón', sub: 'text-mist' },
  2: { orden: 'md:order-1', caja: 'bg-white', medalla: 'bg-mist text-ink', etiqueta: 'Segundo puesto', sub: 'text-slate' },
  3: { orden: 'md:order-3', caja: 'bg-white', medalla: 'bg-sand text-ink', etiqueta: 'Tercer puesto', sub: 'text-slate' },
}

function tarjetaPodio(r) {
  const s = PODIO[r.puesto]
  return `
    <li class="${s.orden} ${s.caja} flex flex-col gap-3 border-t-[6px] border-gold p-6 sm:p-7">
      <span class="flex items-center gap-3">
        <span class="flex h-12 w-12 items-center justify-center rounded-full font-sans text-xl font-extrabold ${s.medalla}">${r.puesto}°</span>
        <span class="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] ${s.sub}">${s.etiqueta}</span>
      </span>
      <span class="text-[1.5rem] font-bold leading-tight sm:text-[1.75rem]">${esc(r.nombre)}</span>
      ${r.institucion ? `<span class="font-sans text-sm ${s.sub}">${esc(r.institucion)}</span>` : ''}
      <span class="mt-auto font-sans"><span class="text-3xl font-extrabold tabular-nums">${fmt(r.promedio)}</span> <span class="text-sm ${s.sub}">/ ${TOTAL_MAX}</span></span>
    </li>`
}

function pendiente(cat) {
  if (!cat) return mensaje('Pronto publicaremos los resultados.')
  const lista = estado.concursantes.filter((c) => c.categoria_id === cat.id)
  return `
    <div class="lob-rise">
      <div class="border-l-[6px] border-gold bg-white p-6 sm:p-8">
        <p class="text-xl font-bold sm:text-2xl">Los resultados de ${esc(cat.nombre)} aún no se publican</p>
        <p class="mt-2 font-sans text-[0.9375rem] text-slate">Aparecerán aquí automáticamente en cuanto el jurado termine de deliberar. No hace falta recargar la página.</p>
      </div>
      ${lista.length ? `
        <h3 class="mt-8 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-slate">Concursantes · ${lista.length}</h3>
        <ol class="mt-3 grid gap-x-8 sm:grid-cols-2">
          ${lista.map((c) => `
            <li class="flex items-baseline gap-3 border-b border-sand-200 py-2.5">
              <span class="w-6 shrink-0 font-sans text-sm text-slate tabular-nums">${c.orden ?? ''}</span>
              <span class="min-w-0"><span class="font-semibold">${esc(c.nombre)}</span>
                ${c.institucion ? `<span class="font-sans text-sm text-slate"> · ${esc(c.institucion)}</span>` : ''}</span>
            </li>`).join('')}
        </ol>` : ''}
    </div>`
}

const mensaje = (t) => `<p class="py-16 text-center font-sans text-slate">${esc(t)}</p>`

if (configurado) {
  cargar()
  // Cuando la organización publica o retira una categoría, la página se actualiza sola.
  supabase.channel('publico-categorias')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categorias' }, () => cargar())
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') { $('#estado-vivo').classList.replace('hidden', 'flex') }
    })
  // Respaldo por si el celular suspendió la conexión en segundo plano.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) cargar() })
} else {
  panelEl.innerHTML = mensaje('Los resultados se publicarán aquí el día del concurso.')
}

// ─── CARRUSEL ────────────────────────────────────────────────────────────────

const carousel = $('#carousel')

if (carousel) {
  const INTERVAL = 4000
  const PAUSE_MS = 8000

  const cardStep = () => {
    const card = carousel.querySelector('figure')
    const gap  = parseFloat(getComputedStyle(carousel).columnGap) || 0
    return (card?.getBoundingClientRect().width ?? carousel.clientWidth) + gap
  }

  const scrollNext = () => {
    const step = cardStep()
    const maxScroll = carousel.scrollWidth - carousel.clientWidth
    if (carousel.scrollLeft + step >= maxScroll - 1) carousel.scrollTo({ left: 0, behavior: 'smooth' })
    else carousel.scrollBy({ left: step, behavior: 'smooth' })
  }

  let timer = setInterval(scrollNext, INTERVAL)
  let resume
  const pausar = () => {
    clearInterval(timer)
    clearTimeout(resume)
    resume = setTimeout(() => { timer = setInterval(scrollNext, INTERVAL) }, PAUSE_MS)
  }

  $$('[data-carousel]').forEach((btn) => btn.addEventListener('click', () => {
    carousel.scrollBy({ left: btn.dataset.carousel === 'next' ? cardStep() : -cardStep(), behavior: 'smooth' })
    pausar()
  }))
  carousel.addEventListener('pointerdown', pausar)
}
