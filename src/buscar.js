import resultados from './data/resultados.json'
import { detectarTono } from './config.js'

// Normaliza un string: minúsculas, sin acentos, sin caracteres especiales
const norm = (s) =>
  String(s ?? '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')

// Construye el nombre completo para mostrar en la tarjeta
function nombreCompleto(r) {
  return `${r.apPaterno} ${r.apMaterno}, ${r.nombres}`.trim()
}

// Convierte un registro del JSON al shape que espera la UI
function toAlumno(r) {
  return {
    nombre:        nombreCompleto(r),
    dni:           r.dni,
    codigo:        r.codigo,
    area:          r.area,
    carrera:       r.carrera,
    notaVigesimal: r.notaVigesimal,
    notaUncp:      r.notaUncp,
    beca:          r.logra,
    tono:          detectarTono(r.logra),
  }
}

/**
 * Busca un alumno por código exacto (case-insensitive).
 * @param {string} valor
 * @returns {object|null}
 */
export function buscarPorCodigo(valor) {
  const q = norm(valor)
  if (!q) return null
  const found = resultados.find((r) => norm(r.codigo) === q)
  return found ? toAlumno(found) : null
}

/**
 * Busca un alumno por DNI exacto.
 * @param {string} valor
 * @returns {object|null}
 */
export function buscarPorDni(valor) {
  const q = String(valor).trim()
  if (!q) return null
  const found = resultados.find((r) => String(r.dni).trim() === q)
  return found ? toAlumno(found) : null
}

/**
 * Busca alumnos por nombre parcial (apellidos o nombres, case-insensitive, sin acentos).
 * Devuelve el primer match.
 * @param {string} valor
 * @returns {object|null}
 */
export function buscarPorNombre(valor) {
  const q = norm(valor)
  if (!q) return null
  const found = resultados.find((r) =>
    norm(`${r.apPaterno} ${r.apMaterno} ${r.nombres}`).includes(q)
  )
  return found ? toAlumno(found) : null
}
