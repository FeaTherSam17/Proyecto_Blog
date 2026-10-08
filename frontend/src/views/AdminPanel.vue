<template>
  <div>
    <nav class="navbar sticky-top">
      <div class="container d-flex align-items-center justify-content-between">
        <RouterLink class="navbar-brand" to="/inicio">PROYECTO_BLOG</RouterLink>
        <button class="btn-editorial" @click="cerrarSesion">CERRAR SESIÓN</button>
      </div>
    </nav>

    <section class="container py-5 admin-panel-container">
      <div class="admin-layout-v2">
        <aside class="admin-sidebar right-sidebar-panel">
          <button type="button" class="right-menu-button" :class="{ active: seccionPanel === 'publicaciones' }" @click="setSeccionPanel('publicaciones')">BUSQUEDA DE PUBLICACIONES</button>
          <button type="button" class="right-menu-button" :class="{ active: seccionPanel === 'autores' }" @click="setSeccionPanel('autores')">BUSQUEDA DE AUTORES</button>
          <div class="right-menu-footer" v-if="seccionPanel === 'autores'">
            <button type="button" class="btn-editorial w-100" @click="abrirModalAutorPanel">+ AGREGAR AUTOR</button>
          </div>
        </aside>

        <main class="sidebar-box">
          <div class="mb-4 panel-header">
            <h2 class="section-title panel-title">{{ seccionPanel === 'publicaciones' ? 'BUSQUEDA DE PUBLICACIONES' : 'BUSQUEDA DE AUTORES' }}</h2>
            <p class="text-secondary panel-subtitle">{{ seccionPanel === 'publicaciones' ? 'Filtra publicaciones por autor, fecha o estatus.' : 'Encuentra autores por nombre o correo.' }}</p>
          </div>

          <!-- PUBLICACIONES -->
          <section v-if="seccionPanel === 'publicaciones'">
            <div class="filters-grid">
              <div>
                <label class="category-tag mb-2">Autor</label>
                <input v-model="filtrosPublicacionesPanel.autor" type="text" class="form-control w-100" placeholder="Ej. Ana Perez">
              </div>
              <div>
                <label class="category-tag mb-2">Estatus</label>
                <select v-model="filtrosPublicacionesPanel.estatus" class="form-control w-100">
                  <option value="">Todos</option>
                  <option value="ACTIVO">Activo</option>
                  <option value="INACTIVO">Inactivo</option>
                  <option value="PENDIENTE_VERIFICACION">Pendiente verificacion</option>
                  <option value="SUSPENDIDO">Suspendido</option>
                  <option value="ELIMINADO">Eliminado</option>
                </select>
              </div>
              <div>
                <label class="category-tag mb-2">Fecha Desde</label>
                <input v-model="filtrosPublicacionesPanel.fechaDesde" type="date" class="form-control w-100">
              </div>
              <div>
                <label class="category-tag mb-2">Fecha Hasta</label>
                <input v-model="filtrosPublicacionesPanel.fechaHasta" type="date" class="form-control w-100">
              </div>
            </div>
            <div class="result-list">
              <div class="result-item" v-for="pub in publicacionesFiltradasPanel" :key="pub.id">
                <p class="category-tag result-meta">{{ pub.estatus }} - {{ formatearFecha(pub.fecha) }}</p>
                <h3 class="result-title">{{ pub.titulo }}</h3>
                <p class="text-secondary result-author">AUTOR: {{ pub.autor }}</p>
                <p class="text-secondary result-author" style="font-size:0.75rem; margin-top:2px;">
                  Total posts del autor: {{ pub.totalPostsAutor }}
                </p>
              </div>
              <div class="pagination-container text-center mt-5 mb-4" v-if="totalPaginasPublicaciones > 1">
                <button type="button" class="pagination-number pagination-nav" :disabled="paginaPublicacionesActual === 0" @click="retrocederPaginaPublicaciones">Anterior</button>
                <template v-for="(item, idx) in paginasPublicacionesVisibles" :key="item.type + '-' + idx">
                  <span v-if="item.type === 'ellipsis'" class="pagination-ellipsis">…</span>
                  <button v-else type="button" class="pagination-number" :class="{ 'active': paginaPublicacionesActual === (item.page - 1) }" @click="cambiarPaginaPublicaciones(item.page - 1)">{{ item.page }}</button>
                </template>
                <button type="button" class="pagination-number pagination-nav" :disabled="paginaPublicacionesActual >= (totalPaginasPublicaciones - 1)" @click="avanzarPaginaPublicaciones">Siguiente</button>
              </div>
              <p v-if="publicacionesFiltradasPanel.length === 0" class="text-secondary text-center empty-state">No hay publicaciones que coincidan con los filtros.</p>
            </div>
          </section>

          <!-- AUTORES -->
          <section v-else>
            <div class="filters-grid">
              <div class="filter-full">
                <label class="category-tag mb-2">Buscar Autor</label>
                <input v-model="filtroAutoresPanel" type="text" class="form-control w-100" placeholder="Nombre o correo">
              </div>
            </div>
            <div class="result-list">
              <div class="result-item" v-for="autor in autoresFiltradosPanel" :key="autor.id">
                <h3 class="author-name">{{ nombreCompletoAutorPanel(autor) }}</h3>
                <p class="text-secondary author-mail">{{ autor.email }}</p>
                <p class="text-secondary author-phone">{{ autor.telefono }}</p>
                <div class="author-item-footer">
                  <span class="badge">{{ autor.estatus }}</span>
                  <div class="author-actions">
                    <button type="button" class="author-action-btn" @click="editarAutorPanel(autor)">EDITAR</button>
                    <button type="button" class="author-action-btn author-action-btn-danger" @click="eliminarAutorPanel(autor)">ELIMINAR</button>
                  </div>
                </div>
              </div>
              <div class="pagination-container text-center mt-5 mb-4" v-if="totalPaginasAutores > 1">
                <button type="button" class="pagination-number pagination-nav" :disabled="paginaAutoresActual === 0" @click="retrocederPaginaAutores">Anterior</button>
                <template v-for="(item, idx) in paginasAutoresVisibles" :key="item.type + '-' + idx">
                  <span v-if="item.type === 'ellipsis'" class="pagination-ellipsis">…</span>
                  <button v-else type="button" class="pagination-number" :class="{ 'active': paginaAutoresActual === (item.page - 1) }" @click="cambiarPaginaAutores(item.page - 1)">{{ item.page }}</button>
                </template>
                <button type="button" class="pagination-number pagination-nav" :disabled="paginaAutoresActual >= (totalPaginasAutores - 1)" @click="avanzarPaginaAutores">Siguiente</button>
              </div>
              <p v-if="autoresFiltradosPanel.length === 0" class="text-secondary text-center empty-state">No hay autores para mostrar.</p>
            </div>
          </section>
        </main>
      </div>
    </section>

    <!-- MODAL AUTOR -->
    <div v-if="mostrarModalAutorPanel" class="modal-backdrop" @click.self="cerrarModalAutorPanel">
      <div class="modal-card">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <h3 class="section-title modal-title">{{ editandoAutorPanelId ? 'EDITAR AUTOR' : 'NUEVO AUTOR' }}</h3>
          <button type="button" class="btn-editorial modal-close-btn" @click="cerrarModalAutorPanel">X</button>
        </div>
        <form @submit.prevent="guardarAutorPanel">
          <div class="mb-3"><label class="category-tag mb-2">Nombre</label><input v-model="nuevoAutorPanel.nombre" type="text" class="form-control w-100" required></div>
          <div class="mb-3"><label class="category-tag mb-2">Primer Apellido</label><input v-model="nuevoAutorPanel.primer_apellido" type="text" class="form-control w-100" required></div>
          <div class="mb-3"><label class="category-tag mb-2">Segundo Apellido</label><input v-model="nuevoAutorPanel.segundo_apellido" type="text" class="form-control w-100" required></div>
          <div class="mb-3">
            <label class="category-tag mb-2">Sexo</label>
            <select v-model="nuevoAutorPanel.sexo" class="form-control w-100" required>
              <option value="" disabled>Selecciona una opcion</option>
              <option v-for="sexo in sexos" :key="sexo.cod_sexo" :value="sexo.cod_sexo">{{ sexo.descripcion }}</option>
            </select>
          </div>
          <div class="mb-3"><label class="category-tag mb-2">Email</label><input v-model="nuevoAutorPanel.email" type="email" class="form-control w-100" required></div>
          <div class="mb-3"><label class="category-tag mb-2">Telefono</label><input v-model="nuevoAutorPanel.telefono" type="tel" class="form-control w-100" required></div>
          <div class="mb-3"><label class="category-tag mb-2">Biografia</label><textarea v-model="nuevoAutorPanel.biografia" class="form-control w-100" rows="4" required></textarea></div>
          <div class="mb-4">
            <label class="category-tag mb-2">Contrasena {{ editandoAutorPanelId ? '(opcional)' : '' }}</label>
            <input v-model="nuevoAutorPanel.contrasena" type="password" class="form-control w-100" :required="!editandoAutorPanelId">
          </div>
          <p v-if="errorMsg" style="color: #b42318; font-size: 0.85rem; font-weight: 700; margin-bottom: 1rem;">{{ errorMsg }}</p>
          <div class="d-flex gap-3">
            <button type="submit" class="btn-editorial">{{ editandoAutorPanelId ? 'ACTUALIZAR AUTOR' : 'GUARDAR AUTOR' }}</button>
            <button type="button" class="btn-editorial" @click="cerrarModalAutorPanel">CANCELAR</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { api, formatearFecha } from '../services/api.js'

