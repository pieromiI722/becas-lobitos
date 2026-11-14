// Acta de calificación y diplomas de una categoría, generados en el navegador desde /admin.
// Solo LEE de la base (resultados, notas, jurados, orden de presentación); no escribe nada.
// Se abren en una ventana aparte, con los textos corregibles a mano (borde punteado),
// y desde ahí se guardan como PDF con el cuadro de impresión del navegador.
import { CRITERIOS } from './rubrica.js'

const PROMOTOR = 'Mg. Caleb Hinostroza Meza'
const FECHA = 'Concepción, 14 de noviembre de 2026'
const CLAVE = 'lobitos-doc:'

const CORTO = {
  interpretacion: 'Interp.', expresion_vocal: 'Voz', diccion: 'Dicción', expresion_corporal: 'Corporal',
  dominio_escenico: 'Escénico', memorizacion: 'Memoria', conexion: 'Conexión',
}

// ─── Textos ya revisados con la organización (valores iniciales, todos editables) ──
const NUMERO_ACTA = {
  primaria_a: '001-2026-CND/PA', primaria_b: '002-2026-CND/PB', secundaria: '003-2026-CND/SEC',
  master: '004-2026-CND/MA', avanzados: '005-2026-CND/AV',
}
const CONSTANCIAS = {
  primaria_a: [
    'La concursante Oré Tomás Anyeli Yumira, inscrita inicialmente en esta categoría (turno 4), fue reubicada en la categoría Primaria B por corresponderle según su grado; la calificación registrada por error en esta categoría fue anulada y no se considera en los resultados. Por ello el turno 4 no figura en el anexo.',
  ],
  primaria_b: [
    'La concursante Oré Tomás Anyeli Yumira, inscrita inicialmente por error en la categoría Primaria A, fue reubicada en esta categoría por corresponderle según su grado, con el turno 15 asignado por la organización. La concursante Machuca Esteban Angelina se incorporó con el turno 14, también asignado por la organización.',
  ],
}
// Nombre completo informado por la organización (en la inscripción figuraba incompleto)
const NOMBRE_ACTA = {
  'Orihuela Theo': 'Orihuela Flores Theo Santiago',
  'Rebeca Esteban Barzola': 'Esteban Barzola Rebeca', // se registró con el nombre primero
}
// En la base los nombres van "Apellidos Nombres"; en el diploma, "Nombres Apellidos".
const NOMBRE_DIPLOMA = {
  'Acevedo Roman Thaisa Alejandra Estela': 'Thaisa Alejandra Estela Acevedo Roman',
  'Veliz Amaro Thiago Said Enrique': 'Thiago Said Enrique Veliz Amaro',
  'Sebastien Alexander Maldonado Capcha': 'Sebastien Alexander Maldonado Capcha',
  'Orihuela Theo': 'Theo Santiago Orihuela Flores',
  'Salas Aquino Eydam Salvador': 'Eydam Salvador Salas Aquino',
  'Pari Medrano Jossand Valentino': 'Jossand Valentino Pari Medrano',
  'Conde Mandujano Thiago': 'Thiago Conde Mandujano',
  'Oré Tomás Anyeli Yumira': 'Anyeli Yumira Oré Tomás',
  'Huamaní López Valeska Zoe': 'Valeska Zoe Huamaní López',
  'Lazaro Romualdo Valery Marina': 'Valery Marina Lazaro Romualdo',
  'Rebeca Esteban Barzola': 'Rebeca Esteban Barzola',
}
const POEMA = {
  'Acevedo Roman Thaisa Alejandra Estela': 'Hijos de la misma tierra',
  'Veliz Amaro Thiago Said Enrique': '¿Dónde están las manos de Dios?',
  'Sebastien Alexander Maldonado Capcha': 'Canto coral a Túpac Amaru',
  'Orihuela Theo': 'Arenga al peruano',
  'Salas Aquino Eydam Salvador': 'El niño de la calle',
  'Pari Medrano Jossand Valentino': 'Biocidio terrarbol asháninka',
  'Conde Mandujano Thiago': 'No te rindas',
  'Oré Tomás Anyeli Yumira': 'La marioneta',
  'Huamaní López Valeska Zoe': 'Canto de esperanza',
  'Lazaro Romualdo Valery Marina': 'La infancia que el mundo olvidó',
}
const LUGAR = { 1: 'Primer puesto', 2: 'Segundo puesto', 3: 'Tercer puesto', 4: 'Mención honrosa (4.º puesto)', 5: 'Mención honrosa (5.º puesto)' }
const PUESTO = {
  1: { texto: 'PRIMER PUESTO', color: '#a87b12' },
  2: { texto: 'SEGUNDO PUESTO', color: '#6f7d82' },
  3: { texto: 'TERCER PUESTO', color: '#9a643a' },
  4: { texto: 'CUARTO PUESTO', color: '#0e6c76', titulo: 'Mención Honrosa' },
  5: { texto: 'QUINTO PUESTO', color: '#0e6c76', titulo: 'Mención Honrosa' },
}

