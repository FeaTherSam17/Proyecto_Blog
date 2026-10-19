// Servicio centralizado para las llamadas a la API del backend
const BASE = import.meta.env.VITE_API_URL || '';

export const api = {
  async get(path) {
    const res = await fetch(BASE + path, { credentials: 'include' })
    if (!res.ok) throw { status: res.status, data: await res.json().catch(() => ({})) }
    return res.json()
  },
  async post(path, body) {
    const res = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include'
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw { status: res.status, data }
    return data
  },
  async put(path, body) {
    const res = await fetch(BASE + path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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