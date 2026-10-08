<template>
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
          v-for="pub in publicaciones"
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

<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { api, formatearFecha } from '../services/api.js'

const publicaciones = ref([])
const categorias = ref([])
const categoriaSeleccionada = ref(null)
const usuarioActual = ref(null)

onMounted(async () => {
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
})

function seleccionarCategoria(cat) {
  if (categoriaSeleccionada.value?.id_categoria === cat.id_categoria) {
    categoriaSeleccionada.value = null
  } else {
    categoriaSeleccionada.value = cat
  }
}
</script>
