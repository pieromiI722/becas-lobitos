// ─── CONFIGURACIÓN DE GOOGLE SHEETS ─────────────────────────────────────────
// Reemplazá estos valores con los de tu hoja de cálculo.

export const SPREADSHEET_ID = 'TU_SPREADSHEET_ID_AQUI'
export const SHEET_NAME = 'Hoja1'   // nombre exacto de la pestaña

// ─── ÍNDICES DE COLUMNAS (base 0) ───────────────────────────────────────────
// Ajustá si cambia el orden de las columnas en la hoja.
export const COL = {
  CODIGO:  0,   // A — Código / DNI del postulante
  NOMBRE:  1,   // B — Nombre completo
  PUNTAJE: 2,   // C — Puntaje obtenido
  ESTADO:  3,   // D — Estado (Aprobado / No aprobado / Pendiente)
  CARRERA: 4,   // E — Carrera o nivel (opcional)
  OBS:     5,   // F — Observaciones (opcional)
}

// ─── ETIQUETAS DE ESTADO ─────────────────────────────────────────────────────
export const ESTADO = {
  APROBADO:    'Aprobado',
  NO_APROBADO: 'No aprobado',
  PENDIENTE:   'Pendiente',
}
