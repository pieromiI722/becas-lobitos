import './style.css'
import { supabase, configurado } from './lib/supabase.js'
import { CRITERIOS, TOTAL_MAX } from './lib/rubrica.js'
import { esc, $, $$, norm } from './lib/ui.js'
import { confeti, reducido } from './lib/efectos.js'


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

// ─── ESTADO ──────────────────────────────────────────────────────────────────

const cartelera = $('#cartelera')
const escenario = $('#escenario')

const estado = {
  categorias: [],
  concursantes: [],
  resultados: [],
  activa: null,
  resaltado: null,          // id de concursante elegido en el buscador
  revelar: null,            // categoría que debe abrir el telón en el próximo render
  vistas: new Set(),        // categorías cuyo telón ya se abrió en esta visita
  turnos: new Map(),        // concursante_id → turno (solo los ya revelados en el sorteo)
  turnosVistos: null,       // ids ya mostrados; los nuevos entran con animación
  ordenCat: null,           // categoría elegida en la sección Orden de presentación
  ordenManual: false,       // si el visitante eligió una pestaña, no se la cambiamos
}

const catPorId = (id) => estado.categorias.find((c) => c.id === id)
const resultadosDe = (id) => estado.resultados.filter((r) => r.categoria_id === id && r.puesto != null)
const concursantesDe = (id) => estado.concursantes.filter((c) => c.categoria_id === id)
const sorteoEnVivo = (cat) => Boolean(cat.sorteado_en) && concursantesDe(cat.id).some((c) => !estado.turnos.has(c.id))

// ─── DATOS ───────────────────────────────────────────────────────────────────