const router = useRouter()
const seccionPanel = ref('publicaciones')
const mostrarModalAutorPanel = ref(false)
const editandoAutorPanelId = ref(null)
const filtrosPublicacionesPanel = ref({ autor: '', estatus: '', fechaDesde: '', fechaHasta: '' })
const filtroAutoresPanel = ref('')
const publicacionesPanel = ref([])
const autoresPanel = ref([])
const paginaAutoresActual = ref(0)
const totalPaginasAutores = ref(0)
const paginaPublicacionesActual = ref(0)
const totalPaginasPublicaciones = ref(0)
const errorMsg = ref('')
const sexos = ref([])
const timerBusquedaPublicaciones = ref(null)
const timerBusquedaAutores = ref(null)
const nuevoAutorPanel = ref({ nombre: '', primer_apellido: '', segundo_apellido: '', sexo: '', email: '', telefono: '', biografia: '', contrasena: '' })

const publicacionesFiltradasPanel = computed(() => publicacionesPanel.value)
const autoresFiltradosPanel = computed(() => autoresPanel.value)
const paginasPublicacionesVisibles = computed(() => construirPaginadoVisible(totalPaginasPublicaciones.value, paginaPublicacionesActual.value))
const paginasAutoresVisibles = computed(() => construirPaginadoVisible(totalPaginasAutores.value, paginaAutoresActual.value))