// ─── Utilidades ──────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const n2 = (n) => Number(n).toFixed(2)
const UNIDADES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce',
  'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós',
  'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve']
const DECENAS = { 3: 'treinta', 4: 'cuarenta', 5: 'cincuenta', 6: 'sesenta', 7: 'setenta', 8: 'ochenta', 9: 'noventa' }
const letras = (n) => (n < 30 ? UNIDADES[n] : `${DECENAS[Math.floor(n / 10)]}${n % 10 ? ` y ${UNIDADES[n % 10]}` : ''}`)
  .replace(/veintiuno$/, 'veintiún').replace(/(^| )uno$/, '$1un')
const enLetras = (n) => `${letras(n)} (${n})`
const apellidoJurado = (nom) => { const p = nom.replace(/^(dra?|mg)\.?\s+/i, '').split(' '); return p[p.length - 2] }
const inst = (s) => esc((s ?? '—').replace(/^INSTITUCIÓN EDUCATIVA /i, 'I.E. '))
const capitalizar = (w) => (w === w.toUpperCase() || w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w)

/** "Apellido Apellido Nombre(s)" → "Nombre(s) Apellido Apellido" (propuesta; se corrige a mano). */
export function nombreDiploma(n) {
  if (NOMBRE_DIPLOMA[n]) return NOMBRE_DIPLOMA[n]
  let p = String(n).trim().split(/\s+/).map(capitalizar)
  if (p.length >= 3) p = [...p.slice(2), ...p.slice(0, 2)]
  else if (p.length === 2) p = [p[1], p[0]]
  return p.join(' ')
}

