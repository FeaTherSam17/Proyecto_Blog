<template>
  <div class="d-flex flex-column" style="min-height: 100vh; background-color: var(--cream-bg);">
    <div class="flex-grow-1 d-flex align-items-center justify-content-center">
      <div class="login-card" style="width: 100%; max-width: 400px; padding: 3rem 2rem;">

        <div class="text-center mb-3">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--dark-text)" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>

        <h2 class="section-title text-center mb-4" style="font-size: 1.5rem;">ACCESO USUARIO</h2>

        <form @submit.prevent="hacerLogin">
          <div class="mb-3">
            <label class="category-tag mb-2" style="font-size: 0.75rem;">EMAIL</label>
            <input type="email" v-model="loginData.email" class="form-control w-100" required>
          </div>
          <div class="mb-4">
            <label class="category-tag mb-2" style="font-size: 0.75rem;">CONTRASEÑA</label>
            <input type="password" v-model="loginData.contrasena" class="form-control w-100" required>
          </div>

          <p v-if="errorMsg" class="text-danger" style="font-size: 0.8rem; text-align: center;">{{ errorMsg }}</p>

          <button type="submit" class="btn-editorial w-100" style="padding: 1rem;" :disabled="cargando">
            {{ cargando ? 'CARGANDO...' : 'ENTRAR' }}
          </button>
          <div class="text-center mt-4">
            <RouterLink to="/inicio" class="category-tag" style="text-decoration: none; font-size: 0.75rem;">&larr; VOLVER AL SITIO</RouterLink>
          </div>
          <div class="text-center mt-4">
            <RouterLink to="/registro" class="category-tag" style="text-decoration: none; font-size: 0.75rem;">
              ¿NO TIENES CUENTA? REGÍSTRATE AQUÍ &rarr;
            </RouterLink>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { api } from '../services/api.js'

const router = useRouter()
const cargando = ref(false)
const errorMsg = ref('')
const loginData = ref({ email: '', contrasena: '' })

async function hacerLogin() {
  cargando.value = true
  errorMsg.value = ''
  try {
    const data = await api.post('/api/auth/login', loginData.value)
    const rol = (data.rol || '').toUpperCase()
    if (rol === 'ADMIN') {
      router.push('/admin-panel')
    } else {
      router.push('/inicio')
    }
  } catch (e) {
    errorMsg.value = e.data?.error || 'Autenticación fallida'
  } finally {
    cargando.value = false
  }
}
</script>
