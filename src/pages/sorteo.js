import '../style.css'
import { supabase } from '../lib/supabase.js'
import { requerirIngreso, salir } from '../lib/auth.js'
import { esc, $, $$, toast } from '../lib/ui.js'
import { confeti, reducido } from '../lib/efectos.js'

const app = $('#app')
const ALTO = 104 // alto de cada fila del rodillo (px); debe coincidir con .lob-rodillo-fila

const estado = {
  categorias: [],
  concursantes: [],
  turnos: new Map(),      // concursante_id → turno (el admin recibe todos)
  categoria: null,
  girando: false,
  auto: false,
}

const catActual = () => estado.categorias.find((c) => c.id === estado.categoria)
const delCat = (id) => estado.concursantes.filter((c) => c.categoria_id === id)
const ordenDe = (id) => delCat(id)
  .filter((c) => estado.turnos.has(c.id))
  .sort((a, b) => estado.turnos.get(a.id) - estado.turnos.get(b.id))

// ─── DATOS ───────────────────────────────────────────────────────────────────

async function cargar() {
  const [cats, cons, orden] = await Promise.all([
    supabase.from('categorias').select('*').order('orden'),
    supabase.from('concursantes').select('id, categoria_id, nombre, institucion, poema').order('nombre'),
    supabase.rpc('orden_presentacion'),
  ])
  const err = cats.error || cons.error || orden.error
  if (err) {
    app.innerHTML = `<p class="px-5 py-20 text-center text-brick">Error: ${esc(err.message)}${/orden_presentacion|sorteo/.test(err.message) ? ' — falta ejecutar la migración 003_sorteo.sql' : ''}</p>`
    return
  }
  estado.categorias   = cats.data
  estado.concursantes = cons.data
  estado.turnos       = new Map(orden.data.map((t) => [t.concursante_id, t.turno]))
  estado.categoria  ??= (estado.categorias.find((c) => c.sorteo_revelados < delCat(c.id).length) ?? estado.categorias[0])?.id
  render()
}

// ─── RENDER ──────────────────────────────────────────────────────────────────

function render() {
  const cat = catActual()
  const lista = delCat(cat.id)
  const orden = ordenDe(cat.id)
  const sorteada = Boolean(cat.sorteado_en) && orden.length === lista.length
  const revelados = Math.min(cat.sorteo_revelados, orden.length)
  const completo = sorteada && revelados >= orden.length

  app.innerHTML = `
    <div class="mx-auto flex max-w-[1600px] flex-col gap-6 px-5 py-6 sm:px-8 lg:py-8">
      <nav class="flex flex-wrap gap-2" aria-label="Categorías">
        ${estado.categorias.map((c) => {
          const activa = c.id === cat.id
          const n = delCat(c.id).length
          const hecho = c.sorteado_en && c.sorteo_revelados >= n
          return `<button type="button" data-cat="${c.id}" aria-pressed="${activa}" ${estado.girando ? 'disabled' : ''}
                    class="cursor-pointer rounded-sm border-[1.5px] px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50
                           ${activa ? 'border-gold bg-gold text-ink' : 'border-paper/20 hover:border-paper/60'}">
                    ${esc(c.nombre)}
                    <span data-progreso="${c.id}" class="ml-1 text-xs font-normal ${activa ? 'text-ink/70' : 'text-mist/70'}">${hecho ? '✓ sorteado' : c.sorteado_en ? `${c.sorteo_revelados}/${n}` : `${n}`}</span>
                  </button>`
        }).join('')}
      </nav>

      ${!lista.length
        ? `<p class="py-24 text-center text-mist">Esta categoría no tiene concursantes.</p>`
        : !sorteada ? vistaSinSortear(cat, lista) : vistaSorteo(cat, orden, revelados, completo)}
    </div>`

  $$('[data-cat]').forEach((b) => b.addEventListener('click', () => {
    if (estado.girando) return
    estado.auto = false
    estado.categoria = b.dataset.cat
    render()
  }))
  $('#btn-sortear')?.addEventListener('click', () => sortear(cat))
  $('#btn-siguiente')?.addEventListener('click', () => revelarSiguiente())
  $('#btn-auto')?.addEventListener('click', () => alternarAuto())
  $('#btn-resortear')?.addEventListener('click', () => sortear(cat, true))
}

