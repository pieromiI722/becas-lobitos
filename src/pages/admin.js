import '../style.css'
import { supabase } from '../lib/supabase.js'
import { requerirIngreso, salir } from '../lib/auth.js'
import { esc, $, $$, norm, toast } from '../lib/ui.js'
import { parsearCSV, aConcursantes } from '../lib/csv.js'

const app = $('#app')

const estado = {
  categorias: [],
  resultados: [],
  nJurados: 0,
  categoria: null,
  importacion: null, // { filas, errores }
}

const delCat = (id) => estado.resultados.filter((r) => r.categoria_id === id)

const perfil = await requerirIngreso(app, { titulo: 'Ingreso de la organización', rolRequerido: 'admin' })
$('#jurado-nombre').textContent = perfil.nombre
$('#btn-salir').hidden = false
$('#btn-salir').addEventListener('click', salir)

await cargar()

// Progreso en vivo: cada vez que un jurado guarda, se recalcula.
// Si el admin está editando un promedio, se espera a que termine.
let t
function recargarLuego() {
  clearTimeout(t)
  t = setTimeout(() => (document.activeElement?.dataset.ajuste ? recargarLuego() : cargar()), 400)
}
supabase.channel('admin-calificaciones')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'calificaciones' }, () => recargarLuego())
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


// ─── RENDER ──────────────────────────────────────────────────────────────────

