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
          <div class="mb-4">
            <label class="category-tag mb-2" style="font-size: 0.75rem;">CAPTCHA MATEMÁTICO</label>
            <div class="captcha-row">
              <span class="captcha-question" aria-live="polite">
                {{ captchaPregunta || 'Cargando...' }}
              </span>
              <input
                type="text"
                v-model="loginData.captchaRespuesta"
                class="form-control captcha-answer"
                inputmode="numeric"
                maxlength="4"
                pattern="[0-9]{1,4}"
                aria-label="Resultado del captcha matemático"
                @input="normalizarCaptcha"
                required
              >
              <button
                type="button"
                class="btn-editorial captcha-refresh"
                aria-label="Generar otro captcha"
                @click="cargarCaptcha"
              >
                <span aria-hidden="true">↻</span>
              </button>
            </div>
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
import { onMounted, ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { api } from '../services/api.js'

const router = useRouter()
const cargando = ref(false)
const errorMsg = ref('')
const captchaPregunta = ref('')
const loginData = ref({ email: '', contrasena: '', captchaRespuesta: '' })

function normalizarCaptcha(event) {
  const respuesta = event.target.value.replace(/\D/g, '').slice(0, 4)
  event.target.value = respuesta
  loginData.value.captchaRespuesta = respuesta
}

async function cargarCaptcha() {
  loginData.value.captchaRespuesta = ''
  try {
    const data = await api.get('/api/auth/captcha')
    captchaPregunta.value = data.pregunta
  } catch {
    captchaPregunta.value = ''
    errorMsg.value = 'No se pudo cargar el captcha. Intenta de nuevo.'
  }
}

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
    if (e.status !== 429) {
      await cargarCaptcha()
    }
  } finally {
    cargando.value = false
  }
}

onMounted(cargarCaptcha)
</script>

<style scoped>
.captcha-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 5.5rem 2.75rem;
  align-items: stretch;
  gap: 0.5rem;
}

.captcha-question {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 3rem;
  padding: 0.5rem 0.75rem;
  overflow: hidden;
  border: 1px solid var(--border-dark);
  background-color: var(--cream-bg);
  color: var(--dark-text);
  font-size: 0.9rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-align: center;
  white-space: nowrap;
}

.captcha-answer {
  width: 100%;
  min-width: 0;
  min-height: 3rem;
  padding: 0.8rem 0.5rem;
  text-align: center;
}

.captcha-refresh {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 3rem;
  padding: 0;
  font-size: 1.3rem;
  line-height: 1;
}

@media (max-width: 360px) {
  .captcha-row {
    grid-template-columns: minmax(0, 1fr) 4.5rem 2.5rem;
    gap: 0.35rem;
  }
}
</style>