watch(() => filtrosPublicacionesPanel.value.autor, () => dispararBusquedaPublicaciones())
watch(() => filtrosPublicacionesPanel.value.estatus, () => dispararBusquedaPublicaciones())
watch(() => filtrosPublicacionesPanel.value.fechaDesde, () => dispararBusquedaPublicaciones())
watch(() => filtrosPublicacionesPanel.value.fechaHasta, () => dispararBusquedaPublicaciones())
watch(filtroAutoresPanel, () => dispararBusquedaAutores())

onMounted(async () => {
  try {
    const data = await api.get('/api/auth/me')
    const rol = ((data.usuario || data.autor)?.rol || '').toUpperCase()
    if (rol !== 'ADMIN') { router.push('/admin'); return }
  } catch { router.push('/login'); return }
  await cargarPublicacionesPanel()
  await cargarAutoresPanel()
  await cargarSexos()
})

function construirPaginadoVisible(totalPaginas, paginaActual) {
  const total = Number(totalPaginas) || 0
  const actual = Number(paginaActual) || 0
  if (total <= 1) return []
  if (total <= 7) return Array.from({ length: total }, (_, idx) => ({ type: 'page', page: idx + 1 }))
  const items = []
  const addPage = (page) => items.push({ type: 'page', page })
  const addEllipsis = () => { if (items.length === 0 || items[items.length - 1].type === 'ellipsis') return; items.push({ type: 'ellipsis' }) }
  const currentPage = Math.min(Math.max(actual + 1, 1), total)
  const windowSize = 2
  const start = Math.max(2, currentPage - windowSize)
  const end = Math.min(total - 1, currentPage + windowSize)
  addPage(1)
  if (start > 2) addEllipsis()
  for (let page = start; page <= end; page += 1) addPage(page)
  if (end < total - 1) addEllipsis()
  if (total > 1) addPage(total)
  return items
}

