<template>
  <div class="d-flex align-items-center justify-content-center" style="min-height: 100vh; background-color: var(--cream-bg);">
    <div class="login-card text-center" style="max-width: 520px; padding: 3rem 2rem;">
      <h2 class="section-title mb-4">VERIFICACIÓN DE CORREO</h2>
      <p :class="error ? 'text-danger' : 'text-secondary'">{{ mensaje }}</p>
      <RouterLink to="/login" class="btn-editorial d-inline-block mt-3" style="padding: 1rem 2rem;">
        IR AL ACCESO
      </RouterLink>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, RouterLink } from 'vue-router'

const route = useRoute()
const mensaje = ref('Verificando tu correo...')
const error = ref(false)
const BASE = import.meta.env.VITE_API_URL || ''

onMounted(async () => {
  // El token solo se toma de la URL para enviarlo al backend; el frontend no
  // decide si es valido, si expiro o si ya fue utilizado.
  const token = typeof route.query.token === 'string' ? route.query.token : ''
  if (!token) {
    error.value = true
    mensaje.value = 'El enlace de verificación no es válido.'
    return
  }

  try {
    const response = await fetch(`${BASE}/api/auth/verificar-correo?token=${encodeURIComponent(token)}`)
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error)
    mensaje.value = data.mensaje
  } catch (verificationError) {
    error.value = true
    mensaje.value = verificationError.message || 'No fue posible verificar el correo.'
  }
})
</script>
