<template>
  <div class="d-flex flex-column" style="min-height: 100vh; background-color: var(--cream-bg);">
    <div class="flex-grow-1 d-flex align-items-center justify-content-center py-5">
      <div class="login-card" style="width: 100%; max-width: 600px; padding: 3rem 2rem;">
        <h2 class="section-title text-center mb-4" style="font-size: 1.5rem;">REGISTRO DE AUTOR</h2>

        <form @submit.prevent="hacerRegistro">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div style="grid-column: span 2;">
              <label class="category-tag mb-2" style="font-size: 0.75rem;">NOMBRE *</label>
              <input type="text" v-model="registroData.nombre" class="form-control w-100" maxlength="50" required>
            </div>
            <div>
              <label class="category-tag mb-2" style="font-size: 0.75rem;">PRIMER APELLIDO</label>
              <input type="text" v-model="registroData.primer_apellido" class="form-control w-100" maxlength="50">
            </div>
            <div>
              <label class="category-tag mb-2" style="font-size: 0.75rem;">SEGUNDO APELLIDO</label>
              <input type="text" v-model="registroData.segundo_apellido" class="form-control w-100" maxlength="50">
              <small class="text-secondary" style="font-size: 0.65rem;">(Debes llenar al menos un apellido)</small>
            </div>
          </div>

          <div class="mb-3">
            <label class="category-tag mb-2" style="font-size: 0.75rem;">SEXO *</label>
            <select v-model="registroData.cod_sexo" class="form-control w-100" required>
              <option value="" disabled selected>Selecciona una opción</option>
              <option v-for="sexo in sexos" :key="sexo.cod_sexo" :value="sexo.cod_sexo">
                {{ sexo.descripcion }}
              </option>
            </select>
          </div>

          <div class="mb-3">
            <label class="category-tag mb-2" style="font-size: 0.75rem;">EMAIL *</label>
            <input
              type="email"
              v-model="registroData.email"
              class="form-control w-100"
              maxlength="150"
              pattern="^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$"
              required
            >
          </div>

          <div class="mb-3">
            <label class="category-tag mb-2" style="font-size: 0.75rem;">TELÉFONO *</label>
            <input
              type="text"
              v-model="registroData.telefono"
              class="form-control w-100"
              pattern="^[0-9]{10}$"
              title="Debe contener exactamente 10 números"
              required
            >
          </div>

          <div class="mb-3">
            <label class="category-tag mb-2" style="font-size: 0.75rem;">BIOGRAFÍA *</label>
            <textarea v-model="registroData.biografia" class="form-control w-100" rows="3" maxlength="500" required></textarea>
          </div>

          <div class="mb-4">
            <label class="category-tag mb-2" style="font-size: 0.75rem;">CONTRASEÑA *</label>
            <input type="password" v-model="registroData.contrasena" class="form-control w-100" required>
          </div>

          <p v-if="errorMsg" class="text-danger mb-3" style="font-size: 0.8rem; text-align: center;">{{ errorMsg }}</p>

          <button type="submit" class="btn-editorial w-100 mb-4" style="padding: 1rem;" :disabled="cargando">
            {{ cargando ? 'REGISTRANDO...' : 'CREAR CUENTA' }}
          </button>

          <div class="text-center">
            <BotonRegresar label="VOLVER AL ACCESO" fallback="/login" />
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { api } from '../services/api.js'
import BotonRegresar from '../components/BotonRegresar.vue'

const router = useRouter()
const cargando = ref(false)
const errorMsg = ref('')
const sexos = ref([])
const registroData = ref({
  nombre: '',
  primer_apellido: '',
  segundo_apellido: '',
  cod_sexo: '',
  email: '',
  telefono: '',
  biografia: '',
  contrasena: '',
})

onMounted(async () => {
  try {
    sexos.value = await api.get('/api/auth/sexos')
  } catch (e) {
    console.error('Error al cargar sexos', e)
  }
})

async function hacerRegistro() {
  if (!registroData.value.primer_apellido && !registroData.value.segundo_apellido) {
    errorMsg.value = 'Por favor, proporciona al menos tu primer o segundo apellido.'
    return
  }
  cargando.value = true
  errorMsg.value = ''
  try {
    await api.post('/api/auth/registro', registroData.value)
    alert('Registro creado. Revisa tu correo y confirma el enlace antes de iniciar sesión.')
    router.push('/login')
  } catch (e) {
    errorMsg.value = e.data?.error || 'Error al crear la cuenta'
  } finally {
    cargando.value = false
  }
}
</script>
