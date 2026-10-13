<template>
  <div>
    <nav class="navbar sticky-top">
      <div class="container d-flex align-items-center justify-content-between">
        <RouterLink class="navbar-brand" to="/inicio">PROYECTO_BLOG</RouterLink>
        <div class="d-flex align-items-center gap-3">
          <span style="font-size: 0.8rem; font-weight: 700;">{{ usuarioActual?.nombre?.toUpperCase() }}</span>
          <RouterLink to="/inicio" class="btn-editorial">VER SITIO</RouterLink>
        </div>
      </div>
    </nav>

    <div class="container py-5">
      <div class="grid-admin">
        <aside class="admin-sidebar" style="padding: 0; overflow: hidden;">
          <div class="text-center py-4" style="border-bottom: 1px solid var(--border-soft);">
            <div style="background:var(--dark-text); color:white; width:60px; height:60px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-weight:900;">
              {{ usuarioActual?.nombre?.substring(0, 2).toUpperCase() || 'U' }}
            </div>
            <p class="mt-3" style="font-weight: 700; margin-bottom: 0;">{{ usuarioActual?.nombre || 'Usuario' }}</p>
          </div>
          <div class="d-flex flex-column">
            <a href="#" class="admin-menu-link active">Mis Publicaciones</a>
            <a href="#" @click.prevent="cerrarSesion" class="admin-menu-link text-danger">Cerrar Sesión</a>
          </div>
        </aside>

        <main class="sidebar-box">
          <BotonRegresar class="mb-3" label="VOLVER AL SITIO" />
          <div class="d-flex align-items-center justify-content-between mb-4">
            <h5 class="section-title mb-0">
              {{ mostrarFormulario ? (editandoPublicacionId ? 'EDITAR ENTRADA' : 'NUEVA ENTRADA') : 'GESTIONAR CONTENIDO' }}
            </h5>
            <button class="btn-editorial" @click="toggleFormulario">
              {{ mostrarFormulario ? 'CANCELAR' : '+ NUEVA ENTRADA' }}
            </button>
          </div>

          <!-- FORMULARIO NUEVA / EDITAR ENTRADA -->
          <div v-if="mostrarFormulario">
            <form @submit.prevent="guardarPublicacion" class="p-4" style="border: 1px solid var(--border-soft); background: white;">
              <div class="mb-3">
                <label class="category-tag mb-2" style="font-size: 0.75rem;">TÍTULO</label>
                <input type="text" v-model="nuevaEntrada.titulo" class="form-control w-100" required maxlength="200">
              </div>
              <div class="mb-3">
                <label class="category-tag mb-2" style="font-size: 0.75rem;">CATEGORÍA</label>
                <select v-model="nuevaEntrada.id_categoria" class="form-control w-100" required>
                  <option value="" disabled>Selecciona una categoría</option>
                  <option v-for="cat in categorias" :key="cat.id_categoria" :value="cat.id_categoria">
                    {{ cat.nombre_categoria }}
                  </option>
                </select>
              </div>
              <div class="mb-4">
                <label class="category-tag mb-2" style="font-size: 0.75rem;">CONTENIDO</label>
                <textarea v-model="nuevaEntrada.texto_publicacion" class="form-control w-100" rows="10" required></textarea>
              </div>
              <p v-if="errorMsg" class="text-danger" style="font-size: 0.8rem;">{{ errorMsg }}</p>
              <button type="submit" class="btn-editorial" :disabled="creandoPublicacion">
                {{ creandoPublicacion ? 'GUARDANDO...' : (editandoPublicacionId ? 'GUARDAR CAMBIOS' : 'PUBLICAR ENTRADA') }}
              </button>
            </form>
          </div>

          <!-- TABLA DE PUBLICACIONES -->
          <div v-else>
            <table class="table" v-if="publicaciones.length > 0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>TÍTULO</th>
                  <th>CATEGORÍA</th>
                  <th>ESTADO</th>
                  <th style="text-align: right;">ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="pub in publicaciones" :key="pub.id_publicacion">
                  <td style="color: var(--muted-text);">#{{ pub.id_publicacion.toString().padStart(3, '0') }}</td>
                  <td style="font-weight: 700; max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" :title="pub.titulo">
                    {{ pub.titulo }}
                  </td>
                  <td>{{ pub.nombre_categoria }}</td>
                  <td><span class="badge">{{ pub.estado_publicacion }}</span></td>
                  <td style="text-align: right;">
                    <select class="btn-editorial" style="padding: 8px 12px; cursor: pointer;" @change="accionPublicacion($event, pub)">
                      <option value="" selected>ACCIONES</option>
                      <option value="editar">Editar</option>
                      <option value="eliminar">Eliminar</option>
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-else class="text-secondary text-center py-5">No tienes publicaciones aún.</p>
          </div>
        </main>
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
const usuarioActual = ref(null)
const publicaciones = ref([])
const categorias = ref([])
const mostrarFormulario = ref(false)
const creandoPublicacion = ref(false)
const errorMsg = ref('')
const editandoPublicacionId = ref(null)
const nuevaEntrada = ref({ titulo: '', id_categoria: '', texto_publicacion: '' })