async function cargarSexos() {
  try { sexos.value = await api.get('/api/auth/sexos') } catch (e) { console.error(e) }
}

async function cargarPublicacionesPanel(pagina = 0) {
  paginaPublicacionesActual.value = pagina
  const limitStr = 10
  const params = new URLSearchParams()
  if (filtrosPublicacionesPanel.value.autor) params.set('autor', filtrosPublicacionesPanel.value.autor)
  if (filtrosPublicacionesPanel.value.estatus) params.set('estatus', filtrosPublicacionesPanel.value.estatus)
  if (filtrosPublicacionesPanel.value.fechaDesde) params.set('fechaDesde', filtrosPublicacionesPanel.value.fechaDesde)
  if (filtrosPublicacionesPanel.value.fechaHasta) params.set('fechaHasta', filtrosPublicacionesPanel.value.fechaHasta)
  params.set('limit', limitStr)
  params.set('offset', paginaPublicacionesActual.value * limitStr)
  try {
    const payload = await api.get(`/api/admin/panel?${params.toString()}`)
    const pubsDB = Array.isArray(payload) ? payload : (payload.publicaciones || [])
    const total = Array.isArray(payload) ? pubsDB.length : (payload.total || 0)
    publicacionesPanel.value = pubsDB.map((pub) => ({ id: pub.id_publicacion, titulo: pub.titulo, autor: pub.autor_nombre || '', fecha: pub.fecha_publicacion, estatus: pub.estado_publicacion, totalPostsAutor: pub.total_posts_autor || 0 }))
    totalPaginasPublicaciones.value = Math.ceil(total / limitStr)
  } catch (e) { if (e.status === 401) router.push('/login') }
}

async function cargarAutoresPanel(pagina = 0) {
  paginaAutoresActual.value = pagina
  const limitStr = 10
  const params = new URLSearchParams()
  if (filtroAutoresPanel.value) params.set('q', filtroAutoresPanel.value)
  params.set('limit', limitStr)
  params.set('offset', paginaAutoresActual.value * limitStr)
  try {
    const payload = await api.get(`/api/admin/autores?${params.toString()}`)
    const autoresDB = Array.isArray(payload) ? payload : (payload.autores || [])
    const total = Array.isArray(payload) ? autoresDB.length : (payload.total || 0)
    autoresPanel.value = autoresDB.map((autor) => ({ id: autor.id_autor, nombre: autor.nombre, primer_apellido: autor.primer_apellido, segundo_apellido: autor.segundo_apellido, sexo: autor.cod_sexo, email: autor.email, telefono: autor.telefono, biografia: autor.biografia, estatus: autor.estado_autor || autor.estado_usuario || 'ACTIVO' }))
    totalPaginasAutores.value = Math.ceil(total / limitStr)
  } catch (e) { if (e.status === 401) router.push('/login') }
}

function dispararBusquedaPublicaciones() {
  if (timerBusquedaPublicaciones.value) clearTimeout(timerBusquedaPublicaciones.value)
  timerBusquedaPublicaciones.value = setTimeout(() => cargarPublicacionesPanel(0), 300)
}

function dispararBusquedaAutores() {
  if (timerBusquedaAutores.value) clearTimeout(timerBusquedaAutores.value)
  timerBusquedaAutores.value = setTimeout(() => cargarAutoresPanel(), 300)
}

function setSeccionPanel(seccion) {
  seccionPanel.value = seccion
  if (seccion === 'publicaciones') cargarPublicacionesPanel()
  else cargarAutoresPanel()
}

