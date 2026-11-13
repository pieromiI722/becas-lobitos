export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export const $  = (sel, root = document) => root.querySelector(sel)
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]

export const fmt = (n, dec = 2) =>
  n == null ? '—' : Number(n).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: dec })

export const norm = (s) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

let toastTimer
export function toast(msg, tipo = 'ok') {
  let el = document.querySelector('#lob-toast')
  if (!el) {
    el = document.createElement('div')
    el.id = 'lob-toast'
    el.setAttribute('role', 'status')
    el.className = 'fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-sm px-5 py-3 font-sans text-sm font-semibold shadow-lg transition-opacity'
    document.body.appendChild(el)
  }
  el.textContent = msg
  el.classList.remove('bg-teal', 'bg-brick', 'text-paper', 'opacity-0')
  el.classList.add(tipo === 'error' ? 'bg-brick' : 'bg-teal', 'text-paper')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.add('opacity-0'), 2600)
}
