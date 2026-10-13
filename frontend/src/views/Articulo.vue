<template>
  <div>
    <nav class="navbar sticky-top">
      <div class="container">
        <RouterLink class="navbar-brand" to="/inicio">PROYECTO_BLOG</RouterLink>
      </div>
    </nav>

    <main class="container py-5" style="max-width: 800px;">
      <BotonRegresar class="mb-5" label="VOLVER AL LISTADO" />

      <header class="mb-5" v-if="publicacionActual">
        <div class="category-tag mb-3" style="font-size: 0.85rem;">{{ publicacionActual.nombre_categoria }}</div>
        <h1 class="display-3 mb-4" style="text-transform: uppercase;">{{ publicacionActual.titulo }}</h1>
        <div class="d-flex align-items-center gap-3 py-3"
          style="border-top: 1px solid var(--border-soft); border-bottom: 1px solid var(--border-soft);">
          <div
            style="background:var(--dark-text); color:white; width:45px; height:45px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-weight:900; font-family: 'Inter', sans-serif;">
            {{ publicacionActual.autor_nombre.substring(0, 2).toUpperCase() }}
          </div>
          <div>
            <div style="font-weight: 900; font-size: 0.85rem; text-transform: uppercase;">{{ publicacionActual.autor_nombre }}</div>
            <div class="text-secondary" style="font-size: 0.8rem;">{{ formatearFecha(publicacionActual.fecha_publicacion) }}</div>
          </div>
        </div>
      </header>

      <article class="serif fs-5" style="font-size: 1.2rem; color: #333; white-space: pre-line;" v-if="publicacionActual">
        <p>{{ publicacionActual.texto_publicacion }}</p>
      </article>
      <div v-else-if="errorMsg" class="py-5 text-center">
        <h2 class="text-danger">{{ errorMsg }}</h2>
      </div>
      <div v-else class="py-5 text-center">
        <h2>Cargando...</h2>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { api, formatearFecha } from '../services/api.js'
import BotonRegresar from '../components/BotonRegresar.vue'

const route = useRoute()
const publicacionActual = ref(null)
const errorMsg = ref('')

onMounted(async () => {
  const id = route.params.id
  if (!id) { errorMsg.value = 'ID no especificado'; return }
  try {
    publicacionActual.value = await api.get(`/api/blog/posts/${id}`)
  } catch {
    errorMsg.value = 'Artículo no encontrado'
  }
})
</script>
