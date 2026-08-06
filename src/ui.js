import { ESTADO } from './config.js'

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function estadoBadge(estado) {
  const norm = String(estado).trim().toLowerCase()

  if (norm === ESTADO.APROBADO.toLowerCase()) {
    return `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-emerald-100 text-emerald-800">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
              Aprobado
            </span>`
  }

  if (norm === ESTADO.NO_APROBADO.toLowerCase()) {
    return `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-rose-100 text-rose-800">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
              </svg>
              No aprobado
            </span>`
  }

  return `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-amber-100 text-amber-800">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 102 0V6zm-1 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
            </svg>
            Pendiente
          </span>`
}

function puntajeColor(puntaje, estado) {
  if (String(estado).toLowerCase().includes('aprobado') && !String(estado).toLowerCase().includes('no'))
    return 'text-emerald-700'
  if (String(estado).toLowerCase().includes('no aprobado'))
    return 'text-rose-600'
  return 'text-slate-700'
}

// ─── RENDERIZADORES ──────────────────────────────────────────────────────────

export function renderLoading(container) {
  container.innerHTML = `
    <div class="flex flex-col items-center gap-3 py-10 text-slate-500">
      <svg class="w-8 h-8 animate-spin text-sky-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      <p class="text-sm font-medium">Consultando resultados…</p>
    </div>`
}

export function renderNotFound(container) {
  container.innerHTML = `
    <div class="flex flex-col items-center gap-4 py-8 text-slate-600">
      <div class="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
        <svg class="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.774 4.774zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <div class="text-center">
        <p class="font-semibold text-slate-700">No se encontró el postulante</p>
        <p class="text-sm text-slate-500 mt-1">Verificá el código o DNI ingresado e intentá nuevamente.</p>
      </div>
    </div>`
}

export function renderError(container, mensaje) {
  container.innerHTML = `
    <div class="flex flex-col items-center gap-4 py-8">
      <div class="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center">
        <svg class="w-7 h-7 text-rose-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
        </svg>
      </div>
      <div class="text-center">
        <p class="font-semibold text-rose-700">Error al consultar</p>
        <p class="text-sm text-slate-500 mt-1">${mensaje ?? 'No se pudo conectar con la base de datos.'}</p>
      </div>
    </div>`
}

export function renderResultado(container, dato) {
  const colorPuntaje = puntajeColor(dato.puntaje, dato.estado)
  const puntajeVal   = dato.puntaje != null ? String(dato.puntaje) : '—'

  const extraRows = [
    dato.carrera ? `<div class="flex justify-between items-center py-3 border-b border-slate-100">
                      <span class="text-sm text-slate-500">Carrera / Nivel</span>
                      <span class="text-sm font-medium text-slate-700">${dato.carrera}</span>
                    </div>` : '',
    dato.obs     ? `<div class="flex justify-between items-start py-3">
                      <span class="text-sm text-slate-500">Observaciones</span>
                      <span class="text-sm font-medium text-slate-700 text-right max-w-[60%]">${dato.obs}</span>
                    </div>` : '',
  ].join('')

  container.innerHTML = `
    <div class="space-y-4">
      <!-- Encabezado del resultado -->
      <div class="bg-slate-50 rounded-xl p-5 border border-slate-200">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p class="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Postulante</p>
            <p class="text-xl font-bold text-slate-800 leading-tight">${dato.nombre || '—'}</p>
            <p class="text-sm text-slate-500 mt-0.5">Código: <span class="font-mono font-semibold text-slate-700">${dato.codigo}</span></p>
          </div>
          <div class="mt-1">
            ${estadoBadge(dato.estado)}
          </div>
        </div>
      </div>

      <!-- Puntaje destacado -->
      <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div class="p-5 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-400 uppercase tracking-wide">Puntaje obtenido</p>
            <p class="text-4xl font-extrabold mt-1 ${colorPuntaje}">${puntajeVal}</p>
          </div>
          <div class="w-16 h-16 rounded-full bg-slate-50 border-2 border-slate-200 flex items-center justify-center">
            <svg class="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/>
            </svg>
          </div>
        </div>

        <!-- Datos adicionales -->
        ${(extraRows || dato.carrera || dato.obs) ? `<div class="border-t border-slate-100 px-5">${extraRows}</div>` : ''}
      </div>
    </div>`
}

export function clearResult(container) {
  container.innerHTML = ''
}
