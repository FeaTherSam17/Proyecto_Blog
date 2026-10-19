<template>
  <div v-if="proteccionCargando" class="blog-access-state" aria-live="polite">
    <p class="serif">Verificando el acceso…</p>
    <div ref="turnstileContainer" class="turnstile-container"></div>
  </div>
  <div v-else-if="errorAcceso" class="blog-access-state" role="alert">
    <p class="text-danger">{{ errorAcceso }}</p>
    <button class="btn-editorial" type="button" @click="iniciarAccesoBlog">REINTENTAR</button>
  </div>
  <template v-else>
  <nav class="navbar sticky-top">
    <div class="container d-flex align-items-center justify-content-between">
      <RouterLink class="navbar-brand" to="/inicio">PROYECTO_BLOG</RouterLink>
      <div class="d-flex align-items-center gap-4">
        <RouterLink to="/inicio" class="nav-link">INICIO</RouterLink>
        <RouterLink v-if="!usuarioActual" to="/login" class="btn-editorial">ACCESO</RouterLink>
        <RouterLink
          v-else
          to="/admin"
          class="btn-editorial"
          style="background-color: #0d6efd; border-color: #0d6efd;"
        >
          PANEL DE {{ usuarioActual.nombre?.toUpperCase() }}
        </RouterLink>
      </div>
    </div>
  </nav>

  <header class="text-center py-5" style="background: white; border-bottom: 1px solid var(--border-soft);">
    <h1 class="display-2" style="text-transform: uppercase;">THE EDITORIAL</h1>
    <p class="serif italic">Bases de datos, código y diseño minimalista.</p>
  </header>

  <main class="container py-5">
    <div class="grid-main">
      <section v-if="publicaciones.length > 0">
        <h5 class="section-title mb-4">PUBLICACIONES RECIENTES</h5>
        <RouterLink
          v-for="pub in publicacionesPaginadas"
          :key="pub.id_publicacion"
          :to="`/articulo/${pub.id_publicacion}`"
          class="blog-card"
          style="display: block; text-decoration: none; color: inherit; margin-bottom: 2rem;"
        >
          <div class="category-tag mb-2">{{ pub.nombre_categoria }} • {{ formatearFecha(pub.fecha_publicacion) }}</div>
          <h2 style="font-size: 2.2rem; font-weight: 900; letter-spacing: -1px; text-transform: uppercase; margin-bottom: 1rem;">
            {{ pub.titulo.substring(0, 50) }}...
          </h2>
          <p class="text-secondary serif" style="font-size: 1.1rem; margin-bottom: 1.5rem;">
            {{ pub.texto_publicacion.substring(0, 150) }}...
          </p>
          <div class="d-flex align-items-center justify-content-between mt-3" style="border-top: 1px solid var(--border-soft); padding-top: 1rem;">
            <span style="font-size: 0.74rem; font-weight: 900; text-transform: uppercase;">POR {{ pub.autor_nombre }}</span>
            <span style="font-size: 0.75rem; font-weight: 900; text-transform: uppercase;">LEER MÁS &rarr;</span>
          </div>
        </RouterLink>

        <!-- Controles de Paginación -->
        <div class="pagination-container mt-5 mb-4" v-if="totalPaginas > 1">
          <button 
            class="pagination-number pagination-nav" 
            :disabled="paginaActual === 1" 
            @click="paginaActual--"
          >
            &larr; ANT
          </button>
          
          <button 
            v-for="pag in totalPaginas" 
            :key="pag"
            class="pagination-number"
            :class="{ active: paginaActual === pag }"
            @click="paginaActual = pag"
          >
            {{ pag }}
          </button>
          
          <button 
            class="pagination-number pagination-nav" 
            :disabled="paginaActual === totalPaginas" 
            @click="paginaActual++"
          >
            SIG &rarr;
          </button>
        </div>
      </section>
      <section v-else>
        <p class="text-secondary">No hay publicaciones disponibles.</p>
      </section>

      <aside>
        <div class="sidebar-box">
          <h6 class="section-title mb-4">CATEGORÍAS</h6>
          <div class="d-flex flex-column gap-3">
            <a
              href="#"
              v-for="cat in categorias"
              :key="cat.id_categoria"
              @click.prevent="seleccionarCategoria(cat)"
              class="category-tag"
              style="text-decoration: none;"
            >
              {{ cat.nombre_categoria }}
            </a>
          </div>
          <div v-if="categoriaSeleccionada" class="mt-4 p-3" style="background: var(--cream-bg); border-left: 3px solid var(--dark-text);">
            <span class="category-tag mb-1" style="font-size: 0.65rem;">SOBRE ESTA SECCIÓN</span>
            <p class="serif mb-0" style="font-size: 0.85rem; color: var(--dark-text);">
              {{ categoriaSeleccionada.descripcion }}
            </p>
          </div>
        </div>
      </aside>
    </div>
  </main>
  </template>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { api, formatearFecha } from '../services/api.js'
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'

