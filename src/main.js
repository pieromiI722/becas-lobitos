import './style.css'
import { buscarPorCodigo, buscarPorDni, buscarPorNombre } from './buscar.js'
import { MENSAJES, FECHA_EXAMEN } from './config.js'

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// ─── DOM ─────────────────────────────────────────────────────────────────────

const form     = document.querySelector('#search-form')
const typeSel  = document.querySelector('#search-type')
const input    = document.querySelector('#search-input')
const fieldLbl = document.querySelector('#field-label')
const out      = document.querySelector('#result')

// ─── FECHA ───────────────────────────────────────────────────────────────────

document.querySelector('#hero-fecha').textContent = `Publicación oficial · ${FECHA_EXAMEN}`
document.querySelector('#exam-fecha').textContent = `Examen de becas — ${FECHA_EXAMEN}`

// ─── ESTILOS POR TONO ────────────────────────────────────────────────────────

const BECA_STYLE = {
  full:  'bg-gold text-ink',
  media: 'bg-teal text-paper',
  none:  'bg-sand text-ink',
}

const PLACEHOLDER = { codigo: 'Ej. MARC1344', nombre: 'Ej. Ruiz Mendoza' }
const LABEL       = { codigo: 'Código',        nombre: 'Apellidos y nombres' }

// ─── TEMPLATES ───────────────────────────────────────────────────────────────

function fila(label, valor) {
  return `
    <div class="flex items-baseline justify-between gap-4 border-b border-sand-200 py-2.5 last:border-0">
      <span class="text-[11px] uppercase tracking-[0.14em] text-slate shrink-0">${label}</span>
      <span class="text-right text-[0.9375rem] font-semibold text-ink">${esc(valor)}</span>
    </div>`
}

function tarjeta(a) {
  return `
    <div class="lob-rise border-l-[6px] ${a.tono === 'none' ? 'border-sand' : 'border-gold'} bg-white p-6 sm:p-8">

      <!-- Nombre -->
      <p class="text-xl font-bold leading-tight sm:text-[1.75rem]">${esc(a.nombre)}</p>

      <!-- Filas de datos -->
      <div class="mt-5 divide-y-0">
        ${fila('DNI',              a.dni)}
        ${fila('Código',           a.codigo)}
        ${fila('Área',             a.area)}
        ${fila('Carrera',          a.carrera)}
        ${fila('Nota Vigesimal',   a.notaVigesimal)}
        ${fila('Nota UNCP',        a.notaUncp)}
      </div>

      <!-- Badge + mensaje -->
      <div class="mt-5 flex flex-col gap-3">
        <span class="inline-flex self-start rounded-sm px-4 py-2 text-[0.9375rem] font-bold sm:text-base ${BECA_STYLE[a.tono]}">${esc(a.beca)}</span>
        <span class="max-w-[52ch] text-[0.9375rem] leading-relaxed text-ink/80">${esc(MENSAJES[a.tono])}</span>
      </div>

    </div>`
}

function sinResultado() {
  return `<p class="text-base text-brick sm:text-[1.0625rem]">No encontramos ese dato. Revisá el código o escribí los apellidos completos.</p>`
}

// ─── SINCRONIZAR CAMPO ───────────────────────────────────────────────────────

function sincronizarCampo() {
  const t = typeSel.value
  fieldLbl.textContent = LABEL[t]
  input.placeholder    = PLACEHOLDER[t]
  out.innerHTML        = ''
}

typeSel?.addEventListener('change', sincronizarCampo)
input?.addEventListener('input', () => { out.innerHTML = '' })

// ─── BÚSQUEDA (síncrona — datos en memoria) ──────────────────────────────────

function buscar(tipo, query) {
  const q = query.trim()
  if (!q) { out.innerHTML = ''; return }

  const alumno = tipo === 'codigo'
    ? (buscarPorCodigo(q) ?? buscarPorDni(q))
    : buscarPorNombre(q)

  out.innerHTML = alumno ? tarjeta(alumno) : sinResultado()
}

form?.addEventListener('submit', (e) => {
  e.preventDefault()
  buscar(typeSel.value, input.value)
})

// ─── CARRUSEL ────────────────────────────────────────────────────────────────

const carousel = document.querySelector('#carousel')

if (carousel) {
  const INTERVAL  = 4000   // ms entre avances automáticos
  const PAUSE_MS  = 8000   // ms de pausa tras interacción manual

  function cardStep() {
    const card = carousel.querySelector('figure')
    const gap  = parseFloat(getComputedStyle(carousel).columnGap) || 0
    return (card?.getBoundingClientRect().width ?? carousel.clientWidth) + gap
  }

  function scrollNext() {
    const step       = cardStep()
    const maxScroll  = carousel.scrollWidth - carousel.clientWidth
    // Si llegó al final, vuelve al inicio
    if (carousel.scrollLeft + step >= maxScroll - 1) {
      carousel.scrollTo({ left: 0, behavior: 'smooth' })
    } else {
      carousel.scrollBy({ left: step, behavior: 'smooth' })
    }
  }

  // Auto-avance
  let timer = setInterval(scrollNext, INTERVAL)

  function resetTimer() {
    clearInterval(timer)
    timer = setInterval(scrollNext, PAUSE_MS > INTERVAL ? PAUSE_MS : INTERVAL)
    // Después de la pausa, vuelve al intervalo normal
    setTimeout(() => {
      clearInterval(timer)
      timer = setInterval(scrollNext, INTERVAL)
    }, PAUSE_MS)
  }

  // Flechas manuales
  document.querySelectorAll('[data-carousel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = cardStep()
      carousel.scrollBy({
        left: btn.dataset.carousel === 'next' ? step : -step,
        behavior: 'smooth',
      })
      resetTimer()
    })
  })

  // Pausa cuando el usuario arrastra / toca el carrusel
  carousel.addEventListener('pointerdown', resetTimer)
}