function render() {
  const cat = estado.categorias.find((c) => c.id === estado.categoria)
  const filas = delCat(cat.id)
  const completos = filas.filter((r) => r.jurados_calificaron >= estado.nJurados).length
  const empatados = empates(filas)

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
            ${empatados.size ? `<p class="mt-2 inline-flex items-center gap-2 rounded-sm bg-brick/10 px-3 py-1.5 font-sans text-sm font-semibold text-brick">
              ${empatados.size} concursantes con el mismo promedio${cat.publicada ? '' : ' · ajusta el promedio final para desempatar'}</p>` : ''}
          </div>
          <button id="btn-publicar" type="button" ${filas.length ? '' : 'disabled'}
                  class="min-h-[48px] cursor-pointer rounded-sm px-6 py-3 font-sans text-base font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-not-allowed disabled:opacity-50
                         ${cat.publicada ? 'border-[1.5px] border-brick text-brick hover:bg-brick hover:text-paper' : 'bg-gold text-ink hover:bg-gold-600'}">
            ${cat.publicada ? 'Retirar publicación' : 'Publicar resultados'}
          </button>
        </div>

        ${filas.length ? tabla(filas, cat, empatados) : `<p class="mt-6 font-sans text-slate">Sin concursantes. Impórtalos abajo.</p>`}
      </section>

      ${seccionImportar()}
    </div>`

  $$('[data-cat]').forEach((b) => b.addEventListener('click', () => { estado.categoria = b.dataset.cat; render() }))
  $('#btn-publicar')?.addEventListener('click', () => publicar(cat, filas, completos, empatados))
  conectarAjustes()
  conectarImportar()
}

/** Ids de concursantes que comparten promedio final con otro de su categoría. */
function empates(filas) {
  const porPromedio = new Map()
  for (const r of filas) {
    if (r.promedio == null) continue
    const k = Number(r.promedio).toFixed(2)
    porPromedio.set(k, [...(porPromedio.get(k) ?? []), r.concursante_id])
  }
  return new Set([...porPromedio.values()].filter((ids) => ids.length > 1).flat())
}

const pts = (n) => (n == null ? '—' : Number(n).toFixed(2))

function tabla(filas, cat, empatados) {
  const editable = !cat.publicada
  return `
    <div class="mt-6 overflow-x-auto">
      <table class="w-full min-w-[760px] font-sans text-sm">
        <thead>
          <tr class="border-b-[3px] border-ink text-left text-[11px] uppercase tracking-[0.14em] text-slate">
            <th class="py-2 pr-3">Puesto</th><th class="py-2 pr-3">Nº</th><th class="py-2 pr-3">Concursante</th>
            <th class="py-2 pr-3">Institución</th><th class="py-2 pr-3 text-center">Jurados</th>
            <th class="py-2 pr-3 text-right">Prom. jurados</th><th class="py-2 text-right">Promedio final</th>
          </tr>
        </thead>
        <tbody>
          ${filas.map((r) => {
            const falta = r.jurados_calificaron < estado.nJurados
            const empate = empatados.has(r.concursante_id)
            return `
            <tr class="border-b border-sand-200 ${empate ? 'bg-brick/5' : ''}">
              <td class="py-2.5 pr-3 whitespace-nowrap">
                <span class="text-lg font-extrabold">${r.puesto ?? '—'}</span>
                ${empate ? `<span class="ml-1 rounded-sm bg-brick px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-paper" title="Mismo promedio que otro concursante. Si no se ajusta, desempata el criterio Interpretación.">Empate</span>` : ''}
              </td>
              <td class="py-2.5 pr-3 text-slate">${r.orden ?? ''}</td>
              <td class="py-2.5 pr-3 font-semibold">${esc(r.nombre)}</td>
              <td class="py-2.5 pr-3 text-slate">${esc(r.institucion ?? '')}</td>
              <td class="py-2.5 pr-3 text-center"><span class="rounded-sm px-2 py-0.5 font-bold ${falta ? 'bg-brick/10 text-brick' : 'bg-teal/10 text-teal'}">${r.jurados_calificaron}/${estado.nJurados}</span></td>
              <td class="py-2.5 pr-3 text-right tabular-nums text-slate">${pts(r.promedio_jurados)}</td>
              <td class="py-2 text-right whitespace-nowrap">
                ${editable && r.promedio != null ? `
                  <span class="inline-flex items-center justify-end gap-1.5">
                    ${r.ajustado ? `<button type="button" data-quitar="${r.concursante_id}" title="Quitar ajuste y volver al promedio de los jurados"
                                      class="cursor-pointer rounded-sm px-1.5 py-1 text-xs font-semibold text-teal hover:bg-teal/10">↺ quitar</button>` : ''}
                    <input type="number" inputmode="decimal" min="0" max="100" step="0.01" value="${pts(r.promedio)}"
                           data-ajuste="${r.concursante_id}" data-original="${pts(r.promedio)}" aria-label="Promedio final de ${esc(r.nombre)}"
                           class="w-24 rounded-sm border-[1.5px] px-2 py-1.5 text-right text-base font-bold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal
                                  ${r.ajustado ? 'border-gold bg-gold/15' : 'border-sand bg-white'}">
                  </span>`
                : `<span class="text-base font-bold tabular-nums">${pts(r.promedio)}</span>
                   ${r.ajustado ? '<span class="ml-1 rounded-sm bg-gold/30 px-1.5 py-0.5 text-[10px] font-bold uppercase">ajustado</span>' : ''}`}
              </td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
      ${editable ? `<p class="mt-3 font-sans text-xs text-slate">
        El promedio final se puede ajustar antes de publicar (Enter o clic fuera para guardar, Esc para cancelar). Los ajustes se marcan
        en dorado, solo los ve la organización y quedan bloqueados al publicar. El público solo ve el promedio final.</p>` : ''}
    </div>`
}

function conectarAjustes() {
  $$('[data-ajuste]').forEach((input) => {
    const guardar = async () => {
      const raw = input.value.trim().replace(',', '.')
      if (raw === input.dataset.original) return
      const n = Number(raw)
      if (raw === '' || !Number.isFinite(n) || n < 0 || n > 100) {
        toast('El promedio debe estar entre 0 y 100', 'error')
        input.value = input.dataset.original
        return
      }
      input.dataset.original = n.toFixed(2) // evita doble guardado (Enter + blur)
      const id = Number(input.dataset.ajuste)
      const fila = estado.resultados.find((r) => r.concursante_id === id)
      // Si vuelve exactamente al promedio de los jurados, se elimina el ajuste.
      const { error } = n.toFixed(2) === pts(fila?.promedio_jurados)
        ? await supabase.from('ajustes').delete().eq('concursante_id', id)
        : await supabase.from('ajustes').upsert({ concursante_id: id, promedio: n })
      if (error) return toast(`No se pudo guardar: ${error.message}`, 'error')
      toast(`Promedio final de ${fila?.nombre ?? 'concursante'}: ${n.toFixed(2)}`)
      input.blur()
      cargar()
    }
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); guardar() }
      if (e.key === 'Escape') { input.value = input.dataset.original; input.blur() }
    })
    input.addEventListener('blur', guardar)
  })

  $$('[data-quitar]').forEach((b) => b.addEventListener('click', async () => {
    const { error } = await supabase.from('ajustes').delete().eq('concursante_id', Number(b.dataset.quitar))
    if (error) return toast(`Error: ${error.message}`, 'error')
    toast('Ajuste quitado')
    cargar()
  }))
}

async function publicar(cat, filas, completos, empatados) {
  const publicar = !cat.publicada
  if (publicar) {
    const faltan = filas.length - completos
    const avisos = [
      faltan && `• A ${faltan} concursante(s) aún les faltan calificaciones.`,
      empatados.size && `• Hay ${empatados.size} concursantes con el mismo promedio (se desempatará por Interpretación).`,
    ].filter(Boolean)
    const msg = (avisos.length ? `Atención:\n${avisos.join('\n')}\n\n` : '')
      + `¿Publicar los resultados de ${cat.nombre}? Aparecerán al instante en la página principal y ya no se podrán modificar notas ni promedios.`
    if (!confirm(msg)) return
  } else if (!confirm(`¿Retirar la publicación de ${cat.nombre}? Desaparecerá de la página y se podrán volver a editar notas y promedios.`)) return

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
