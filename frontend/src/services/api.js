// Servicio centralizado para las llamadas a la API del backend
const BASE = import.meta.env.VITE_API_URL || '';
let csrfToken = null

async function obtenerCsrfToken(forzar = false) {
  if (csrfToken && !forzar) return csrfToken
  const res = await fetch(BASE + '/api/auth/csrf-token', { credentials: 'include' })
  if (!res.ok) throw new Error('No fue posible preparar la protección CSRF')
  // Se conserva en memoria, no en localStorage, para reducir su exposicion
  // y mantenerlo asociado a la cookie de sesion actual.
  csrfToken = (await res.json()).csrfToken
  return csrfToken
}

async function opcionesMutacion(forzarCsrf = false) {
  // Todas las operaciones que cambian datos incluyen el token exigido por
  // el middleware CSRF del backend.
  return {
    'Content-Type': 'application/json',
    'X-CSRF-Token': await obtenerCsrfToken(forzarCsrf)
  }
}

export const api = {
  async get(path) {
    const res = await fetch(BASE + path, { credentials: 'include' })
    if (!res.ok) throw { status: res.status, data: await res.json().catch(() => ({})) }
    return res.json()
  },
  async post(path, body) {
    let res = await fetch(BASE + path, {
      method: 'POST',
      headers: await opcionesMutacion(),
      body: JSON.stringify(body),
      credentials: 'include'
    })
    // Una sesión puede expirar o cambiar después de cargar la página. En ese
    // caso se descarta el token antiguo y se reintenta una sola vez con el
    // token asociado a la sesión actual.
    if (res.status === 403) {
      csrfToken = null
      res = await fetch(BASE + path, {
        method: 'POST',
        headers: await opcionesMutacion(true),
        body: JSON.stringify(body),
        credentials: 'include'
      })
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw { status: res.status, data }
    return data
  },
  async put(path, body) {
    const res = await fetch(BASE + path, {
      method: 'PUT',
      headers: await opcionesMutacion(),
      body: JSON.stringify(body),
      credentials: 'include'
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw { status: res.status, data }
    return data
  },
  async patch(path, body) {
    const res = await fetch(BASE + path, {
      method: 'PATCH',
      headers: await opcionesMutacion(),
      body: JSON.stringify(body),
      credentials: 'include'
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw { status: res.status, data }
    return data
  },
  async delete(path) {
    const res = await fetch(BASE + path, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': await obtenerCsrfToken() },
      credentials: 'include'
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw { status: res.status, data }
    return data
  },
}

export function formatearFecha(fechaStr) {
  const fecha = new Date(fechaStr)
  return fecha.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase()
}