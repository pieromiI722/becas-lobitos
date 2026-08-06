// ─── CONFIGURACIÓN DE GOOGLE SHEETS ─────────────────────────────────────────
// Reemplazá estos valores con los de tu hoja de cálculo.

export const SPREADSHEET_ID = 'TU_SPREADSHEET_ID_AQUI'
export const SHEET_NAME = 'Hoja1'   // nombre exacto de la pestaña

// ─── ÍNDICES DE COLUMNAS (base 0) ───────────────────────────────────────────
// Ajustá si cambia el orden de las columnas en la hoja.
export const COL = {
  CODIGO:  0,   // A — Código del alumno (ej. LOB-1024)
  NOMBRE:  1,   // B — Apellidos y nombres completos
  PUNTAJE: 2,   // C — Puntaje obtenido (número)
  BECA:    3,   // D — Texto de beca (ej. "Beca completa 100%", "Media beca 50%", "Sin beca esta vez")
}

// ─── MAPEO DE TONO ───────────────────────────────────────────────────────────
// Derivamos el tono visual a partir del texto de la columna BECA.
// Ajustá las palabras clave si los textos en tu hoja son distintos.
export function detectarTono(textoBeca) {
  const t = String(textoBeca ?? '').toLowerCase()
  if (t.includes('completa') || t.includes('100'))  return 'full'
  if (t.includes('media')    || t.includes('50'))   return 'media'
  return 'none'
}

// ─── MENSAJES POR TONO ───────────────────────────────────────────────────────
export const MENSAJES = {
  full:  '¡Felicitaciones! Tu esfuerzo te dio el 100% de beca. Acércate a la academia con tu DNI para separar tu vacante.',
  media: '¡Muy buen trabajo! Alcanzaste media beca. Escríbenos por WhatsApp y te contamos los pasos para matricularte.',
  none:  'Esta vez no alcanzó la beca, pero estuviste cerca. Pregúntanos por los descuentos por pronto pago y el próximo examen.',
}

// ─── FECHA DEL EXAMEN ────────────────────────────────────────────────────────
// Se muestra en el hero y debajo del H1. Formato libre.
export const FECHA_EXAMEN = '05 de agosto de 2026'
