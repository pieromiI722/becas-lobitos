import '../style.css'
import { supabase } from '../lib/supabase.js'
import { requerirIngreso, salir } from '../lib/auth.js'
import { esc, $, $$, fmt, norm, toast } from '../lib/ui.js'
import { parsearCSV, aConcursantes } from '../lib/csv.js'

const app = $('#app')

const estado = {
  categorias: [],
  resultados: [],
  nJurados: 0,
  categoria: null,
  importacion: null, // { filas, errores }
}

const perfil = await requerirIngreso(app, { titulo: 'Ingreso de la organización', rolRequerido: 'admin' })
$('#jurado-nombre').textContent = perfil.nombre
$('#btn-salir').hidden = false
$('#btn-salir').addEventListener('click', salir)

await cargar()

// Progreso en vivo: cada vez que un jurado guarda, se recalcula.
let t
supabase.channel('admin-calificaciones')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'calificaciones' }, () => {
    clearTimeout(t)
    t = setTimeout(cargar, 400)
  })
  .subscribe()

// ─── DATOS ───────────────────────────────────────────────────────────────────

async function cargar() {
  const [cats, res, jur] = await Promise.all([
    supabase.from('categorias').select('*').order('orden'),
    supabase.rpc('resultados'),
    supabase.from('perfiles').select('id', { count: 'exact', head: true }).eq('rol', 'jurado'),
  ])
  const err = cats.error || res.error || jur.error
  if (err) {
    app.innerHTML = `<p class="px-5 py-20 text-center font-sans text-brick">Error: ${esc(err.message)}</p>`
    return
  }
  estado.categorias = cats.data
  estado.resultados = res.data
  estado.nJurados   = jur.count ?? 0
  estado.categoria ??= estado.categorias[0]?.id
  render()
}

const delCat = (id) => estado.resultados.filter((r) => r.categoria_id === id)

// ─── RENDER ──────────────────────────────────────────────────────────────────

function render() {
  const cat = estado.categorias.find((c) => c.id === estado.categoria)
  const filas = delCat(cat.id)
  const completos = filas.filter((r) => r.jurados_calificaron >= estado.nJurados).length

  app.innerHTML = `
    <div class="mx-auto max-w-7xl px-5 py-6 sm:px-8">
      <nav class="flex flex-wrap gap-2 font-sans" aria-label="Categorías">
        ${estado.categorias.map((c) => {
          const activo = c.id === estado.categoria
          return `<button type="button" data-cat="${c.id}" aria-pressed="${activo}"
                    class="cursor-pointer rounded-sm border-[1.5px] px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal
                           ${activo ? 'border-ink bg-ink text-paper' : 'border-sand bg-white hover:border-ink'}">
                    ${esc(c.nombre)} <span class="ml-1 font-normal ${activo ? 'text-mist' : 'text-slate'}">${delCat(c.id).length}</span>
                    ${c.publicada ? `<span class="ml-1.5 rounded-sm bg-gold px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink">Publicada</span>` : ''}
                  </button>`
        }).join('')}
      </nav>

      <section class="mt-6 bg-white p-6 sm:p-8">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold sm:text-[2rem]">${esc(cat.nombre)}</h1>
            <p class="mt-1 font-sans text-sm text-slate">
              ${completos} de ${filas.length} concursantes con las ${estado.nJurados} calificaciones completas
              · ${cat.publicada ? `Publicada ${new Date(cat.publicada_en).toLocaleString('es-PE')}` : 'No publicada'}
            </p>
          </div>
          <button id="btn-publicar" type="button" ${filas.length ? '' : 'disabled'}
                  class="min-h-[48px] cursor-pointer rounded-sm px-6 py-3 font-sans text-base font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-not-allowed disabled:opacity-50
                         ${cat.publicada ? 'border-[1.5px] border-brick text-brick hover:bg-brick hover:text-paper' : 'bg-gold text-ink hover:bg-gold-600'}">
            ${cat.publicada ? 'Retirar publicación' : 'Publicar resultados'}
          </button>
        </div>

        ${filas.length ? tabla(filas) : `<p class="mt-6 font-sans text-slate">Sin concursantes. Impórtalos abajo.</p>`}
      </section>

      ${seccionImportar()}
    </div>`

  $$('[data-cat]').forEach((b) => b.addEventListener('click', () => { estado.categoria = b.dataset.cat; render() }))
  $('#btn-publicar')?.addEventListener('click', () => publicar(cat, filas, completos))
  conectarImportar()
}

