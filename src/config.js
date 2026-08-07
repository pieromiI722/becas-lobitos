// ─── MAPEO DE TONO ───────────────────────────────────────────────────────────
// Deriva el tono visual a partir del campo `logra` del JSON.
// Valores conocidos: 'MEDIA BECA', 'DESCUENTO 30%', 'DESCUENTO 25%',
//                   'DESCUENTO 15%', 'DESCUENTO 10%', 'NO OBTUVO'
export function detectarTono(logra) {
  const t = String(logra ?? '').toUpperCase().trim()
  if (t === 'MEDIA BECA')                    return 'full'
  if (t.startsWith('DESCUENTO'))             return 'media'
  return 'none'
}

// ─── MENSAJES POR TONO ───────────────────────────────────────────────────────
export const MENSAJES = {
  full:  '¡Felicitaciones! Obtuviste media beca. Acércate a la academia con tu DNI para separar tu vacante.',
  media: '¡Buen resultado! Obtuviste un descuento especial en tu matrícula. Escríbenos por WhatsApp para coordinar los siguientes pasos.',
  none:  'Esta vez no obtuviste beca ni descuento, pero estuviste cerca. Consúltanos por las opciones de pago y la próxima convocatoria.',
}

// ─── FECHA DEL EXAMEN ────────────────────────────────────────────────────────
// Se muestra en el hero y debajo del H1. Formato libre.
export const FECHA_EXAMEN = '06 de agosto de 2026'
