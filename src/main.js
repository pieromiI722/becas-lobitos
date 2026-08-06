import './style.css'
import { fetchResultado } from './sheets.js'
import { renderLoading, renderNotFound, renderError, renderResultado, clearResult } from './ui.js'

const form      = document.getElementById('search-form')
const input     = document.getElementById('search-input')
const btn       = document.getElementById('search-btn')
const result    = document.getElementById('result')
const inputWrap = document.getElementById('input-wrap')

// ─── ESTADO ──────────────────────────────────────────────────────────────────

let isLoading = false

// ─── UTILIDADES ──────────────────────────────────────────────────────────────

function setLoading(v) {
  isLoading = v
  btn.disabled = v
  input.disabled = v

  if (v) {
    btn.innerHTML = `<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>`
  } else {
    btn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/>
    </svg>`
  }
}

function setInputError(msg) {
  input.classList.add('ring-2', 'ring-rose-400', 'border-rose-400')
  const prev = inputWrap.querySelector('.input-error-msg')
  if (prev) prev.remove()
  const span = document.createElement('p')
  span.className = 'input-error-msg text-xs text-rose-500 mt-1 ml-1'
  span.textContent = msg
  inputWrap.appendChild(span)
}

function clearInputError() {
  input.classList.remove('ring-2', 'ring-rose-400', 'border-rose-400')
  inputWrap.querySelector('.input-error-msg')?.remove()
}

// ─── BÚSQUEDA ────────────────────────────────────────────────────────────────

async function buscar(valor) {
  clearInputError()

  const limpio = valor.trim()
  if (!limpio) {
    setInputError('Ingresá tu código o DNI para consultar.')
    input.focus()
    return
  }

  setLoading(true)
  renderLoading(result)

  try {
    const dato = await fetchResultado(limpio)

    if (!dato) {
      renderNotFound(result)
    } else {
      renderResultado(result, dato)
      result.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  } catch (err) {
    console.error(err)
    renderError(result, err.message)
  } finally {
    setLoading(false)
  }
}

// ─── EVENTOS ─────────────────────────────────────────────────────────────────

form.addEventListener('submit', (e) => {
  e.preventDefault()
  if (!isLoading) buscar(input.value)
})

input.addEventListener('input', () => {
  clearInputError()
  if (!input.value.trim()) clearResult(result)
})
