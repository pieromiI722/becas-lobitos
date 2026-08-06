import './style.css'
import { fetchPorCodigo, fetchPorNombre } from './sheets.js'
import { MENSAJES, FECHA_EXAMEN } from './config.js'

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const norm = (s) =>
  (s ?? '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// ─── DOM ─────────────────────────────────────────────────────────────────────

const form     = document.querySelector('#search-form')
const typeSel  = document.querySelector('#search-type')
const input    = document.querySelector('#search-input')
const fieldLbl = document.querySelector('#field-label')
const out      = document.querySelector('#result')
const btn      = document.querySelector('#search-btn')

// ─── FECHA ───────────────────────────────────────────────────────────────────

const fechaFmt = FECHA_EXAMEN
document.querySelector('#hero-fecha').textContent  = `Publicación oficial · ${fechaFmt}`
document.querySelector('#exam-fecha').textContent  = `Examen de becas — ${fechaFmt}`

// ─── ESTILOS POR TONO ─────────────────────────────────────────────────────────

const BECA_STYLE = {
  full:  'bg-gold text-ink',
  media: 'bg-teal text-paper',
  none:  'bg-sand text-ink',
}

const PLACEHOLDER = { codigo: 'Ej. LOB-1024', nombre: 'Ej. Ruiz Mendoza' }
const LABEL       = { codigo: 'Código',        nombre: 'Apellidos y nombres' }

// ─── TEMPLATES ───────────────────────────────────────────────────────────────

function tarjeta(a) {
  return `
    <div class="lob-rise flex flex-col gap-3 border-l-[6px] ${a.tono === 'none' ? 'border-sand' : 'border-gold'} bg-white p-6 sm:gap-4 sm:p-8">
      <span class="text-xl font-bold leading-tight sm:text-[1.75rem]">${esc(a.nombre)}</span>
      <span class="text-xs uppercase tracking-[0.14em] text-slate sm:text-sm">${esc(a.codigo)} · Puntaje ${esc(a.puntaje)}</span>
      <span class="inline-flex self-start rounded-sm px-4 py-2 text-[0.9375rem] font-bold sm:text-base ${BECA_STYLE[a.tono]}">${esc(a.beca)}</span>
      <span class="max-w-[52ch] text-[0.9375rem] leading-relaxed text-ink/80">${esc(MENSAJES[a.tono])}</span>
    </div>`
}

function cargando() {
  return `
    <div class="lob-rise flex items-center gap-3 py-2 text-slate">
      <svg class="h-5 w-5 animate-spin text-teal" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      <span class="text-[0.9375rem]">Consultando resultados…</span>
    </div>`
}

function sinResultado() {
  return `<p class="text-base text-brick sm:text-[1.0625rem]">No encontramos ese dato. Revisá el código o escribí los apellidos completos.</p>`
}

function errorConexion(msg) {
  return `<p class="text-base text-brick sm:text-[1.0625rem]">No se pudo conectar con la base de datos. ${esc(msg ?? '')}</p>`
}

// ─── SINCRONIZAR CAMPO ───────────────────────────────────────────────────────

function sincronizarCampo() {
  const t = typeSel.value
  fieldLbl.textContent  = LABEL[t]
  input.placeholder     = PLACEHOLDER[t]
  out.innerHTML         = ''
}

typeSel?.addEventListener('change', sincronizarCampo)
input?.addEventListener('input', () => { out.innerHTML = '' })

// ─── BÚSQUEDA ────────────────────────────────────────────────────────────────

let loading = false

async function buscar(tipo, query) {
  const q = query.trim()
  if (!q) { out.innerHTML = ''; return }

  loading = true
  btn.disabled = true
  input.disabled = true
  out.innerHTML = cargando()

  try {
    const alumno = tipo === 'codigo'
      ? await fetchPorCodigo(q)
      : await fetchPorNombre(q)

    out.innerHTML = alumno ? tarjeta(alumno) : sinResultado()
  } catch (err) {
    console.error(err)
    out.innerHTML = errorConexion(err.message)
  } finally {
    loading = false
    btn.disabled = false
    input.disabled = false
  }
}

form?.addEventListener('submit', (e) => {
  e.preventDefault()
  if (!loading) buscar(typeSel.value, input.value)
})

// ─── CARRUSEL ─────────────────────────────────────────────────────────────────

const carousel = document.querySelector('#carousel')

document.querySelectorAll('[data-carousel]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!carousel) return
    const card = carousel.querySelector('figure')
    const gap  = parseFloat(getComputedStyle(carousel).columnGap) || 0
    const step = (card?.getBoundingClientRect().width ?? carousel.clientWidth) + gap
    carousel.scrollBy({ left: btn.dataset.carousel === 'next' ? step : -step, behavior: 'smooth' })
  })
})
