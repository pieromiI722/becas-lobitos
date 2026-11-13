export const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Lluvia de confeti dentro de `contenedor` (debe tener position relative y overflow hidden).
 * @param {HTMLElement} contenedor
 * @param {{ cantidad?: number, retraso?: number }} opts  retraso en segundos antes de empezar
 */
export function confeti(contenedor, { cantidad = 70, retraso = 0 } = {}) {
  if (!contenedor || reducido) return
  const colores = ['#f7c548', '#fbf8f1', '#0e6c76', '#cfe0e2', '#e0ae2f']
  const frag = document.createDocumentFragment()
  const piezas = []
  for (let i = 0; i < cantidad; i++) {
    const s = document.createElement('span')
    s.className = 'lob-confeti'
    s.style.left = `${Math.random() * 100}%`
    s.style.background = colores[i % colores.length]
    s.style.animationDelay = `${retraso + Math.random() * 0.9}s`
    s.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`)
    s.style.setProperty('--rot', `${(Math.random() - 0.5) * 900}deg`)
    if (i % 3 === 0) { s.style.width = '6px'; s.style.height = '6px'; s.style.borderRadius = '50%' }
    frag.appendChild(s)
    piezas.push(s)
  }
  contenedor.appendChild(frag)
  setTimeout(() => piezas.forEach((s) => s.remove()), (retraso + 4.5) * 1000)
}