function cambiarPaginaPublicaciones(pagina) { if (pagina >= 0 && pagina < totalPaginasPublicaciones.value) cargarPublicacionesPanel(pagina) }
function cambiarPaginaAutores(pagina) { if (pagina >= 0 && pagina < totalPaginasAutores.value) cargarAutoresPanel(pagina) }
function retrocederPaginaPublicaciones() { cambiarPaginaPublicaciones(paginaPublicacionesActual.value - 1) }
function avanzarPaginaPublicaciones() { cambiarPaginaPublicaciones(paginaPublicacionesActual.value + 1) }
function retrocederPaginaAutores() { cambiarPaginaAutores(paginaAutoresActual.value - 1) }
function avanzarPaginaAutores() { cambiarPaginaAutores(paginaAutoresActual.value + 1) }
function nombreCompletoAutorPanel(autor) { return `${autor.nombre || ''} ${autor.primer_apellido || ''} ${autor.segundo_apellido || ''}`.replace(/\s+/g, ' ').trim() }

function abrirModalAutorPanel() { errorMsg.value = ''; editandoAutorPanelId.value = null; mostrarModalAutorPanel.value = true }
function cerrarModalAutorPanel() {
  mostrarModalAutorPanel.value = false
  editandoAutorPanelId.value = null
  nuevoAutorPanel.value = { nombre: '', primer_apellido: '', segundo_apellido: '', sexo: '', email: '', telefono: '', biografia: '', contrasena: '' }
}

function editarAutorPanel(autor) {
  errorMsg.value = ''
  editandoAutorPanelId.value = autor.id
  nuevoAutorPanel.value = { nombre: autor.nombre || '', primer_apellido: autor.primer_apellido || '', segundo_apellido: autor.segundo_apellido || '', sexo: autor.sexo || '', email: autor.email || '', telefono: autor.telefono || '', biografia: autor.biografia || '', contrasena: '' }
  mostrarModalAutorPanel.value = true
}

async function eliminarAutorPanel(autor) {
  if (!confirm(`¿Deseas eliminar al autor ${nombreCompletoAutorPanel(autor)}?`)) return
  try {
    await api.delete(`/api/admin/autores/${autor.id}`)
    cargarAutoresPanel()
  } catch (e) { errorMsg.value = e.data?.error || 'No fue posible eliminar el autor' }
}

async function guardarAutorPanel() {
  errorMsg.value = ''
  const payload = {
    nombre: nuevoAutorPanel.value.nombre.trim(),
    primer_apellido: nuevoAutorPanel.value.primer_apellido.trim(),
    segundo_apellido: nuevoAutorPanel.value.segundo_apellido.trim(),
    cod_sexo: nuevoAutorPanel.value.sexo,
    email: nuevoAutorPanel.value.email.trim(),
    telefono: nuevoAutorPanel.value.telefono.trim(),
    biografia: nuevoAutorPanel.value.biografia.trim(),
    contrasena: nuevoAutorPanel.value.contrasena,
  }
  const completo = payload.nombre && payload.primer_apellido && payload.segundo_apellido && payload.cod_sexo && payload.email && payload.telefono && payload.biografia
  if (!completo) { errorMsg.value = 'Por favor, llena todos los campos obligatorios.'; return }
  if (!editandoAutorPanelId.value && !payload.contrasena) { errorMsg.value = 'La contraseña es obligatoria para un autor nuevo.'; return }
  if (editandoAutorPanelId.value && !payload.contrasena) delete payload.contrasena
  try {
    if (editandoAutorPanelId.value) { await api.put(`/api/admin/autores/${editandoAutorPanelId.value}`, payload) }
    else { await api.post('/api/admin/autores', payload) }
    cerrarModalAutorPanel()
    cargarAutoresPanel()
  } catch (e) { errorMsg.value = e.data?.error || 'No fue posible registrar el autor' }
}

async function cerrarSesion() {
  try { await api.post('/api/auth/logout', {}) } catch (e) { console.error(e) }
  router.push('/inicio')
}
</script>