function vistaSinSortear(cat, lista) {
  return `
    <section class="lob-rise grid min-h-[60vh] place-items-center text-center">
      <div class="flex max-w-2xl flex-col items-center">
        <p class="text-xs font-semibold uppercase tracking-[0.28em] text-gold">${esc(cat.nombre)}${cat.descripcion ? ` · ${esc(cat.descripcion)}` : ''}</p>
        <h1 class="mt-3 text-[3rem] font-extrabold leading-none tracking-[-0.03em] sm:text-[4.5rem]">¿Quién sube primero?</h1>
        <p class="mt-5 text-lg text-mist">${lista.length} concursantes. El orden lo decide la base de datos al azar; nadie puede elegirlo.
          Después se revela turno por turno en esta pantalla y en los celulares del público.</p>
        <button id="btn-sortear" type="button"
                class="mt-10 inline-flex min-h-[64px] cursor-pointer items-center gap-3 rounded-sm bg-gold px-10 py-4 text-xl font-extrabold text-ink shadow-[0_0_60px_-10px_rgb(247_197_72/0.6)] transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold">
          Sortear ${esc(cat.nombre)}
        </button>
        <div class="mt-12 flex max-w-3xl flex-wrap justify-center gap-2">
          ${lista.map((c) => `<span class="rounded-full border border-paper/15 bg-paper/5 px-3 py-1 text-sm text-mist">${esc(c.nombre)}</span>`).join('')}
        </div>
      </div>
    </section>`
}

function vistaSorteo(cat, orden, revelados, completo) {
  const siguiente = orden[revelados]
  const ultimo = orden[revelados - 1]
  const columnas = orden.length > 16 ? 'xl:grid-cols-2' : ''

  return `
    <section class="grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-12">
      <!-- Escenario -->
      <div id="escena" class="relative flex min-h-[520px] flex-col items-center justify-center overflow-hidden rounded-sm border border-paper/10 bg-ink/40 px-6 py-10 text-center">
        <div class="lob-foco pointer-events-none absolute -top-10 left-1/2 h-[130%] w-[80%] -translate-x-1/2" aria-hidden="true"></div>

        <p class="relative text-xs font-semibold uppercase tracking-[0.28em] text-gold">${esc(cat.nombre)}${cat.descripcion ? ` · ${esc(cat.descripcion)}` : ''}</p>
        <p class="relative mt-4 text-sm font-semibold uppercase tracking-[0.3em] text-mist">Turno</p>
        <p id="num-turno" class="relative text-[7rem] font-extrabold leading-none tracking-[-0.04em] text-gold tabular-nums sm:text-[9rem]">
          ${completo ? '✓' : (siguiente ? estado.turnos.get(siguiente.id) : '')}
        </p>

        <div class="lob-rodillo relative mt-4 w-full max-w-3xl" style="height:${ALTO * 3}px">
          <div class="lob-rodillo-marco pointer-events-none absolute inset-x-0 z-10 rounded-sm border-y-2 border-gold/70 bg-gold/[0.06]" style="top:${ALTO}px;height:${ALTO}px"></div>
          <div id="tira" class="relative">
            ${filaRodillo('')}
            ${filaRodillo(completo ? 'Sorteo completo' : ultimo && revelados ? ultimo.nombre : '· · ·', !completo && !revelados)}
            ${filaRodillo('')}
          </div>
        </div>
        <p id="detalle" class="relative mt-3 min-h-[1.5em] text-base text-mist">
          ${!completo && ultimo ? esc([ultimo.institucion, ultimo.poema].filter(Boolean).join(' · ')) : ''}
        </p>

        <div class="relative mt-8 flex flex-wrap items-center justify-center gap-3">
          ${completo ? `
            <button id="btn-resortear" type="button" class="cursor-pointer rounded-sm border-[1.5px] border-paper/25 px-5 py-3 text-sm font-semibold text-mist hover:border-brick hover:text-paper">Volver a sortear</button>`
          : `
            <button id="btn-siguiente" type="button"
                    class="inline-flex min-h-[56px] cursor-pointer items-center gap-2 rounded-sm bg-gold px-8 py-3 text-lg font-extrabold text-ink transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold disabled:cursor-wait disabled:opacity-60">
              Revelar turno ${siguiente ? estado.turnos.get(siguiente.id) : ''}
            </button>
            <button id="btn-auto" type="button" aria-pressed="${estado.auto}"
                    class="inline-flex min-h-[56px] cursor-pointer items-center gap-2 rounded-sm border-[1.5px] px-6 py-3 text-base font-bold transition-colors
                           ${estado.auto ? 'border-gold text-gold' : 'border-paper/30 hover:border-paper'}">
              ${estado.auto ? '❚❚ Pausar' : '▶ Automático'}
            </button>`}
        </div>
        <p class="relative mt-4 text-xs text-mist/60">
          ${completo ? '' : 'Espacio, Enter o → para revelar · A automático · F pantalla completa'}
        </p>
      </div>

      <!-- Orden -->
      <div class="flex flex-col">
        <div class="flex items-baseline justify-between gap-4">
          <h2 class="text-2xl font-extrabold tracking-tight">Orden de presentación</h2>
          <span id="contador" class="text-sm text-mist tabular-nums">${revelados} / ${orden.length}</span>
        </div>
        <p class="mt-1 text-xs text-mist/70">Sorteo nº ${cat.sorteo_intentos} · ${new Date(cat.sorteado_en).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</p>
        <ol id="orden" class="mt-4 grid gap-1.5 ${columnas}">
          ${orden.map((c, i) => itemOrden(c, i < revelados, i === revelados - 1)).join('')}
        </ol>
      </div>
    </section>`
}

