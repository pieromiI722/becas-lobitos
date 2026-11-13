import { norm } from './ui.js'

/** Parser CSV mínimo: comillas, comillas escapadas, separador , o ; autodetectado. */
export function parsearCSV(texto) {
  const limpio = texto.replace(/^﻿/, '')
  const primera = limpio.split(/\r?\n/, 1)[0] ?? ''
  const sep = (primera.match(/;/g)?.length ?? 0) > (primera.match(/,/g)?.length ?? 0) ? ';' : ','

  const filas = []
  let fila = [], campo = '', comillas = false
  for (let i = 0; i < limpio.length; i++) {
    const ch = limpio[i]
    if (comillas) {
      if (ch === '"' && limpio[i + 1] === '"') { campo += '"'; i++ }
      else if (ch === '"') comillas = false
      else campo += ch
    } else if (ch === '"') comillas = true
    else if (ch === sep) { fila.push(campo); campo = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && limpio[i + 1] === '\n') i++
      fila.push(campo); filas.push(fila); fila = []; campo = ''
    } else campo += ch
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila) }

  const utiles = filas.filter((f) => f.some((c) => c.trim() !== ''))
  const [encabezados = [], ...resto] = utiles
  return { encabezados: encabezados.map((h) => norm(h)), filas: resto }
}

const ALIAS = {
  nombre:      ['nombre', 'nombre completo', 'apellidos y nombres', 'concursante', 'participante', 'estudiante', 'alumno'],
  apellidos:   ['apellidos', 'apellido'],
  nombres:     ['nombres'],
  categoria:   ['categoria', 'nivel'],
  orden:       ['orden', 'n', 'no', 'nro', 'numero', 'n°', 'nº', '#'],
  institucion: ['institucion', 'institucion educativa', 'colegio', 'ie', 'i.e.', 'escuela', 'procedencia'],
  poema:       ['poema', 'obra', 'titulo', 'poesia'],
}

/** Convierte filas CSV a registros de `concursantes`. */
export function aConcursantes(encabezados, filas, categorias) {
  const col = Object.fromEntries(Object.entries(ALIAS).map(([k, alias]) =>
    [k, encabezados.findIndex((h) => alias.includes(h))]))

  const mapaCat = new Map()
  for (const c of categorias) { mapaCat.set(norm(c.id), c.id); mapaCat.set(norm(c.nombre), c.id) }
  mapaCat.set('avanzado', 'avanzados')

  const errores = []
  if (col.categoria < 0) errores.push('No se encontró la columna "categoria".')
  if (col.nombre < 0 && col.apellidos < 0 && col.nombres < 0) errores.push('No se encontró la columna "nombre".')
  if (errores.length) return { filas: [], errores }

  const val = (f, k) => (col[k] >= 0 ? String(f[col[k]] ?? '').trim() : '')
  const salida = []

  filas.forEach((f, i) => {
    const linea = i + 2
    const nombre = val(f, 'nombre') || [val(f, 'apellidos'), val(f, 'nombres')].filter(Boolean).join(', ')
    const catTxt = val(f, 'categoria')
    const categoria_id = mapaCat.get(norm(catTxt))
    if (!nombre) return errores.push(`Línea ${linea}: falta el nombre.`)
    if (!categoria_id) return errores.push(`Línea ${linea}: categoría "${catTxt}" no reconocida.`)
    const orden = Number.parseInt(val(f, 'orden'), 10)
    salida.push({
      categoria_id,
      nombre,
      orden: Number.isFinite(orden) ? orden : null,
      institucion: val(f, 'institucion') || null,
      poema: val(f, 'poema') || null,
    })
  })

  return { filas: salida, errores }
}
