// Rúbrica oficial — sobre 100 puntos. `campo` = columna en public.calificaciones.
export const CRITERIOS = [
  { campo: 'interpretacion',     nombre: 'Interpretación y dominio del mensaje',                     max: 25 },
  { campo: 'expresion_vocal',    nombre: 'Expresión vocal: volumen, entonación, ritmo y modulación', max: 20 },
  { campo: 'diccion',            nombre: 'Dicción y pronunciación',                                  max: 15 },
  { campo: 'expresion_corporal', nombre: 'Expresión corporal y gestualidad',                         max: 15 },
  { campo: 'dominio_escenico',   nombre: 'Dominio escénico y seguridad',                             max: 10 },
  { campo: 'memorizacion',       nombre: 'Memorización y fluidez',                                   max: 5 },
  { campo: 'conexion',           nombre: 'Conexión con el público e impacto artístico',              max: 10 },
]

export const TOTAL_MAX = CRITERIOS.reduce((s, c) => s + c.max, 0) // 100