function filaRodillo(texto, tenue = false) {
  return `<div class="lob-rodillo-fila flex items-center justify-center px-4 text-center font-extrabold leading-tight tracking-tight ${tenue ? 'text-mist/40' : ''}"
               style="height:${ALTO}px">${esc(texto)}</div>`
}

function itemOrden(c, visible, reciente) {
  const turno = estado.turnos.get(c.id)
  return `
    <li data-turno="${turno}" class="flex items-center gap-3 rounded-sm border px-3 py-2 transition-colors
        ${reciente ? 'lob-llegada border-gold bg-gold/15' : visible ? 'border-paper/10 bg-paper/[0.04]' : 'border-dashed border-paper/10'}">
      <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold tabular-nums
                   ${visible ? 'bg-gold text-ink' : 'bg-paper/5 text-mist/50'}">${turno}</span>
      <span class="min-w-0 truncate ${visible ? 'font-bold' : 'text-mist/30'}">${visible ? esc(c.nombre) : '· · ·'}</span>
    </li>`
}

// ─── ACCIONES ────────────────────────────────────────────────────────────────

async function sortear(cat, repetir = false) {
  if (repetir && !confirm(`¿Volver a sortear ${cat.nombre}? Quedará registrado como sorteo nº ${cat.sorteo_intentos + 1} y se verá en la página pública.`)) return
  const btn = $('#btn-sortear') ?? $('#btn-resortear')
  if (btn) { btn.disabled = true; btn.textContent = 'Sorteando…' }
  const { error } = await supabase.rpc('sortear', { p_categoria: cat.id })
  if (error) {
    toast(error.message, 'error')
    if (btn) btn.disabled = false
    return render()
  }
  await cargar()
}

async function revelarSiguiente() {
  const cat = catActual()
  const orden = ordenDe(cat.id)
  const i = Math.min(cat.sorteo_revelados, orden.length)
  if (estado.girando || !cat.sorteado_en || i >= orden.length) return
  const elegido = orden[i]
  const turno = estado.turnos.get(elegido.id)

  estado.girando = true
  $('#btn-siguiente')?.setAttribute('disabled', '')
  $$('[data-cat]').forEach((b) => b.setAttribute('disabled', ''))
  $('#num-turno').textContent = turno
  $('#detalle').textContent = ''

  await girarRodillo(delCat(cat.id), elegido)

  // Registrar en la base → el público lo ve en vivo.
  const { error } = await supabase.from('categorias').update({ sorteo_revelados: i + 1 }).eq('id', cat.id)
  if (error) toast(`No se pudo registrar el turno ${turno}: ${error.message}`, 'error')
  cat.sorteo_revelados = i + 1

  // Contadores, celebración y llegada a la lista
  const contador = $("#contador"); if (contador) contador.textContent = `${i + 1} / ${orden.length}`
  const prog = $(`[data-progreso="${cat.id}"]`); if (prog) prog.textContent = `${i + 1}/${orden.length}`
  const escena = $('#escena')
  $('#detalle').textContent = [elegido.institucion, elegido.poema].filter(Boolean).join(' · ')
  escena?.classList.remove('lob-destello'); void escena?.offsetWidth; escena?.classList.add('lob-destello')
  confeti(escena, { cantidad: 36 })
  // El anterior deja de estar resaltado; el nuevo llega a la lista.
  $$('#orden .lob-llegada').forEach((el) => {
    el.classList.remove('lob-llegada', 'border-gold', 'bg-gold/15')
    el.classList.add('border-paper/10', 'bg-paper/[0.04]')
  })
  const li = $(`#orden [data-turno="${turno}"]`)
  if (li) {
    li.outerHTML = itemOrden(elegido, true, true)
    $(`#orden [data-turno="${turno}"]`)?.scrollIntoView({ block: 'nearest', behavior: reducido ? 'auto' : 'smooth' })
  }

  await esperar(estado.auto ? 1400 : 600)
  estado.girando = false

  if (cat.sorteo_revelados >= orden.length) {
    estado.auto = false
    confeti(escena, { cantidad: 90 })
    await esperar(900)
    return render()
  }
  // Actualiza botones y número del siguiente turno sin redibujar la escena
  const sig = orden[cat.sorteo_revelados]
  const btn = $('#btn-siguiente')
  if (btn) { btn.removeAttribute('disabled'); btn.textContent = `Revelar turno ${estado.turnos.get(sig.id)}` }
  $$('[data-cat]').forEach((b) => b.removeAttribute('disabled'))
  if (estado.auto) revelarSiguiente()
}