onMounted(async () => {
  try {
    const data = await api.get('/api/auth/me')
    usuarioActual.value = data.usuario || data.autor
    const rol = (usuarioActual.value?.rol || '').toUpperCase()
    if (rol === 'ADMIN') { router.push('/admin-panel'); return }
  } catch {
    router.push('/login')
    return
  }
  await cargarCategorias()
  await cargarPublicacionesAdmin()
})

async function cargarCategorias() {
  try { categorias.value = await api.get('/api/blog/categorias') } catch (e) { console.error(e) }
}

async function cargarPublicacionesAdmin() {
  try { publicaciones.value = await api.get('/api/admin/panel') } catch (e) {
    if (e.status === 401) router.push('/login')
  }
}

async function guardarPublicacion() {
  creandoPublicacion.value = true
  errorMsg.value = ''
  try {
    if (editandoPublicacionId.value) {
      await api.put(`/api/admin/publicaciones/${editandoPublicacionId.value}`, nuevaEntrada.value)
    } else {
      await api.post('/api/admin/publicaciones', nuevaEntrada.value)
    }
    resetFormulario()
    await cargarPublicacionesAdmin()
  } catch (e) {
    errorMsg.value = e.data?.error || 'Error al guardar la publicación'
  } finally {
    creandoPublicacion.value = false
  }
}

async function cargarPublicacionParaEditar(id) {
  errorMsg.value = ''
  try {
    const data = await api.get(`/api/admin/publicaciones/${id}`)
    nuevaEntrada.value = {
      titulo: data.titulo || '',
      id_categoria: data.id_categoria || '',
      texto_publicacion: data.texto_publicacion || '',
    }
    editandoPublicacionId.value = id
    mostrarFormulario.value = true
  } catch (e) {
    errorMsg.value = e.data?.error || 'Error al cargar la publicación'
  }
}

async function eliminarPublicacion(id) {
  if (!confirm('¿Deseas eliminar esta publicación?')) return
  try {
    await api.delete(`/api/admin/publicaciones/${id}`)
    await cargarPublicacionesAdmin()
  } catch (e) {
    errorMsg.value = e.data?.error || 'Error al eliminar'
  }
}

function accionPublicacion(event, pub) {
  const accion = event.target.value
  event.target.value = ''
  if (accion === 'editar') cargarPublicacionParaEditar(pub.id_publicacion)
  if (accion === 'eliminar') eliminarPublicacion(pub.id_publicacion)
}

function resetFormulario() {
  mostrarFormulario.value = false
  editandoPublicacionId.value = null
  nuevaEntrada.value = { titulo: '', id_categoria: '', texto_publicacion: '' }
}

function toggleFormulario() {
  mostrarFormulario.value ? resetFormulario() : (mostrarFormulario.value = true)
}

async function cerrarSesion() {
  try { await api.post('/api/auth/logout', {}) } catch (e) { console.error(e) }
  router.push('/inicio')
}
</script>
