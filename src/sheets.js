import { SPREADSHEET_ID, SHEET_NAME, COL } from './config.js'

const BASE_URL = 'https://docs.google.com/spreadsheets/d'

/**
 * Construye la URL de la Google Visualization API para una query SQL-like.
 * No requiere API key — la hoja debe ser pública (Anyone with the link can view).
 */
function buildQueryUrl(query) {
  const encoded = encodeURIComponent(query)
  const sheet   = encodeURIComponent(SHEET_NAME)
  return `${BASE_URL}/${SPREADSHEET_ID}/gviz/tq?tq=${encoded}&sheet=${sheet}&tqx=out:json`
}

/**
 * Limpia el wrapper `google.visualization.Query.setResponse(...)` que devuelve
 * la API y parsea el JSON interior.
 */
function parseGvizResponse(raw) {
  // La respuesta tiene la forma: /*O_o*/\ngoogle.visualization.Query.setResponse({...});
  const match = raw.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/)
  if (!match) throw new Error('Formato de respuesta inesperado de Google Sheets')
  return JSON.parse(match[1])
}

/**
 * Convierte una fila del resultado gviz en un objeto con campos legibles.
 * Devuelve null si la fila está vacía.
 */
function rowToObject(row) {
  if (!row?.c) return null
  const get = (i) => row.c[i]?.v ?? row.c[i]?.f ?? null

  return {
    codigo:  String(get(COL.CODIGO)  ?? '').trim(),
    nombre:  String(get(COL.NOMBRE)  ?? '').trim(),
    puntaje: get(COL.PUNTAJE),
    estado:  String(get(COL.ESTADO)  ?? '').trim(),
    carrera: get(COL.CARRERA) != null ? String(get(COL.CARRERA)).trim() : null,
    obs:     get(COL.OBS)     != null ? String(get(COL.OBS)).trim()     : null,
  }
}

/**
 * Busca un postulante por código o DNI.
 * @param {string} valor — código o DNI a buscar (se normaliza a mayúsculas y sin espacios)
 * @returns {Promise<object|null>} — objeto con datos del postulante, o null si no se encuentra
 */
export async function fetchResultado(valor) {
  const normalizado = String(valor).trim().toUpperCase()
  if (!normalizado) throw new Error('Ingresá un código o DNI válido')

  // Columna A contiene el código/DNI; UPPER() para comparación case-insensitive
  const query = `SELECT * WHERE UPPER(A) = '${normalizado}' LIMIT 1`
  const url   = buildQueryUrl(query)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Error al conectar con la base de datos (${res.status})`)

  const text = await res.text()
  const data = parseGvizResponse(text)

  if (data.status === 'error') {
    const msg = data.errors?.[0]?.detailed_message ?? 'Error en la consulta'
    throw new Error(msg)
  }

  const rows = data.table?.rows ?? []
  if (rows.length === 0) return null

  return rowToObject(rows[0])
}