/** Rodillo tipo tragamonedas: pasan nombres al azar y se detiene en el elegido. */
function girarRodillo(lista, elegido) {
  const tira = $('#tira')
  if (!tira) return Promise.resolve()
  const vueltas = reducido ? 0 : (estado.auto ? 16 : 26)
  const relleno = []
  for (let k = 0; k < vueltas; k++) {
    let c
    do { c = lista[Math.floor(Math.random() * lista.length)] } while (lista.length > 1 && c.id === elegido.id && k > vueltas - 3)
    relleno.push(c.nombre)
  }
  const nombres = ['', ...relleno, elegido.nombre, '']
  tira.innerHTML = nombres.map((n) => filaRodillo(n)).join('')
  const destino = nombres.length - 2          // índice del elegido
  const final = -(destino - 1) * ALTO          // el elegido queda en la fila del medio
  if (reducido) { tira.style.transform = `translateY(${final}px)`; return Promise.resolve() }
  const anim = tira.animate(
    [{ transform: 'translateY(0)', filter: 'blur(2px)' }, { offset: 0.8, filter: 'blur(1px)' }, { transform: `translateY(${final}px)`, filter: 'blur(0)' }],
    { duration: estado.auto ? 1300 : 2400, easing: 'cubic-bezier(.15,.7,.2,1)', fill: 'forwards' },
  )
  return anim.finished
}

function alternarAuto() {
  estado.auto = !estado.auto
  const b = $('#btn-auto')
  if (b) {
    b.setAttribute('aria-pressed', String(estado.auto))
    b.textContent = estado.auto ? '❚❚ Pausar' : '▶ Automático'
    b.classList.toggle('border-gold', estado.auto); b.classList.toggle('text-gold', estado.auto)
    b.classList.toggle('border-paper/30', !estado.auto)
  }
  if (estado.auto) revelarSiguiente()
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

// ─── TECLADO Y PANTALLA COMPLETA ─────────────────────────────────────────────
// Los presentadores inalámbricos envían →, PageDown o Espacio.

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select')) return
  if ([' ', 'Enter', 'ArrowRight', 'PageDown'].includes(e.key)) {
    if (!$('#btn-siguiente')) return
    e.preventDefault()
    revelarSiguiente()
  } else if (e.key.toLowerCase() === 'a' && $('#btn-auto')) {
    alternarAuto()
  } else if (e.key.toLowerCase() === 'f') {
    pantallaCompleta()
  }
})

function pantallaCompleta() {
  if (document.fullscreenElement) document.exitFullscreen()
  else document.documentElement.requestFullscreen?.()
}

// ─── ARRANQUE ────────────────────────────────────────────────────────────────
// Al final del archivo: todo lo de arriba ya está inicializado cuando corre el await.

await requerirIngreso(app, { titulo: 'Sorteo · ingreso de la organización', rolRequerido: 'admin' })
$('#btn-salir').hidden = false
$('#btn-salir').addEventListener('click', salir)
$('#btn-pantalla').hidden = false
$('#btn-pantalla').addEventListener('click', pantallaCompleta)
await cargar()