/** Título del poema sin autor ni comillas, a partir de lo que se escribió en la inscripción. */
export function tituloPoema(nombre, poema) {
  if (POEMA[nombre]) return POEMA[nombre]
  let s = String(poema ?? '').trim().replace(/^POEMA\s*:\s*/i, '')
  if (!s) return ''
  const citado = s.match(/["“«]([^"”»]+)["”»]/)
  s = citado ? citado[1] : s.split(/\s+[-–_/]\s+|\s*\bAUTORA?\b\s*:?|\.\s*De\s*:/i)[0]
  s = s.replace(/\s*\((poema|an[oó]nimo)\)\s*$/i, '').replace(/[.,;:\s]+$/, '').trim()
  if (s === s.toUpperCase()) s = s.charAt(0) + s.slice(1).toLowerCase()
  return s
}

async function sha256(texto) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ─── Datos ───────────────────────────────────────────────────────────────────

/** Lee de la base, en el momento, todo lo que necesita el acta de una categoría. */
export async function cargarDatos(supabase, catId) {
  const [cats, res, jur, cal, ord] = await Promise.all([
    supabase.from('categorias').select('*').eq('id', catId).single(),
    supabase.rpc('resultados'),
    supabase.from('perfiles').select('id, nombre, usuario').eq('rol', 'jurado').order('usuario'),
    supabase.from('calificaciones').select('*'),
    supabase.rpc('orden_presentacion'),
  ])
  const err = cats.error || res.error || jur.error || cal.error || ord.error
  if (err) throw new Error(err.message)
  const filas = res.data.filter((r) => r.categoria_id === catId)
  const ids = new Set(filas.map((r) => r.concursante_id))
  return {
    cat: cats.data,
    filas,
    jurados: jur.data,
    notas: cal.data.filter((k) => ids.has(k.concursante_id)),
    turnos: ord.data.filter((t) => t.categoria_id === catId),
    generado: new Date(),
  }
}

/** Puestos, NSP, validaciones y huella. Misma lógica que las actas ya impresas. */
export async function analizar({ cat, filas, jurados, notas, turnos }) {
  const nota = (j, c) => notas.find((k) => k.jurado_id === j.id && k.concursante_id === c)
  const turno = new Map(turnos.map((t) => [t.concursante_id, t.turno]))
  const fijos = turnos.filter((t) => t.fijo)
  // "No se presentó": los jurados registraron 0 en todos los criterios
  const nsp = (r) => {
    const ks = notas.filter((k) => k.concursante_id === r.concursante_id)
    return ks.length > 0 && ks.every((k) => Number(k.total) === 0)
  }
  const presentados = filas.filter((r) => !nsp(r) && r.puesto != null).sort((a, b) => a.puesto - b.puesto)
  const ausentes = filas.filter(nsp)

  const errores = []
  if (!filas.length) errores.push('La categoría no tiene concursantes.')
  if (!jurados.length) errores.push('No hay jurados registrados.')
  const incompletos = filas.filter((r) => r.jurados_calificaron < jurados.length)
  if (incompletos.length) {
    errores.push(`Faltan calificaciones de ${incompletos.length} concursante(s): ${incompletos.map((r) => `${r.nombre} (${r.jurados_calificaron} de ${jurados.length})`).join('; ')}.`)
  }
  presentados.forEach((r, i) => {
    if (r.puesto !== i + 1 && !incompletos.length) {
      const mismos = presentados.filter((o) => o.puesto === r.puesto).map((o) => o.nombre)
      const txt = `Empate en el puesto ${r.puesto}: ${mismos.join(' y ')}. Ajusta el promedio final en /admin para desempatar.`
      if (!errores.includes(txt)) errores.push(txt)
    }
  })

  // Huella: SHA-256 de las notas de la categoría (misma fórmula para todas las actas)
  const canon = notas.map((k) => [k.concursante_id, k.jurado_id, ...CRITERIOS.map((c) => k[c.campo]), k.total].join('|')).sort().join('\n')
  const huella = await sha256(canon)
  return { cat, nota, turno, fijos, nsp, presentados, ausentes, errores, huella }
}

// ─── Piezas comunes de la ventana ───────────────────────────────────────────

/** Texto corregible a mano. Si `eco`, es una copia que se actualiza sola (no editable). */
const campo = (clave, texto, { eco = false, placeholder = '' } = {}) =>
  `<span class="${eco ? '' : 'ed'}" ${eco ? '' : 'data-ed'} data-campo="${esc(clave)}"${placeholder ? ` data-placeholder="${esc(placeholder)}"` : ''}>${esc(texto)}</span>`

const barra = (titulo) => `
  <div class="barra">
    <div class="barra-txt"><b>${esc(titulo)}</b>
      <span>Los textos con borde punteado se pueden corregir haciendo clic; los cambios quedan guardados en este navegador.</span>
      <span>Al imprimir: destino «Guardar como PDF», desactiva «Encabezados y pies de página» y activa «Gráficos de fondo».</span></div>
    <button id="btn-restaurar" type="button">Restaurar textos</button>
    <button id="btn-imprimir" type="button" class="prim">Guardar PDF / Imprimir</button>
  </div>`

const CSS_VENTANA = `
  .ed { outline: 1.5px dashed #0e6c76; outline-offset: 1px; background: rgba(14,108,118,.07); border-radius: 2px; cursor: text; }
  .ed:focus { outline-style: solid; background: rgba(14,108,118,.12); }
  .ed:empty::before { content: attr(data-placeholder); color: #8a8580; font-style: italic; }
  .barra { position: fixed; inset: 0 0 auto 0; z-index: 10; display: flex; align-items: center; gap: 12px; padding: 10px 20px;
           background: #12343b; color: #fff; font: 13px/1.4 'Plus Jakarta Sans', system-ui, sans-serif; }
  .barra-txt { flex: 1; display: flex; flex-direction: column; } .barra-txt b { font-size: 15px; }
  .barra-txt span { color: #b9c9cb; font-size: 12px; }
  .barra button { font: 700 14px 'Plus Jakarta Sans', system-ui, sans-serif; padding: 10px 16px; border-radius: 3px; cursor: pointer;
                  border: 1.5px solid #fff; background: transparent; color: #fff; }
  .barra button.prim { background: #e0b440; border-color: #e0b440; color: #12343b; }
  @media screen { body { background: #dcd7cc !important; padding: 96px 0 40px !important; } }
  @media print { .barra { display: none !important; } .ed { outline: none !important; background: none !important; }
                 .ed:empty::before { content: none; } [data-opcional].vacio { display: none !important; } }`

/**
 * Se inyecta en la ventana (no depende de /admin): carga los textos guardados,
 * los guarda al editar, sincroniza copias del mismo campo e imprime.
 */
function scriptVentana(cfg) {
  const leer = (k) => { try { return localStorage.getItem(cfg.prefijo + k) } catch { return null } }
  const guardar = (k, v) => {
    try { if (v == null) localStorage.removeItem(cfg.prefijo + k); else localStorage.setItem(cfg.prefijo + k, v) } catch { /* sin almacenamiento */ }
  }
  const campos = () => Array.from(document.querySelectorAll('[data-campo]'))
  const marcar = (el) => { const o = el.closest('[data-opcional]'); if (o) o.classList.toggle('vacio', !el.textContent.trim()) }
  const pie = () => {
    const estilo = document.getElementById('pie')
    if (!cfg.pie || !estilo) return
    const num = document.querySelector('[data-campo="numero"]')
    const t = (cfg.pie.antes + (num ? num.textContent.trim() : '') + cfg.pie.despues).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    estilo.textContent = '@page { @bottom-left { content: "' + t + '"; ' + cfg.pie.estilo + ' } ' +
      '@bottom-right { content: "Página " counter(page) " de " counter(pages); white-space: nowrap; ' + cfg.pie.estilo + ' } }'
  }
  for (const el of campos()) {
    el.dataset.original = el.textContent
    const v = leer(el.dataset.campo)
    if (v != null) el.textContent = v
    marcar(el)
  }
  for (const el of document.querySelectorAll('[data-ed]')) {
    try { el.contentEditable = 'plaintext-only' } catch { el.contentEditable = 'true' }
    el.spellcheck = false
  }
  pie()
  document.addEventListener('input', (e) => {
    const el = e.target.closest && e.target.closest('[data-campo]')
    if (!el) return
    const v = el.textContent
    for (const o of campos()) if (o !== el && o.dataset.campo === el.dataset.campo) { o.textContent = v; marcar(o) }
    marcar(el)
    guardar(el.dataset.campo, v === el.dataset.original ? null : v)
    pie()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.closest && e.target.closest('[data-ed]')) { e.preventDefault(); e.target.blur() }
  })
  document.getElementById('btn-restaurar').addEventListener('click', () => {
    if (!confirm('¿Volver a los textos originales? Se pierden las correcciones hechas a mano en este documento.')) return
    for (const el of campos()) { el.textContent = el.dataset.original; marcar(el); guardar(el.dataset.campo, null) }
    pie()
  })
  document.getElementById('btn-imprimir').addEventListener('click', async () => {
    if (document.activeElement) document.activeElement.blur()
    await document.fonts.ready
    await Promise.all(Array.from(document.images).map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r }))))
    window.print()
  })
}