const publicaciones = ref([])
const categorias = ref([])
const categoriaSeleccionada = ref(null)
const usuarioActual = ref(null)
const proteccionCargando = ref(true)
const errorAcceso = ref('')
const turnstileContainer = ref(null)
const turnstileToken = ref('')
const turnstileActivo = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY)
let turnstileWidgetId = null
let turnstileScript = null

const paginaActual = ref(1)
const itemsPorPagina = 20

const totalPaginas = computed(() => {
  return Math.ceil(publicaciones.value.length / itemsPorPagina)
})

const publicacionesPaginadas = computed(() => {
  const inicio = (paginaActual.value - 1) * itemsPorPagina
  const fin = inicio + itemsPorPagina
  return publicaciones.value.slice(inicio, fin)
})

// Volver a la página 1 si cambian las publicaciones
watch(publicaciones, () => {
  paginaActual.value = 1
})

async function cargarScriptTurnstile() {
  if (window.turnstile) return
  if (turnstileScript) return turnstileScript

  turnstileScript = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.onload = resolve
    script.onerror = () => reject(new Error('No se pudo cargar la protección anti-bot'))
    document.head.appendChild(script)
  })
  return turnstileScript
}

async function obtenerTokenTurnstile() {
  await cargarScriptTurnstile()
  if (turnstileWidgetId === null) {
    turnstileWidgetId = window.turnstile.render(turnstileContainer.value, {
      sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
      size: 'invisible',
      execution: 'execute',
      appearance: 'interaction-only',
      callback: token => { turnstileToken.value = token },
      'expired-callback': () => { turnstileToken.value = '' },
      'error-callback': () => { turnstileToken.value = '' }
    })
  }

  turnstileToken.value = ''
  window.turnstile.execute(turnstileWidgetId)
  for (let intento = 0; intento < 50; intento += 1) {
    if (turnstileToken.value) return turnstileToken.value
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('La validación anti-bot no terminó')
}

async function iniciarAccesoBlog() {
  proteccionCargando.value = true
  errorAcceso.value = ''
  try {
    const token = turnstileActivo ? await obtenerTokenTurnstile() : ''
    await api.post('/api/blog/access', { token })
    await cargarContenido()
  } catch (error) {
    console.error('Error al validar acceso al blog', error)
    errorAcceso.value = error.data?.error || 'No se pudo abrir el blog. Intenta de nuevo.'
    proteccionCargando.value = false
  }
}

async function cargarContenido() {
  try {
    publicaciones.value = await api.get('/api/blog/posts')
  } catch (e) {
    console.error('Error al cargar publicaciones', e)
  }
  try {
    categorias.value = await api.get('/api/blog/categorias')
  } catch (e) {
    console.error('Error al cargar categorías', e)
  }
  try {
    const data = await api.get('/api/auth/me')
    usuarioActual.value = data.usuario || data.autor
  } catch {
    // No autenticado, está bien
  }
  proteccionCargando.value = false
}

onMounted(iniciarAccesoBlog)

function seleccionarCategoria(cat) {
  if (categoriaSeleccionada.value?.id_categoria === cat.id_categoria) {
    categoriaSeleccionada.value = null
  } else {
    categoriaSeleccionada.value = cat
  }
}

onUnmounted(() => {
  if (turnstileWidgetId !== null && window.turnstile) {
    window.turnstile.remove(turnstileWidgetId)
    turnstileWidgetId = null // Resetea la variable por seguridad
  }
})
</script>

<style scoped>
.blog-access-state {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  background: var(--cream-bg);
  text-align: center;
}

.turnstile-container {
  position: fixed;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}
</style>