function tabla(filas) {
  return `
    <div class="mt-6 overflow-x-auto">
      <table class="w-full min-w-[640px] font-sans text-sm">
        <thead>
          <tr class="border-b-[3px] border-ink text-left text-[11px] uppercase tracking-[0.14em] text-slate">
            <th class="py-2 pr-3">Puesto</th><th class="py-2 pr-3">Nº</th><th class="py-2 pr-3">Concursante</th>
            <th class="py-2 pr-3">Institución</th><th class="py-2 pr-3 text-center">Jurados</th><th class="py-2 text-right">Promedio</th>
          </tr>
        </thead>
        <tbody>
          ${filas.map((r) => {
            const falta = r.jurados_calificaron < estado.nJurados
            return `
            <tr class="border-b border-sand-200">
              <td class="py-2.5 pr-3 text-lg font-extrabold">${r.puesto ?? '—'}</td>
              <td class="py-2.5 pr-3 text-slate">${r.orden ?? ''}</td>
              <td class="py-2.5 pr-3 font-semibold">${esc(r.nombre)}</td>
              <td class="py-2.5 pr-3 text-slate">${esc(r.institucion ?? '')}</td>
              <td class="py-2.5 pr-3 text-center"><span class="rounded-sm px-2 py-0.5 font-bold ${falta ? 'bg-brick/10 text-brick' : 'bg-teal/10 text-teal'}">${r.jurados_calificaron}/${estado.nJurados}</span></td>
              <td class="py-2.5 text-right text-base font-bold tabular-nums">${fmt(r.promedio)}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>`
}

async function publicar(cat, filas, completos) {
  const publicar = !cat.publicada
  if (publicar) {
    const faltan = filas.length - completos
    const msg = faltan
      ? `Atención: a ${faltan} concursante(s) aún les faltan calificaciones.\n\n¿Publicar ${cat.nombre} de todos modos? Los jurados ya no podrán modificar notas.`
      : `¿Publicar los resultados de ${cat.nombre}? Aparecerán al instante en la página principal y los jurados ya no podrán modificar notas.`
    if (!confirm(msg)) return
  } else if (!confirm(`¿Retirar la publicación de ${cat.nombre}? Desaparecerá de la página y los jurados podrán volver a editar.`)) return

  const { error } = await supabase.from('categorias')
    .update({ publicada: publicar, publicada_en: publicar ? new Date().toISOString() : null })
    .eq('id', cat.id)
  if (error) return toast(`Error: ${error.message}`, 'error')
  toast(publicar ? `${cat.nombre} publicada` : `${cat.nombre} retirada`)
  cargar()
}

// ─── IMPORTAR CSV ────────────────────────────────────────────────────────────

function seccionImportar() {
  const imp = estado.importacion
  return `
    <section class="mt-6 bg-white p-6 sm:p-8">
      <h2 class="text-xl font-bold">Importar concursantes (CSV)</h2>
      <p class="mt-1 max-w-[70ch] font-sans text-sm text-slate">
        Columnas reconocidas: <b>nombre</b> (o <b>apellidos</b> + <b>nombres</b>), <b>categoria</b>
        (Primaria, Secundaria, Máster, Avanzados), y opcionales <b>orden</b>, <b>institucion</b>, <b>poema</b>.
        Separador coma o punto y coma.
      </p>
      <input id="csv" type="file" accept=".csv,text/csv"
             class="mt-4 block font-sans text-sm file:mr-4 file:cursor-pointer file:rounded-sm file:border-0 file:bg-ink file:px-4 file:py-2.5 file:font-semibold file:text-paper">
      ${imp ? `
        <div class="mt-5 font-sans text-sm">
          <p><b>${imp.filas.length}</b> concursantes listos para importar
             ${imp.errores.length ? `· <span class="text-brick">${imp.errores.length} fila(s) con problemas</span>` : ''}</p>
          ${imp.errores.length ? `<ul class="mt-2 list-disc pl-5 text-brick">${imp.errores.slice(0, 10).map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
          <div class="mt-3 max-h-72 overflow-auto border border-sand-200">
            <table class="w-full text-left">
              <thead class="sticky top-0 bg-paper text-[11px] uppercase tracking-[0.14em] text-slate">
                <tr><th class="p-2">Cat.</th><th class="p-2">Nº</th><th class="p-2">Nombre</th><th class="p-2">Institución</th><th class="p-2">Poema</th></tr>
              </thead>
              <tbody>${imp.filas.map((f) => `
                <tr class="border-t border-sand-200"><td class="p-2">${esc(f.categoria_id)}</td><td class="p-2">${f.orden ?? ''}</td>
                <td class="p-2 font-semibold">${esc(f.nombre)}</td><td class="p-2">${esc(f.institucion ?? '')}</td><td class="p-2">${esc(f.poema ?? '')}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
          <div class="mt-4 flex gap-3">
            <button id="btn-importar" type="button" ${imp.filas.length ? '' : 'disabled'}
                    class="min-h-[44px] cursor-pointer rounded-sm bg-teal px-5 py-2.5 font-semibold text-paper hover:bg-teal-700 disabled:opacity-50">Importar ${imp.filas.length}</button>
            <button id="btn-cancelar" type="button" class="min-h-[44px] cursor-pointer rounded-sm border-[1.5px] border-sand px-5 py-2.5 font-semibold hover:border-ink">Cancelar</button>
          </div>
        </div>` : ''}
    </section>`
}

function conectarImportar() {
  $('#csv')?.addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const texto = await file.text()
    const { encabezados, filas } = parsearCSV(texto)
    estado.importacion = aConcursantes(encabezados, filas, estado.categorias)
    render()
  })
  $('#btn-cancelar')?.addEventListener('click', () => { estado.importacion = null; render() })
  $('#btn-importar')?.addEventListener('click', async () => {
    const filas = estado.importacion.filas
    const existentes = new Set(estado.resultados.map((r) => `${r.categoria_id}|${norm(r.nombre)}`))
    const nuevas = filas.filter((f) => !existentes.has(`${f.categoria_id}|${norm(f.nombre)}`))
    const repetidas = filas.length - nuevas.length
    if (!confirm(`Se importarán ${nuevas.length} concursantes${repetidas ? ` (${repetidas} ya existían y se omiten)` : ''}. ¿Continuar?`)) return

    const { error } = await supabase.from('concursantes').insert(nuevas)
    if (error) return toast(`Error al importar: ${error.message}`, 'error')
    toast(`${nuevas.length} concursantes importados`)
    estado.importacion = null
    cargar()
  })
}