const inyectar = (cfg) => `<script>(${scriptVentana.toString()})(${JSON.stringify(cfg).replace(/</g, '\\u003c')})</script>`
const nombreArchivo = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_')

// ─── ACTA ────────────────────────────────────────────────────────────────────

export function construirActa(datos, an, recursos) {
  const { cat, filas, jurados, generado } = datos
  const { nota, turno, fijos, nsp, presentados, ausentes, huella } = an
  const nombreBase = (r) => NOMBRE_ACTA[r.nombre] ?? r.nombre
  const nom = (r, eco = true) => campo(`nombre:${r.concursante_id}`, nombreBase(r), { eco })
  const numero = NUMERO_ACTA[cat.id] ?? `00${cat.orden}-2026-CND/${cat.id.toUpperCase()}`
  const cuando = generado.toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'long', timeStyle: 'short' })

  // Constancias: no presentados, turnos asignados (si no hay texto propio) y las de la organización
  const porId = new Map(filas.map((r) => [r.concursante_id, r]))
  const constancias = [
    ...ausentes.map((r) => [`nsp:${r.concursante_id}`,
      `${nombreBase(r)}${turno.has(r.concursante_id) ? ` (turno ${turno.get(r.concursante_id)})` : ''} no se presentó al ser llamado en su turno; por ello figura como «No se presentó» y no participa en el orden de mérito.`]),
    ...(CONSTANCIAS[cat.id]
      ? CONSTANCIAS[cat.id].map((t, i) => [`conf:${i}`, t])
      : fijos.filter((t) => porId.has(t.concursante_id)).sort((a, b) => a.turno - b.turno).map((t) => [`fijo:${t.concursante_id}`,
        `Por decisión de la organización, ${nombreBase(porId.get(t.concursante_id))} se presentó en el turno ${t.turno}, asignado sin sorteo.`])),
  ]
  const constancia = ([clave, texto], extra = false) => `
    <p data-opcional><b>Constancia:</b> ${campo(clave, texto, { placeholder: extra ? 'Otra constancia (opcional; si queda vacía no se imprime)' : '' })}</p>`

  const firma = (n, cargo) => `
    <div class="firma"><div class="espacio"></div><div class="linea"></div>
      <b>${esc(n)}</b><span>DNI: ______________________</span><span class="cargo">${esc(cargo)}</span></div>`
  const encabezado = (sub) => `
    <header class="enc"><img src="${recursos.escudo}" alt="">
      <div><b>Academia Lobitos</b><span>Centro Cultural</span></div>
      <div class="num">Acta N.° ${campo('numero', numero, { eco: sub !== FECHA })}<br><span>${esc(sub)}</span></div>
    </header>`
  const filaRes = (r, ausente) => `
    <tr${!ausente && r.puesto <= 5 ? ' class="dest"' : ''}${ausente ? ' class="nsp"' : ''}>
      <td class="c"><b>${ausente ? 'NSP' : `${r.puesto}.°`}</b></td><td><b>${nom(r, false)}</b></td>
      <td class="inst">${inst(r.institucion)}</td>
      ${ausente
        ? `<td class="c" colspan="${jurados.length + 1}"><i>No se presentó</i></td>`
        : `${jurados.map((j) => `<td class="c num">${n2(nota(j, r.concursante_id).total)}</td>`).join('')}<td class="c num prom">${n2(r.promedio)}</td>`}
    </tr>`

  const acta = `
  <section class="pag">
    ${encabezado(FECHA)}
    <h1>Acta de calificación y conformidad de resultados</h1>
    <p class="sub">II Concurso Nacional de Declamación «Campeón de Campeones»<br>
      Categoría <b>${esc(cat.nombre)}</b>${cat.descripcion ? ` (${esc(cat.descripcion)})` : ''}</p>
    <p>En la ciudad de Concepción, siendo las ${campo('hora', '________')} horas del día sábado 14 de noviembre de 2026, en el
    Auditorio de la Municipalidad Provincial de Concepción, se reunieron los miembros del Jurado Calificador del
    II Concurso Nacional de Declamación «Campeón de Campeones», organizado por la Academia Lobitos – Centro
    Cultural, integrado por:</p>
    <ol class="jur">${jurados.map((j) => `<li>${esc(j.nombre)}</li>`).join('')}</ol>
    <p>Habiéndose presentado ${ausentes.length
      ? `${enLetras(presentados.length)} de los ${enLetras(filas.length)} concursantes inscritos`
      : `los ${enLetras(presentados.length)} concursantes`} de la categoría ${esc(cat.nombre)},
    cada miembro del jurado calificó de manera individual e independiente conforme a la rúbrica oficial del concurso,
    compuesta por siete criterios con un puntaje máximo de cien (100) puntos:
    ${CRITERIOS.map((c) => `${c.nombre} (${c.max})`).join('; ')}.
    El puntaje final de cada concursante es el promedio aritmético de las tres calificaciones. En caso de empate
    prevalece el mayor promedio en el criterio «Interpretación y dominio del mensaje».</p>
    <p>Las calificaciones registradas en el sistema oficial del concurso son las siguientes:</p>
    <table class="res">
      <thead><tr><th>Puesto</th><th class="izq">Concursante</th><th class="izq">Institución educativa</th>
        ${jurados.map((j) => `<th>Jurado<br>${esc(apellidoJurado(j.nombre))}</th>`).join('')}<th>Promedio</th></tr></thead>
      <tbody>${presentados.map((r) => filaRes(r, false)).join('')}${ausentes.map((r) => filaRes(r, true)).join('')}</tbody>
    </table>
    ${ausentes.length ? '<p class="ley">NSP = No se presentó.</p>' : ''}
    <p>En consecuencia, el Jurado Calificador declara los siguientes resultados de la categoría ${esc(cat.nombre)}:</p>
    <table class="gan">${presentados.filter((r) => r.puesto <= 5).map((r) => `
      <tr><td>${LUGAR[r.puesto]}</td><td><b>${nom(r)}</b></td><td class="num">${n2(r.promedio)} puntos</td></tr>`).join('')}
    </table>
    ${constancias.map((c) => constancia(c)).join('')}
    ${constancia(['extra:1', ''], true)}${constancia(['extra:2', ''], true)}
    <p class="obs-t">Observaciones:</p>
    <div class="obs"></div><div class="obs"></div>
    <p>Los miembros del Jurado Calificador declaran su conformidad con las calificaciones y los resultados
    consignados en la presente acta y en su anexo, que forma parte integrante de ella, y la suscriben en señal de conformidad.</p>
    <div class="firmas">${jurados.map((j) => firma(j.nombre, 'Jurado calificador')).join('')}</div>
    <div class="firmas una">${firma(PROMOTOR, 'Promotor · Academia Lobitos (Visto bueno)')}</div>
  </section>`

  const ordenTurno = [...filas].sort((a, b) => (turno.get(a.concursante_id) ?? 9999) - (turno.get(b.concursante_id) ?? 9999))
  const anexos = jurados.map((j, i) => `
  <section class="pag">
    ${encabezado(`Anexo ${i + 1} de ${jurados.length}`)}
    <h2>Anexo — Calificación detallada por criterio</h2>
    <p class="sub">Categoría <b>${esc(cat.nombre)}</b> · Jurado: <b>${esc(j.nombre)}</b></p>
    <table class="det">
      <thead><tr><th>Turno</th><th class="izq">Concursante</th>
        ${CRITERIOS.map((c) => `<th>${CORTO[c.campo]}<br><span>/${c.max}</span></th>`).join('')}<th>Total<br><span>/100</span></th></tr></thead>
      <tbody>${ordenTurno.map((r) => {
        const k = nota(j, r.concursante_id)
        return nsp(r)
          ? `<tr class="nsp"><td class="c">${turno.get(r.concursante_id) ?? '—'}</td><td>${nom(r)}</td>
              <td class="c" colspan="${CRITERIOS.length + 1}"><i>No se presentó</i></td></tr>`
          : `<tr><td class="c">${turno.get(r.concursante_id) ?? '—'}</td><td>${nom(r)}</td>
              ${CRITERIOS.map((c) => `<td class="c num">${Number(k[c.campo])}</td>`).join('')}
              <td class="c num prom">${n2(k.total)}</td></tr>`
      }).join('')}</tbody>
    </table>
    <p class="ley">${CRITERIOS.map((c) => `<b>${CORTO[c.campo]}</b> = ${c.nombre} (${c.max} pts)`).join(' · ')}.</p>
    <p>Declaro que las calificaciones consignadas en este anexo corresponden a mi evaluación individual de cada concursante.</p>
    <div class="firmas una">${firma(j.nombre, 'Jurado calificador')}</div>
  </section>`).join('')

  const compacta = filas.length > 13 // categorías grandes: tabla más apretada para que entre en la página 1
  const pieEstilo = 'font-family: sans-serif; font-size: 6.6pt; color: #8a8580; vertical-align: top; padding-top: 5mm;'
  const pie = { antes: 'Acta N.° ', despues: ` · ${cat.nombre} · Generada el ${cuando} · Huella: ${huella.slice(0, 16)}`, estilo: pieEstilo }
  const titulo = `Acta_Calificacion_${nombreArchivo(cat.nombre)}`

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 15mm 17mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Plus Jakarta Sans', sans-serif; color: #12343b; font-size: 9.4pt; line-height: 1.45; margin: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pag { break-after: page; } .pag:last-child { break-after: auto; }
  @media screen { .pag { width: 210mm; min-height: 297mm; margin: 0 auto 10mm; padding: 15mm 17mm 18mm; background: #fff; box-shadow: 0 2px 14px rgba(0,0,0,.18); } }
  .enc { display: flex; align-items: center; gap: 10px; border-bottom: 2.5px solid #12343b; padding-bottom: 8px; margin-bottom: 12px; }
  .enc img { height: 46px; }
  .enc b { display: block; font-size: 13pt; } .enc span { font-size: 7.5pt; letter-spacing: .18em; text-transform: uppercase; color: #0e6c76; }
  .enc .num { margin-left: auto; text-align: right; font-size: 8.5pt; font-weight: 700; }
  .enc .num span { font-weight: 500; letter-spacing: 0; text-transform: none; color: #5c6b6d; }
  .enc .num span[data-campo] { font-size: inherit; font-weight: 700; color: inherit; letter-spacing: 0; text-transform: none; }
  h1 { font-size: 15pt; text-transform: uppercase; letter-spacing: .04em; text-align: center; margin: 4px 0 2px; }
  h2 { font-size: 13pt; text-align: center; margin: 4px 0 2px; }
  .sub { text-align: center; margin: 0 0 10px; color: #3c4b4d; }
  p { margin: 6px 0; text-align: justify; }
  ol.jur { margin: 2px 0 6px 18px; padding: 0; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 8px; }
  th { font-size: 7.4pt; text-transform: uppercase; letter-spacing: .06em; background: #12343b; color: #fff; padding: 5px 4px; font-weight: 700; line-height: 1.25; }
  th span { font-weight: 500; opacity: .8; }
  td { border-bottom: 1px solid #d9d4c9; padding: 4px; vertical-align: middle; }
  .izq { text-align: left; } .c { text-align: center; }
  .num { font-variant-numeric: tabular-nums; }
  .prom { font-weight: 800; }
  .inst { font-size: 7.6pt; color: #5c6b6d; }
  tr.dest td { background: #fbf6e6; }
  tr.nsp td { color: #8a8580; }
  table.res { break-inside: avoid; }
  table.res td, table.det td { font-size: ${compacta ? '8.1pt' : '8.4pt'}; }
  table.res td { padding: ${compacta ? '2px 4px' : '2.5px 4px'}; line-height: 1.22; }
  table.res .inst { font-size: 7pt; }
  table.det td { padding: ${compacta ? '3px 4px' : '4px'}; }
  table.gan { width: auto; margin: 4px 0 8px 12px; }
  table.gan td { border: none; padding: 1px 14px 1px 0; }
  .obs-t { margin-top: 8px; font-weight: 700; }
  .obs { border-bottom: 1px solid #9aa5a8; height: 18px; }
  .firmas { display: flex; justify-content: space-between; gap: 14px; margin-top: 6px; break-inside: avoid; }
  .firmas.una { justify-content: center; margin-top: 2px; }
  .firma { flex: 0 0 31%; display: flex; flex-direction: column; align-items: center; text-align: center; font-size: 8pt; }
  .firmas.una .firma { flex-basis: 45%; }
  .firma .espacio { height: 46px; }
  .firma .linea { width: 100%; border-top: 1px solid #12343b; margin-bottom: 4px; }
  .firma b { font-size: 8.4pt; }
  .firma .cargo { color: #5c6b6d; font-size: 7.4pt; letter-spacing: .06em; text-transform: uppercase; }
  .ley { font-size: 7.6pt; color: #5c6b6d; }
  ${CSS_VENTANA}
</style>
<style id="pie"></style></head><body>
${barra(`Acta · ${cat.nombre}`)}
${acta}${anexos}
${inyectar({ prefijo: `${CLAVE}${cat.id}:acta:`, pie })}
</body></html>`
}

// ─── DIPLOMAS ────────────────────────────────────────────────────────────────

export function construirDiplomas(datos, an, recursos) {
  const { cat } = datos
  const ganadores = an.presentados.filter((r) => r.puesto <= 5)
  const pagina = (g) => {
    const p = PUESTO[g.puesto]
    const poema = tituloPoema(g.nombre, g.poema)
    return `
    <section class="hoja">
      <img class="fondo" src="${recursos.plantilla}" alt="">
      <img class="escudo" src="${recursos.escudo}" alt="Academia Lobitos">
      <div class="cuerpo">
        <p class="inst">Academia Lobitos · Centro Cultural</p>
        <p class="concurso">II Concurso Nacional de Declamación</p>
        <p class="lema">«Campeón de Campeones»</p>
        <h1>${p.titulo ?? 'Diploma de Honor'}</h1>
        <p class="otorgado">${p.titulo ? 'Otorgada a' : 'Otorgado a'}</p>
        <p class="nombre">${campo(`nombre:${g.concursante_id}`, nombreDiploma(g.nombre), { placeholder: 'Nombres y apellidos' })}</p>
        <div class="filete"><span></span><i style="background:${p.color}"></i><span></span></div>
        <p class="motivo">por haber obtenido el <b style="color:${p.color}">${p.texto}</b> en la categoría
          <b>${esc(cat.nombre)}</b>${cat.descripcion ? ` (${esc(cat.descripcion)})` : ''},</p>
        <p class="poema" data-opcional>${campo(`poema:${g.concursante_id}`, poema ? `declamando el poema «${poema}»` : '',
          { placeholder: 'declamando el poema «…» (opcional; si queda vacío no se imprime)' })}</p>
        <p class="fecha">${FECHA}</p>
      </div>
      <div class="firma">
        <span class="linea"></span>
        <div class="orn"><span></span><i></i><span></span></div>
        <b>${PROMOTOR}</b>
        <span class="rol">Promotor · Academia Lobitos</span>
      </div>
    </section>`
  }
  const titulo = `Diplomas_${nombreArchivo(cat.nombre)}`

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,500;1,600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: 297mm 210mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .hoja { position: relative; width: 297mm; height: 210mm; overflow: hidden; break-after: page; color: #12343b; font-family: 'Plus Jakarta Sans', sans-serif; background: #fff; }
  .hoja:last-child { break-after: auto; }
  @media screen { .hoja { margin: 0 auto 10mm; box-shadow: 0 2px 14px rgba(0,0,0,.18); } }
  .fondo { position: absolute; inset: 0; width: 100%; height: 100%; }
  /* Escudo dentro del círculo superior (centro en 50% / 16.1%) */
  .escudo { position: absolute; left: 50%; top: 16.1%; height: 12.6%; transform: translate(-50%, -50%); }
  .cuerpo { position: absolute; left: 14%; right: 14%; top: 26.6%; height: 51%; display: flex; flex-direction: column; align-items: center; text-align: center; }
  .inst { font-size: 7.6pt; font-weight: 700; letter-spacing: .34em; text-transform: uppercase; color: #0e6c76; }
  .concurso { margin-top: 2.6mm; font-size: 11pt; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
  .lema { margin-top: .6mm; font-family: 'Playfair Display', serif; font-style: italic; font-weight: 600; font-size: 13.5pt; color: #a87b12; }
  h1 { margin-top: 4.2mm; font-family: 'Playfair Display', serif; font-weight: 700; font-size: 33pt; letter-spacing: .02em; line-height: 1; }
  .otorgado { margin-top: 4.4mm; font-family: 'Playfair Display', serif; font-style: italic; font-size: 12pt; color: #5c6b6d; }
  .nombre { margin-top: 1.6mm; font-family: 'Playfair Display', serif; font-weight: 700; font-size: 29pt; line-height: 1.1; }
  .filete { margin-top: 3mm; display: flex; align-items: center; gap: 2.4mm; width: 92mm; }
  .filete span { flex: 1; height: .35mm; background: #c9a13b; }
  .filete i { width: 2.6mm; height: 2.6mm; transform: rotate(45deg); }
  .motivo { margin-top: 4mm; font-size: 11.5pt; line-height: 1.55; max-width: 175mm; }
  .motivo b { font-weight: 800; }
  .poema { margin-top: 1.4mm; font-family: 'Playfair Display', serif; font-style: italic; font-size: 13pt; line-height: 1.35; max-width: 190mm; }
  .fecha { margin-top: 7mm; font-size: 9.5pt; color: #5c6b6d; letter-spacing: .02em; }
  /* Firma única, centrada (mismo estilo que las líneas de la plantilla) */
  .firma { position: absolute; left: 50%; top: 79.6%; width: 90mm; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; text-align: center; }
  .firma .linea { width: 78mm; height: .55mm; background: #12343b; }
  .firma .orn { margin-top: 2mm; display: flex; align-items: center; gap: 1.8mm; width: 44mm; }
  .firma .orn span { flex: 1; height: .3mm; background: #c9a13b; }
  .firma .orn i { width: 2mm; height: 2mm; background: #c9a13b; transform: rotate(45deg); }
  .firma b { margin-top: 2.2mm; font-size: 10pt; font-weight: 700; }
  .firma .rol { margin-top: .6mm; font-size: 7.2pt; letter-spacing: .16em; text-transform: uppercase; color: #5c6b6d; }
  ${CSS_VENTANA}
</style></head><body>
${barra(`Diplomas · ${cat.nombre} · ${ganadores.length} diploma(s)`)}
${ganadores.map(pagina).join('')}
${inyectar({ prefijo: `${CLAVE}${cat.id}:diplomas:` })}
</body></html>`
}

// ─── Ventana ─────────────────────────────────────────────────────────────────

const claveActa = (catId) => `${CLAVE}${catId}:acta-huella`
const leerLS = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const memoria = new Map() // respaldo si el navegador no permite localStorage

/** ¿Ya se generó el acta de esta categoría en este navegador? (los diplomas van después) */
export const actaGenerada = (catId) => Boolean(leerLS(claveActa(catId)) ?? memoria.get(catId))

const paginaAviso = (titulo, mensajes) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title></head>
<body style="font:15px/1.5 system-ui,sans-serif;color:#12343b;background:#f6f3ec;max-width:640px;margin:60px auto;padding:0 20px">
<h1 style="font-size:22px">${esc(titulo)}</h1>${mensajes.map((m) => `<p>${esc(m)}</p>`).join('')}
<p><button onclick="window.close()" style="font:inherit;font-weight:700;padding:8px 14px;cursor:pointer">Cerrar</button></p></body></html>`

const escribir = (w, html) => { w.document.open(); w.document.write(html); w.document.close() }

/**
 * Abre el acta o los diplomas de una categoría en una ventana nueva.
 * Debe llamarse directamente desde el clic (si no, el navegador bloquea la ventana).
 */
export async function abrirDocumento(tipo, supabase, catId, recursos) {
  const w = window.open('', '_blank')
  if (!w) throw new Error('El navegador bloqueó la ventana nueva. Permite ventanas emergentes para este sitio y vuelve a intentar.')
  escribir(w, paginaAviso('Preparando…', ['Leyendo las calificaciones de la base de datos.']))
  try {
    const datos = await cargarDatos(supabase, catId)
    const an = await analizar(datos)
    const nombre = tipo === 'acta' ? 'el acta' : 'los diplomas'
    if (an.errores.length) {
      escribir(w, paginaAviso(`Todavía no se puede generar ${nombre} de ${datos.cat.nombre}`, an.errores))
      return false
    }
    if (tipo === 'acta') {
      escribir(w, construirActa(datos, an, recursos))
      try { localStorage.setItem(claveActa(catId), an.huella) } catch { memoria.set(catId, an.huella) }
      return true
    }
    const huellaActa = leerLS(claveActa(catId)) ?? memoria.get(catId)
    if (huellaActa !== an.huella) {
      escribir(w, paginaAviso(`Primero genera el acta de ${datos.cat.nombre}`, [huellaActa
        ? 'Las calificaciones cambiaron desde que se generó el acta. Genera el acta otra vez, revísala y después los diplomas.'
        : 'Los diplomas se generan después del acta, para que coincidan con los resultados que firman los jurados.']))
      return false
    }
    escribir(w, construirDiplomas(datos, an, recursos))
    return true
  } catch (e) {
    escribir(w, paginaAviso('No se pudo generar el documento', [String(e?.message ?? e)]))
    return false
  }
}