async function cargar() {
  const antes = new Map(estado.categorias.map((c) => [c.id, c.publicada]))
  const [cats, cons, res, orden] = await Promise.all([
    supabase.from('categorias').select('*').order('orden'),
    supabase.from('concursantes').select('id, categoria_id, orden, nombre, institucion, poema')
      .order('orden', { nullsFirst: false }).order('nombre'),
    supabase.rpc('resultados'),
    supabase.rpc('orden_presentacion'),
  ])
  if (cats.error || cons.error || res.error) {
    escenario.innerHTML = mensaje('No pudimos cargar los resultados. Recarga la página en unos segundos.')
    return
  }
  estado.categorias   = cats.data
  estado.concursantes = cons.data
  estado.resultados   = res.data
  estado.turnos       = new Map((orden.error ? [] : orden.data).map((t) => [t.concursante_id, t.turno]))

  // ¿Se acaba de publicar una categoría mientras la página estaba abierta? → telón.
  const recien = antes.size
    ? estado.categorias.find((c) => c.publicada && antes.get(c.id) === false)
    : null
  if (recien) {
    estado.activa = recien.id
    estado.revelar = recien.id
    anunciar(recien)
  }

  const enVivo = estado.categorias.find(sorteoEnVivo)
  if (enVivo && !estado.ordenManual) estado.ordenCat = enVivo.id
  if (!estado.ordenCat || !catPorId(estado.ordenCat)) {
    estado.ordenCat = (estado.categorias.find((c) => c.sorteado_en) ?? estado.categorias[0])?.id
  }

  if (!estado.activa || !catPorId(estado.activa)) {
    const desdeHash = location.hash.match(/^#r-(.+)$/)?.[1]
    const ultima = estado.categorias.filter((c) => c.publicada)
      .sort((a, b) => new Date(b.publicada_en) - new Date(a.publicada_en))[0]
    estado.activa = catPorId(desdeHash)?.id ?? ultima?.id ?? estado.categorias[0]?.id
  }
  render()
}

// ─── RENDER ──────────────────────────────────────────────────────────────────

function render() {
  renderOrden()
  cartelera.innerHTML = estado.categorias.map(tarjetaCategoria).join('')
  $$('[data-cat]', cartelera).forEach((b) => b.addEventListener('click', () => {
    estado.activa = b.dataset.cat
    estado.resaltado = null
    history.replaceState(null, '', `#r-${b.dataset.cat}`)
    render()
  }))

  const cat = catPorId(estado.activa)
  if (!cat) { escenario.innerHTML = mensaje('Pronto publicaremos los resultados.'); return }

  if (cat.publicada) {
    // El telón se abre la primera vez que se ve cada categoría publicada.
    const abrir = !reducido && (estado.revelar === cat.id || !estado.vistas.has(cat.id))
    estado.vistas.add(cat.id)
    estado.revelar = null
    escenario.innerHTML = vistaPublicada(cat, abrir)
    if (abrir) confeti($('#podio-escena'), { retraso: 1.8 })
    $('#btn-compartir')?.addEventListener('click', () => compartir(cat))
  } else {
    escenario.innerHTML = vistaPendiente(cat)
  }

  $('[data-ver-orden]', escenario)?.addEventListener('click', (e) => abrirPanelOrden(e.currentTarget.dataset.verOrden))

  if (estado.resaltado) {
    const fila = $(`[data-fila="${estado.resaltado}"]`)
    fila?.classList.add('lob-resaltado')
    fila?.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth', block: 'center' })
  }
}

function tarjetaCategoria(c) {
  const activa = c.id === estado.activa
  const campeones = c.publicada ? resultadosDe(c.id).filter((r) => r.puesto === 1) : []
  const base = 'relative flex min-w-[220px] shrink-0 snap-start cursor-pointer flex-col gap-3 rounded-sm border-[1.5px] p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold lg:min-w-0'
  const tono = activa
    ? 'border-gold bg-paper text-ink'
    : c.publicada ? 'border-gold/60 bg-paper/5 hover:bg-paper/10' : 'border-paper/15 bg-paper/[0.03] hover:border-paper/40'

  return `
    <button type="button" role="tab" aria-selected="${activa}" data-cat="${c.id}" class="${base} ${tono}">
      <span class="flex items-start justify-between gap-2">
        <span>
          <span class="block text-lg font-extrabold leading-tight tracking-tight">${esc(c.nombre)}</span>
          <span class="block text-xs ${activa ? 'text-slate' : 'text-mist/80'}">${esc(c.descripcion ?? `${concursantesDe(c.id).length} concursantes`)}</span>
        </span>
        ${c.publicada
          ? `<span class="rounded-sm bg-gold px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink">Publicado</span>`
          : ''}
      </span>
      <span class="mt-auto border-t ${activa ? 'border-sand' : 'border-paper/15'} pt-3 text-sm">
        ${c.publicada && campeones.length
          ? `<span class="block text-[10px] font-semibold uppercase tracking-[0.18em] ${activa ? 'text-teal' : 'text-gold'}">Campeón</span>
             <span class="block truncate font-bold">${esc(campeones.map((r) => r.nombre).join(' · '))}</span>`
          : sorteoEnVivo(c)
            ? `<span class="flex items-center gap-2 font-semibold ${activa ? 'text-teal' : 'text-gold'}">
                 <span class="relative flex h-2 w-2"><span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-70"></span><span class="relative inline-flex h-2 w-2 rounded-full bg-current"></span></span>
                 Sorteo en vivo
               </span>`
            : `<span class="flex items-center gap-2 ${activa ? 'text-slate' : 'text-mist'}">
               <span class="lob-dots flex gap-0.5" aria-hidden="true"><span class="h-1.5 w-1.5 rounded-full bg-current"></span><span class="h-1.5 w-1.5 rounded-full bg-current"></span><span class="h-1.5 w-1.5 rounded-full bg-current"></span></span>
               En deliberación
             </span>`}
      </span>
    </button>`
}

// ─── CATEGORÍA PUBLICADA: podio + clasificación ──────────────────────────────

const MEDALLA = {
  1: { alto: 'h-36 sm:h-44', bloque: 'bg-gold text-ink',              aro: 'ring-gold',  etiqueta: 'Campeón' },
  2: { alto: 'h-24 sm:h-32', bloque: 'bg-mist text-ink',              aro: 'ring-mist',  etiqueta: 'Segundo puesto' },
  3: { alto: 'h-16 sm:h-24', bloque: 'bg-[#c98b5a] text-ink',         aro: 'ring-[#c98b5a]', etiqueta: 'Tercer puesto' },
}

const COLS = { 1: 'grid-cols-1 max-w-xs mx-auto', 2: 'grid-cols-2 max-w-xl mx-auto', 3: 'grid-cols-3' }

function vistaPublicada(cat, abrir) {
  const filas = resultadosDe(cat.id)
  if (!filas.length) return mensaje('Esta categoría no tiene calificaciones registradas.')

  const grupos = [2, 1, 3]
    .map((p) => ({ p, gente: filas.filter((r) => r.puesto === p) }))
    .filter((g) => g.gente.length)

  return `
    <div id="podio-escena" class="${abrir ? 'lob-abrir' : 'lob-abierto'} relative overflow-hidden rounded-sm border border-paper/10 bg-ink px-4 pt-10 sm:px-10">
      <div class="lob-foco pointer-events-none absolute -top-4 left-1/2 h-[120%] w-[90%] -translate-x-1/2" aria-hidden="true"></div>

      <div class="relative flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">${esc(cat.nombre)}${cat.descripcion ? ` · ${esc(cat.descripcion)}` : ''}</p>
          <p class="mt-1 text-sm text-mist">Puntaje sobre ${TOTAL_MAX} · promedio de los jurados</p>
        </div>
        <button id="btn-compartir" type="button"
                class="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-sm border-[1.5px] border-paper/30 px-3.5 py-2 text-sm font-semibold transition-colors hover:border-gold hover:text-gold focus-visible:outline-2 focus-visible:outline-gold">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14"/></svg>
          Compartir
        </button>
      </div>

      <ol class="relative mt-8 grid ${COLS[grupos.length]} items-end gap-2 sm:gap-4" aria-label="Podio">
        ${grupos.map(({ p, gente }) => columnaPodio(p, gente)).join('')}
      </ol>

      <div class="lob-telon lob-telon-izq absolute inset-y-0 w-1/2" aria-hidden="true"></div>
      <div class="lob-telon lob-telon-der absolute inset-y-0 w-1/2" aria-hidden="true"></div>
    </div>

    ${clasificacion(filas)}
    <p class="mt-4 text-xs text-mist/80">Publicado el ${new Date(cat.publicada_en).toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' })}. En caso de empate decide el criterio de interpretación.</p>`
}

function columnaPodio(p, gente) {
  const m = MEDALLA[p]
  return `
    <li class="lob-bloque flex flex-col items-center text-center" data-p="${p}">
      <span class="mb-3 flex flex-col items-center gap-2 px-1">
        ${gente.map((r) => `
          <span class="flex h-14 w-14 items-center justify-center rounded-full bg-paper/10 text-lg font-extrabold ring-[3px] ${m.aro} sm:h-16 sm:w-16 sm:text-xl">${esc(iniciales(r.nombre))}</span>
          <span class="max-w-[22ch] text-sm font-bold leading-tight sm:text-lg">${esc(r.nombre)}</span>
          ${r.institucion ? `<span class="hidden max-w-[28ch] text-xs text-mist sm:block">${esc(r.institucion)}</span>` : ''}
          <span class="text-xl font-extrabold tabular-nums text-gold sm:text-2xl">${pts(r.promedio)}</span>
        `).join('<span class="h-2"></span>')}
      </span>
      <span class="flex w-full flex-col items-center justify-start rounded-t-sm pt-3 ${m.alto} ${m.bloque}">
        <span class="text-3xl font-extrabold leading-none sm:text-5xl">${p}°</span>
        <span class="mt-1 hidden text-[10px] font-bold uppercase tracking-[0.18em] sm:block">${m.etiqueta}</span>
      </span>
    </li>`
}

function clasificacion(filas) {
  return `
    <div class="mt-8">
      <h3 class="text-[11px] font-semibold uppercase tracking-[0.24em] text-mist">Clasificación completa</h3>
      <ol class="mt-3 divide-y divide-paper/10 border-y border-paper/10">
        ${filas.map((r) => `
          <li data-fila="${r.concursante_id}" class="grid grid-cols-[2.75rem_1fr_auto] items-center gap-x-3 gap-y-2 py-3.5 sm:grid-cols-[3rem_1fr_220px_4.5rem] sm:gap-x-5">
            <span class="row-start-1 text-xl font-extrabold tabular-nums ${r.puesto <= 3 ? 'text-gold' : 'text-mist/70'}">${r.puesto}°</span>
            <span class="row-start-1 min-w-0">
              <span class="block font-bold leading-tight">${esc(r.nombre)}</span>
              <span class="block truncate text-sm text-mist/80">${[r.institucion, r.poema].filter(Boolean).map(esc).join(' · ')}</span>
            </span>
            <span class="col-span-3 col-start-1 row-start-2 h-1.5 overflow-hidden rounded-full bg-paper/10 sm:col-span-1 sm:row-start-1 sm:col-start-3" aria-hidden="true">
              <span class="block h-full rounded-full ${r.puesto <= 3 ? 'bg-gold' : 'bg-teal'}" style="width:${Math.min(100, (r.promedio / TOTAL_MAX) * 100)}%"></span>
            </span>
            <span class="col-start-3 row-start-1 text-right text-lg font-extrabold tabular-nums sm:col-start-4">${pts(r.promedio)}</span>
          </li>`).join('')}
      </ol>
    </div>`
}

// ─── CATEGORÍA PENDIENTE: telón cerrado + orden de presentación ──────────────

function vistaPendiente(cat) {
  const total = concursantesDe(cat.id).length
  const enVivo = sorteoEnVivo(cat)
  return `
    <div class="relative overflow-hidden rounded-sm border ${enVivo ? 'border-gold/50' : 'border-paper/10'}">
      <div class="lob-telon absolute inset-0" aria-hidden="true"></div>
      <div class="relative flex min-h-[240px] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <span class="lob-dots flex gap-1.5 text-gold" aria-hidden="true"><span class="h-2.5 w-2.5 rounded-full bg-current"></span><span class="h-2.5 w-2.5 rounded-full bg-current"></span><span class="h-2.5 w-2.5 rounded-full bg-current"></span></span>
        <p class="text-2xl font-extrabold tracking-tight sm:text-3xl">${enVivo ? 'Sorteo en curso' : 'El jurado está deliberando'}</p>
        <p class="max-w-[46ch] text-[0.9375rem] text-mist">Cuando se publiquen los resultados de ${esc(cat.nombre)}, el telón se abrirá aquí mismo. No hace falta recargar.</p>
        <button type="button" data-ver-orden="${cat.id}"
                class="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-sm border-[1.5px] border-paper/30 px-4 py-2.5 text-sm font-semibold transition-colors hover:border-gold hover:text-gold focus-visible:outline-2 focus-visible:outline-gold">
          ${total} concursantes · ver orden de presentación →
        </button>
      </div>
    </div>`
}

const pts = (n) => (n == null ? '—' : Number(n).toFixed(2))
const mensaje = (t) => `<p class="py-16 text-center text-mist">${esc(t)}</p>`

function iniciales(nombre) {
  const p = String(nombre).split(/\s+/).filter((w) => w.length > 2 || /^[A-ZÁÉÍÓÚÑ]/.test(w))
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase()
}

// ─── EFECTOS ─────────────────────────────────────────────────────────────────

function anunciar(cat) {
  const aviso = document.createElement('a')
  aviso.href = `#r-${cat.id}`
  aviso.className = 'lob-rise fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-sm bg-gold px-5 py-4 text-ink shadow-2xl'
  aviso.innerHTML = `<span class="text-2xl" aria-hidden="true">🏆</span>
    <span><span class="block text-xs font-semibold uppercase tracking-[0.18em]">Recién publicado</span>
    <span class="block text-lg font-extrabold leading-tight">Resultados de ${esc(cat.nombre)}</span></span>`
  aviso.addEventListener('click', (e) => {
    e.preventDefault()
    $('#resultados').scrollIntoView({ behavior: reducido ? 'auto' : 'smooth' })
    aviso.remove()
  })
  document.body.appendChild(aviso)
  setTimeout(() => aviso.remove(), 9000)
}

async function compartir(cat) {
  const url = `${location.origin}${location.pathname}#r-${cat.id}`
  const campeon = resultadosDe(cat.id).filter((r) => r.puesto === 1).map((r) => r.nombre).join(' y ')
  const texto = `🏆 Resultados de ${cat.nombre} — Concurso de Declamación «Campeón de Campeones», Academia Lobitos.${campeon ? ` Campeón: ${campeon}.` : ''}`
  const btn = $('#btn-compartir')
  try {
    if (navigator.share) await navigator.share({ title: document.title, text: texto, url })
    else {
      await navigator.clipboard.writeText(`${texto} ${url}`)
      btn.lastChild.textContent = ' ¡Enlace copiado!'
      setTimeout(() => { btn.lastChild.textContent = ' Compartir' }, 2200)
    }
  } catch { /* el usuario canceló */ }
}

// ─── ORDEN DE PRESENTACIÓN (sorteo) ──────────────────────────────────────────

const ordenTabs  = $('#orden-tabs')
const ordenCinta = $('#orden-cinta')
const panelOrden = $('#panel-orden')

const ordenDe = (id) => concursantesDe(id)
  .filter((c) => estado.turnos.has(c.id))
  .sort((a, b) => estado.turnos.get(a.id) - estado.turnos.get(b.id))

function renderOrden() {
  if (!ordenTabs) return
  const cat = catPorId(estado.ordenCat)
  if (!cat) return

  ordenTabs.innerHTML = estado.categorias.map((c) => {
    const activa = c.id === cat.id
    const vivo = sorteoEnVivo(c)
    return `<button type="button" role="tab" aria-selected="${activa}" data-orden-cat="${c.id}"
              class="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal
                     ${activa ? 'border-ink bg-ink text-paper' : 'border-sand bg-white hover:border-ink'}">
              ${vivo ? '<span class="h-1.5 w-1.5 rounded-full bg-brick"></span>' : ''}${esc(c.nombre)}
            </button>`
  }).join('')
  $$('[data-orden-cat]', ordenTabs).forEach((b) => b.addEventListener('click', () => {
    estado.ordenCat = b.dataset.ordenCat
    estado.ordenManual = true
    renderOrden()
  }))

  const lista = concursantesDe(cat.id)
  const orden = ordenDe(cat.id)
  const vivo = sorteoEnVivo(cat)
  $('#orden-vivo').classList.toggle('hidden', !vivo)
  $('#orden-vivo').classList.toggle('inline-flex', vivo)

  // Turnos que aparecen por primera vez → animación de llegada
  const nuevos = new Set(estado.turnosVistos ? orden.filter((c) => !estado.turnosVistos.has(c.id)).map((c) => c.id) : [])
  estado.turnosVistos = new Set([...(estado.turnosVistos ?? []), ...[...estado.turnos.keys()]])

  if (!cat.sorteado_en) {
    ordenCinta.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-4 rounded-sm border-[1.5px] border-dashed border-sand bg-paper px-5 py-5">
        <p class="max-w-[60ch] text-[0.9375rem]">
          <b>El sorteo de ${esc(cat.nombre)} aún no se realiza.</b>
          <span class="text-slate">Se hará en vivo en el auditorio y aparecerá aquí al instante.</span>
        </p>
        <button type="button" data-panel class="cursor-pointer text-sm font-bold text-teal underline-offset-4 hover:underline">Ver los ${lista.length} inscritos →</button>
      </div>`
  } else {
    const anterior = $('.lob-cinta', ordenCinta)?.scrollLeft ?? 0
    const huecos = Math.max(0, lista.length - orden.length)
    ordenCinta.innerHTML = `
      <div class="relative">
        <ol class="lob-cinta lob-scroller flex snap-x gap-2.5 overflow-x-auto pb-2">
          ${orden.map((c) => `
            <li data-turno-id="${c.id}" class="${nuevos.has(c.id) ? 'lob-llegada border-gold bg-gold/10' : 'border-sand bg-paper'} flex w-44 shrink-0 snap-start flex-col rounded-sm border-[1.5px] px-3.5 py-3">
              <span class="text-[1.75rem] font-extrabold leading-none tracking-tight text-teal tabular-nums">${String(estado.turnos.get(c.id)).padStart(2, '0')}</span>
              <span class="mt-1.5 line-clamp-2 text-[0.9375rem] font-bold leading-tight">${esc(c.nombre)}</span>
              ${c.institucion ? `<span class="mt-auto truncate pt-1 text-xs text-slate">${esc(c.institucion)}</span>` : ''}
            </li>`).join('')}
          ${Array.from({ length: huecos }, (_, k) => `
            <li class="flex w-44 shrink-0 snap-start flex-col rounded-sm border-[1.5px] border-dashed border-sand px-3.5 py-3 text-slate/60">
              <span class="text-[1.75rem] font-extrabold leading-none tracking-tight tabular-nums">${String(orden.length + k + 1).padStart(2, '0')}</span>
              <span class="mt-1.5 text-sm">Por revelar</span>
            </li>`).join('')}
        </ol>
      </div>
      <div class="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span class="text-slate">${vivo ? `${orden.length} de ${lista.length} turnos revelados` : `${lista.length} concursantes`} · Sorteo nº ${cat.sorteo_intentos}</span>
        <span class="flex items-center gap-3">
          <span class="hidden gap-1.5 sm:flex">
            <button type="button" data-cinta="-1" aria-label="Desplazar a la izquierda" class="h-9 w-9 cursor-pointer rounded-full border-[1.5px] border-sand hover:border-ink">←</button>
            <button type="button" data-cinta="1" aria-label="Desplazar a la derecha" class="h-9 w-9 cursor-pointer rounded-full border-[1.5px] border-sand hover:border-ink">→</button>
          </span>
          <button type="button" data-panel class="cursor-pointer font-bold text-teal underline-offset-4 hover:underline">Ver lista completa →</button>
        </span>
      </div>`

    const cinta = $('.lob-cinta', ordenCinta)
    const ultimoNuevo = [...$$('.lob-llegada', cinta)].pop()
    if (ultimoNuevo) cinta.scrollTo({ left: ultimoNuevo.offsetLeft - cinta.clientWidth / 2 + ultimoNuevo.clientWidth / 2, behavior: reducido ? 'auto' : 'smooth' })
    else cinta.scrollLeft = anterior
    $$('[data-cinta]', ordenCinta).forEach((b) => b.addEventListener('click', () =>
      cinta.scrollBy({ left: Number(b.dataset.cinta) * cinta.clientWidth * 0.8, behavior: reducido ? 'auto' : 'smooth' })))
  }
  $('[data-panel]', ordenCinta)?.addEventListener('click', () => abrirPanelOrden(cat.id))
  actualizarAvisoSorteo()
}

function abrirPanelOrden(catId, resaltarId = null) {
  const cat = catPorId(catId)
  if (!cat || !panelOrden) return
  const orden = ordenDe(cat.id)
  const resto = concursantesDe(cat.id).filter((c) => !estado.turnos.has(c.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  $('#panel-orden-titulo').textContent = cat.nombre
  $('#panel-orden-sub').textContent = cat.sorteado_en
    ? `${orden.length} de ${orden.length + resto.length} turnos · Sorteo nº ${cat.sorteo_intentos}`
    : `${resto.length} inscritos · sorteo pendiente`

  const fila = (c, turno) => `
    <li data-fila-panel="${c.id}" class="flex gap-3.5 border-b border-sand-200 py-3.5">
      ${turno
        ? `<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal text-sm font-extrabold tabular-nums text-paper">${turno}</span>`
        : `<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-sand text-sm text-slate">?</span>`}
      <span class="min-w-0">
        <span class="block font-bold leading-tight">${esc(c.nombre)}</span>
        ${c.poema ? `<span class="mt-0.5 block text-sm italic text-teal">${esc(c.poema)}</span>` : ''}
        ${c.institucion ? `<span class="block text-xs text-slate">${esc(c.institucion)}</span>` : ''}
      </span>
    </li>`

  $('#panel-orden-lista').innerHTML =
    orden.map((c) => fila(c, estado.turnos.get(c.id))).join('') +
    (resto.length && orden.length ? `<li class="pt-6 pb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate">Por sortear · ${resto.length}</li>` : '') +
    resto.map((c) => fila(c, null)).join('')

  if (!panelOrden.open) panelOrden.showModal()
  const destacado = resaltarId && $(`[data-fila-panel="${resaltarId}"]`, panelOrden)
  if (destacado) {
    destacado.classList.add('lob-resaltado-claro')
    destacado.scrollIntoView({ block: 'center' })
  } else $('#panel-orden-lista').scrollTop = 0
}

panelOrden?.addEventListener('click', (e) => {
  if (e.target === panelOrden || e.target.closest('[data-cerrar-panel]')) panelOrden.close()
})

// Aviso flotante: visible solo durante un sorteo en vivo y mientras la sección no está a la vista.
const aviso = $('#aviso-sorteo')
let ordenVisible = false
if (aviso && 'IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => { ordenVisible = e.isIntersecting; actualizarAvisoSorteo() }, { threshold: 0.2 })
    .observe($('#orden'))
}
function actualizarAvisoSorteo() {
  if (!aviso) return
  const vivo = estado.categorias.find(sorteoEnVivo)
  aviso.hidden = !vivo || ordenVisible
  if (vivo) $('#aviso-sorteo-txt').textContent = `Sorteo en vivo · ${vivo.nombre} ${ordenDe(vivo.id).length}/${concursantesDe(vivo.id).length}`
}
aviso?.addEventListener('click', (e) => {
  e.preventDefault()
  const vivo = estado.categorias.find(sorteoEnVivo)
  if (vivo) { estado.ordenCat = vivo.id; estado.ordenManual = false; renderOrden() }
  $('#orden').scrollIntoView({ behavior: reducido ? 'auto' : 'smooth' })
})

// ─── BUSCADOR ────────────────────────────────────────────────────────────────

const inputBuscar = $('#buscar')
const listaBuscar = $('#buscar-res')

function buscar() {
  const q = norm(inputBuscar.value)
  if (q.length < 2) { listaBuscar.classList.add('hidden'); return }
  const palabras = q.split(/\s+/)
  const hallados = estado.concursantes
    .filter((c) => { const n = norm(c.nombre); return palabras.every((p) => n.includes(p)) })
    .slice(0, 8)

  listaBuscar.innerHTML = hallados.length
    ? hallados.map((c) => {
        const cat = catPorId(c.categoria_id)
        const r = cat?.publicada && estado.resultados.find((x) => x.concursante_id === c.id)
        const estadoTxt = r?.puesto ? `<b class="text-teal">${r.puesto}° puesto · ${pts(r.promedio)}</b>`
          : estado.turnos.has(c.id) ? `Turno ${estado.turnos.get(c.id)}` : 'En deliberación'
        return `
          <li><button type="button" data-ir="${c.id}" class="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left hover:bg-sand-200/60 focus-visible:bg-sand-200/60 focus-visible:outline-none">
            <span class="min-w-0"><span class="block truncate font-semibold">${esc(c.nombre)}</span>
              <span class="block text-xs text-slate">${esc(cat?.nombre ?? '')}</span></span>
            <span class="shrink-0 text-xs text-slate">${estadoTxt}</span>
          </button></li>`
      }).join('')
    : `<li class="px-4 py-3 text-sm text-slate">Sin coincidencias.</li>`
  listaBuscar.classList.remove('hidden')

  $$('[data-ir]', listaBuscar).forEach((b) => b.addEventListener('click', () => {
    const c = estado.concursantes.find((x) => x.id === Number(b.dataset.ir))
    inputBuscar.value = c.nombre
    listaBuscar.classList.add('hidden')
    if (!catPorId(c.categoria_id)?.publicada) return abrirPanelOrden(c.categoria_id, c.id)
    estado.activa = c.categoria_id
    estado.resaltado = c.id
    render()
  }))
}

inputBuscar.addEventListener('input', buscar)
inputBuscar.addEventListener('focus', buscar)
inputBuscar.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') listaBuscar.classList.add('hidden')
  if (e.key === 'Enter') { e.preventDefault(); $('[data-ir]', listaBuscar)?.click() }
})
document.addEventListener('click', (e) => {
  if (!e.target.closest('#buscar, #buscar-res')) listaBuscar.classList.add('hidden')
})

// ─── ARRANQUE ────────────────────────────────────────────────────────────────

if (configurado) {
  cargar()
  supabase.channel('publico-categorias')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categorias' }, () => cargar())
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') $('#estado-vivo').classList.replace('hidden', 'flex')
    })
  // Respaldo por si el celular suspendió la conexión en segundo plano.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) cargar() })
} else {
  escenario.innerHTML = mensaje('Los resultados se publicarán aquí el día del concurso.')
  inputBuscar.disabled = true
}

// ─── GALERÍA: tira continua + visor ──────────────────────────────────────────

const pista = $('.lob-marquee-pista')

if (pista) {
  const originales = $$('.lob-foto', pista)

  // Segunda copia para el bucle infinito (oculta a lectores de pantalla y al teclado).
  if (!reducido) {
    originales.forEach((li) => {
      const copia = li.cloneNode(true)
      copia.setAttribute('aria-hidden', 'true')
      copia.querySelector('button').tabIndex = -1
      copia.querySelector('img').loading = 'eager'
      pista.appendChild(copia)
    })
    // Velocidad constante (~40 px/s) sin importar cuántas fotos haya.
    const ajustarVelocidad = () => pista.style.setProperty('--duracion', `${Math.round(pista.scrollWidth / 2 / 40)}s`)
    ajustarVelocidad()
    addEventListener('resize', ajustarVelocidad)
  }

  // Visor
  const visor = $('#visor')
  const img = $('#visor-img')
  let actual = 0
  const mostrar = (i) => {
    actual = (i + originales.length) % originales.length
    const btn = $('button', originales[actual])
    const alt = $('img', btn).alt
    img.src = btn.dataset.grande
    img.alt = alt
    $('#visor-txt').textContent = alt
    $('#visor-n').textContent = `${actual + 1} / ${originales.length}`
  }

  pista.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-foto]')
    if (!btn) return
    mostrar(Number(btn.dataset.foto))
    visor.showModal()
  })
  visor.addEventListener('click', (e) => {
    const accion = e.target.closest('[data-visor]')?.dataset.visor
    if (accion === 'cerrar' || e.target === visor) visor.close()
    else if (accion) mostrar(actual + Number(accion))
  })
  visor.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') mostrar(actual + 1)
    if (e.key === 'ArrowLeft') mostrar(actual - 1)
  })
  // Deslizar con el dedo en el visor
  let x0 = null
  visor.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX }, { passive: true })
  visor.addEventListener('touchend', (e) => {
    if (x0 == null) return
    const dx = e.changedTouches[0].clientX - x0
    if (Math.abs(dx) > 50) mostrar(actual + (dx < 0 ? 1 : -1))
    x0 = null
  })
}
