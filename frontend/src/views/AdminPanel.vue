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
          <button type="button" class="right-menu-button" :class="{ active: seccionPanel === 'logs' }" @click="setSeccionPanel('logs')">AUDITORÍA Y LOGS</button>
          <div class="right-menu-footer" v-if="seccionPanel === 'autores'">
            <button type="button" class="btn-editorial w-100" @click="abrirModalAutorPanel">+ AGREGAR AUTOR</button>
          </div>
        </aside>

        <main class="sidebar-box">
          <BotonRegresar class="mb-3" label="VOLVER AL SITIO" />
          <div class="mb-4 panel-header">
            <h2 class="section-title panel-title">
              {{ seccionPanel === 'publicaciones' ? 'BUSQUEDA DE PUBLICACIONES' : (seccionPanel === 'autores' ? 'BUSQUEDA DE AUTORES' : 'AUDITORÍA Y REGISTRO DE LOGS') }}
            </h2>
            <p class="text-secondary panel-subtitle">
              {{ seccionPanel === 'publicaciones' ? 'Filtra publicaciones por autor, fecha o estatus.' : (seccionPanel === 'autores' ? 'Encuentra autores por nombre o correo.' : 'Monitorea métricas de seguridad, eventos forenses y el archivo físico de logs del servidor.') }}
            </p>
          </div>

          <!-- 1. PUBLICACIONES -->
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
                <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-1">
                  <p class="category-tag result-meta mb-0">{{ formatearFecha(pub.fecha) }}</p>
                  <span
                    class="badge"
                    :class="{
                      'badge-success': pub.estatus === 'ACTIVO',
                      'badge-warning': pub.estatus === 'PENDIENTE_VERIFICACION',
                      'badge-danger': pub.estatus === 'SUSPENDIDO' || pub.estatus === 'ELIMINADO'
                    }"
                  >
                    {{ pub.estatus }}
                  </span>
                </div>
                <h3 class="result-title">{{ pub.titulo }}</h3>
                <p class="text-secondary result-author">AUTOR: {{ pub.autor }}</p>
                <p class="text-secondary result-author" style="font-size:0.75rem; margin-top:2px; margin-bottom: 0.75rem;">
                  Total posts del autor: {{ pub.totalPostsAutor }}
                </p>

                <!-- ADMINISTRACIÓN DEL ESTATUS DE LA PUBLICACIÓN -->
                <div class="author-item-footer" style="border-top: 1px solid var(--border-soft); padding-top: 0.6rem;">
                  <span class="category-tag mb-0" style="font-size: 0.68rem; font-weight: 700;">ADMINISTRAR ESTATUS:</span>
                  <div class="d-flex align-items-center gap-2">
                    <select
                      class="form-control"
                      style="width: auto; padding: 4px 10px; font-size: 0.75rem; font-weight: 700; cursor: pointer;"
                      :value="pub.estatus"
                      @change="cambiarEstatusPublicacionPanel(pub, $event.target.value)"
                      :disabled="actualizandoEstatusId === pub.id"
                    >
                      <option value="ACTIVO">ACTIVO</option>
                      <option value="INACTIVO">INACTIVO</option>
                      <option value="PENDIENTE_VERIFICACION">PENDIENTE_VERIFICACION</option>
                      <option value="SUSPENDIDO">SUSPENDIDO</option>
                      <option value="ELIMINADO">ELIMINADO</option>
                    </select>
                    <span v-if="actualizandoEstatusId === pub.id" class="text-secondary" style="font-size: 0.7rem;">Guardando...</span>
                  </div>
                </div>
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

          <!-- 2. AUTORES -->
          <section v-else-if="seccionPanel === 'autores'">
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

          <!-- 3. AUDITORÍA Y LOGS -->
          <section v-else-if="seccionPanel === 'logs'">
            <!-- Sub-navegación de pestañas -->
            <div class="d-flex gap-2 mb-4">
              <button
                type="button"
                class="btn-editorial"
                :style="subseccionLogs === 'metricas' ? 'background: var(--dark-text); color: white;' : 'background: white; color: var(--dark-text);'"
                @click="subseccionLogs = 'metricas'"
              >
                MÉTRICAS Y EVENTOS (BD)
              </button>
              <button
                type="button"
                class="btn-editorial"
                :style="subseccionLogs === 'archivo' ? 'background: var(--dark-text); color: white;' : 'background: white; color: var(--dark-text);'"
                @click="cambiarASubseccionArchivo"
              >
                ARCHIVO DE LOGS (ACCESO.LOG)
              </button>
            </div>

            <!-- 3.1 PESTAÑA: MÉTRICAS Y EVENTOS (BASE DE DATOS) -->
            <div v-if="subseccionLogs === 'metricas'">
              <!-- Tarjetas de Estadísticas Globales -->
              <div class="stats-grid mb-4">
                <div class="stat-card">
                  <span class="category-tag">TOTAL EVENTOS</span>
                  <h3 class="stat-number">{{ statsLogs.total_eventos || 0 }}</h3>
                </div>
                <div class="stat-card stat-card-danger">
                  <span class="category-tag">SOSPECHOSOS (BOTS)</span>
                  <h3 class="stat-number text-danger">{{ statsLogs.sospechosos || 0 }}</h3>
                </div>
                <div class="stat-card stat-card-warning">
                  <span class="category-tag">RATE LIMIT (429)</span>
                  <h3 class="stat-number text-warning">{{ statsLogs.bloqueados_rate_limit || 0 }}</h3>
                </div>
                <div class="stat-card stat-card-success">
                  <span class="category-tag">ACCESOS EXITOSOS</span>
                  <h3 class="stat-number text-success">{{ statsLogs.exitosos || 0 }}</h3>
                </div>
              </div>

              <!-- Filtros de Eventos -->
              <div class="filters-grid mb-4">
                <div>
                  <label class="category-tag mb-2">Buscar</label>
                  <input v-model="filtrosLogs.busqueda" type="text" class="form-control w-100" placeholder="Email, IP o Navegador">
                </div>
                <div>
                  <label class="category-tag mb-2">Evento</label>
                  <select v-model="filtrosLogs.tipo_evento" class="form-control w-100">
                    <option value="TODOS">Todos</option>
                    <option value="LOGIN">LOGIN</option>
                    <option value="LOGOUT">LOGOUT</option>
                  </select>
                </div>
                <div>
                  <label class="category-tag mb-2">Motivo</label>
                  <select v-model="filtrosLogs.motivo" class="form-control w-100">
                    <option value="TODOS">Todos</option>
                    <option value="EXITOSO">Exitoso</option>
                    <option value="BLOQUEADO_RATE_LIMIT">Bloqueado Rate Limit</option>
                    <option value="CAPTCHA_INVALIDO">Captcha Inválido</option>
                    <option value="CREDENCIALES_INVALIDAS">Credenciales Inválidas</option>
                    <option value="CAMPOS_REQUERIDOS">Campos Requeridos</option>
                  </select>
                </div>
                <div>
                  <label class="category-tag mb-2">Clasificación</label>
                  <select v-model="filtrosLogs.clasificacion" class="form-control w-100">
                    <option value="TODOS">Todos</option>
                    <option value="HUMANO">HUMANO</option>
                    <option value="SOSPECHOSO">SOSPECHOSO</option>
                    <option value="INDETERMINADO">INDETERMINADO</option>
                  </select>
                </div>
              </div>

              <!-- Lista de Eventos -->
              <div class="result-list">
                <div class="result-item" v-for="evento in eventosLogs" :key="evento.id_evento">
                  <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                    <p class="category-tag mb-0" style="color: var(--muted-text);">
                      #{{ evento.id_evento }} • {{ formatearFechaHora(evento.fecha_evento) }}
                    </p>
                    <div class="d-flex align-items-center gap-2">
                      <span
                        class="badge"
                        :class="evento.clasificacion_comportamiento === 'SOSPECHOSO' ? 'badge-danger' : (evento.clasificacion_comportamiento === 'HUMANO' ? 'badge-success' : '')"
                      >
                        {{ evento.clasificacion_comportamiento || 'INDETERMINADO' }}
                      </span>
                      <span
                        class="badge"
                        :class="evento.motivo === 'EXITOSO' ? 'badge-success' : 'badge-danger'"
                      >
                        {{ evento.motivo }}
                      </span>
                    </div>
                  </div>

                  <h3 class="result-title" style="font-size: 1.1rem; margin-bottom: 0.35rem;">
                    {{ evento.tipo_evento }}: {{ evento.email_ingresado || (evento.nombre ? evento.nombre + ' ' + (evento.primer_apellido || '') : 'Anónimo') }}
                  </h3>

                  <div class="d-flex align-items-center gap-4 flex-wrap text-secondary" style="font-size: 0.8rem; margin-bottom: 0.5rem;">
                    <span><strong>IP:</strong> {{ evento.direccion_ip || 'No registrada' }}</span>
                    <span><strong>Duración:</strong> {{ evento.duracion_ms ? evento.duracion_ms + ' ms' : '0 ms' }}</span>
                    <span v-if="evento.agente_usuario" class="text-truncate" style="max-width: 350px;" :title="evento.agente_usuario">
                      <strong>UA:</strong> {{ evento.agente_usuario }}
                    </span>
                  </div>

                  <div class="d-flex justify-content-end mt-2" v-if="evento.comportamiento">
                    <button
                      type="button"
                      class="author-action-btn"
                      @click="verDetallesComportamiento(evento)"
                    >
                      VER DETALLES DE INTERACCIÓN
                    </button>
                  </div>
                </div>

                <!-- Paginación de Logs -->
                <div class="pagination-container text-center mt-5 mb-4" v-if="totalPaginasLogs > 1">
                  <button type="button" class="pagination-number pagination-nav" :disabled="paginaLogsActual === 1" @click="cambiarPaginaLogs(paginaLogsActual - 1)">Anterior</button>
                  <button
                    v-for="p in totalPaginasLogs"
                    :key="'p-log-' + p"
                    type="button"
                    class="pagination-number"
                    :class="{ active: paginaLogsActual === p }"
                    @click="cambiarPaginaLogs(p)"
                  >
                    {{ p }}
                  </button>
                  <button type="button" class="pagination-number pagination-nav" :disabled="paginaLogsActual >= totalPaginasLogs" @click="cambiarPaginaLogs(paginaLogsActual + 1)">Siguiente</button>
                </div>

                <p v-if="eventosLogs.length === 0" class="text-secondary text-center empty-state">
                  No hay eventos registrados con los filtros seleccionados.
                </p>
              </div>
            </div>

            <!-- 3.2 PESTAÑA: ARCHIVO DE LOGS FÍSICO (ACCESO.LOG) -->
            <div v-else>
              <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
                <div class="d-flex align-items-center gap-3">
                  <span class="category-tag">LÍNEAS A MOSTRAR:</span>
                  <select v-model="maxLineasArchivo" class="form-control" style="width: auto; padding: 4px 8px;" @change="cargarLogsArchivo">
                    <option :value="50">50 líneas</option>
                    <option :value="100">100 líneas</option>
                    <option :value="200">200 líneas</option>
                    <option :value="500">500 líneas</option>
                  </select>
                  <button type="button" class="btn-editorial" style="padding: 6px 14px; font-size: 0.75rem;" @click="cargarLogsArchivo" :disabled="cargandoArchivoLogs">
                    {{ cargandoArchivoLogs ? 'CARGANDO...' : '↻ REFRESCAR' }}
                  </button>
                </div>
                <div>
                  <a
                    href="/api/admin/logs/archivo/descargar"
                    target="_blank"
                    class="btn-editorial"
                    style="padding: 6px 14px; font-size: 0.75rem; text-decoration: none;"
                  >
                    ⬇ DESCARGAR ACCESO.LOG
                  </a>
                </div>
              </div>

              <div class="terminal-container">
                <div class="terminal-header">
                  <span class="terminal-dot red"></span>
                  <span class="terminal-dot yellow"></span>
                  <span class="terminal-dot green"></span>
                  <span class="terminal-title">logs/acceso.log</span>
                  <span class="terminal-count">{{ lineasArchivoLogs.length }} líneas</span>
                </div>
                <pre class="terminal-body"><code v-if="lineasArchivoLogs.length > 0">{{ lineasArchivoLogs.join('\n') }}</code><code v-else class="text-secondary">El archivo de logs aún no contiene registros.</code></pre>
              </div>
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

    <!-- MODAL DETALLES DE COMPORTAMIENTO Y HUELLA -->
    <div v-if="mostrarModalDetalles" class="modal-backdrop" @click.self="mostrarModalDetalles = false">
      <div class="modal-card" style="max-width: 650px;">
        <div class="d-flex align-items-center justify-content-between mb-3" style="border-bottom: 1px solid var(--border-soft); padding-bottom: 0.8rem;">
          <h4 class="section-title" style="font-size: 1.1rem;">DETALLES DE INTERACCIÓN Y HUELLA</h4>
          <button type="button" class="btn-editorial" style="padding: 4px 10px;" @click="mostrarModalDetalles = false">✕ CERRAR</button>
        </div>

        <div v-if="eventoDetalleSeleccionado">
          <div class="stats-grid mb-3">
            <div class="stat-card">
              <span class="category-tag">MOVIMIENTOS MOUSE</span>
              <h4 class="stat-number" style="font-size: 1.2rem;">{{ eventoDetalleSeleccionado.comportamiento?.mousemove_count ?? '0' }}</h4>
            </div>
            <div class="stat-card">
              <span class="category-tag">TECLAS (KEYDOWN/KEYUP)</span>
              <h4 class="stat-number" style="font-size: 1.2rem;">
                {{ (eventoDetalleSeleccionado.comportamiento?.keydown_count ?? 0) || (eventoDetalleSeleccionado.comportamiento?.keyup_count ?? 0) }}
              </h4>
            </div>
            <div class="stat-card">
              <span class="category-tag">FOCUS A SUBMIT</span>
              <h4 class="stat-number" style="font-size: 1.2rem;">{{ eventoDetalleSeleccionado.comportamiento?.focus_submit_ms ?? 0 }} ms</h4>
            </div>
            <div class="stat-card" :class="eventoDetalleSeleccionado.comportamiento?.navigator_webdriver ? 'stat-card-danger' : 'stat-card-success'">
              <span class="category-tag">NAVIGATOR.WEBDRIVER</span>
              <h4 class="stat-number" style="font-size: 1.2rem;" :class="eventoDetalleSeleccionado.comportamiento?.navigator_webdriver ? 'text-danger' : 'text-success'">
                {{ eventoDetalleSeleccionado.comportamiento?.navigator_webdriver ? 'DETECTADO' : 'NO' }}
              </h4>
            </div>
          </div>

          <label class="category-tag mb-2">PAYLOAD COMPLETO DE COMPORTAMIENTO (JSONB):</label>
          <pre class="terminal-body" style="max-height: 250px; background: #0f172a; color: #38bdf8; font-size: 0.75rem; padding: 1rem; border-radius: 4px; overflow-x: auto;"><code>{{ JSON.stringify(eventoDetalleSeleccionado.comportamiento, null, 2) }}</code></pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { api, formatearFecha } from '../services/api.js'
import BotonRegresar from '../components/BotonRegresar.vue'

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
const nuevoAutorPanel = ref({ nombre: '', primer_apellido: '', segundo_apellido: '', sexo: '', email: '', biografia: '', contrasena: '' })

// Variables de estado para Auditoría y Logs
const subseccionLogs = ref('metricas') // 'metricas' o 'archivo'
const eventosLogs = ref([])
const statsLogs = ref({ total_eventos: 0, sospechosos: 0, bloqueados_rate_limit: 0, exitosos: 0, fallidos: 0 })
const paginaLogsActual = ref(1)
const totalPaginasLogs = ref(1)
const filtrosLogs = ref({ busqueda: '', tipo_evento: 'TODOS', motivo: 'TODOS', clasificacion: 'TODOS' })
const timerBusquedaLogs = ref(null)

const lineasArchivoLogs = ref([])
const maxLineasArchivo = ref(100)
const cargandoArchivoLogs = ref(false)

const mostrarModalDetalles = ref(false)
const eventoDetalleSeleccionado = ref(null)

const publicacionesFiltradasPanel = computed(() => publicacionesPanel.value)
const autoresFiltradosPanel = computed(() => autoresPanel.value)
const paginasPublicacionesVisibles = computed(() => construirPaginadoVisible(totalPaginasPublicaciones.value, paginaPublicacionesActual.value))
const paginasAutoresVisibles = computed(() => construirPaginadoVisible(totalPaginasAutores.value, paginaAutoresActual.value))

watch(() => filtrosPublicacionesPanel.value.autor, () => dispararBusquedaPublicaciones())
watch(() => filtrosPublicacionesPanel.value.estatus, () => dispararBusquedaPublicaciones())
watch(() => filtrosPublicacionesPanel.value.fechaDesde, () => dispararBusquedaPublicaciones())
watch(() => filtrosPublicacionesPanel.value.fechaHasta, () => dispararBusquedaPublicaciones())
watch(filtroAutoresPanel, () => dispararBusquedaAutores())

watch(() => filtrosLogs.value.busqueda, () => dispararBusquedaLogs())
watch(() => filtrosLogs.value.tipo_evento, () => dispararBusquedaLogs())
watch(() => filtrosLogs.value.motivo, () => dispararBusquedaLogs())
watch(() => filtrosLogs.value.clasificacion, () => dispararBusquedaLogs())

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
  const limit = 10
  const params = new URLSearchParams()
  if (filtrosPublicacionesPanel.value.autor) params.set('autor', filtrosPublicacionesPanel.value.autor)
  if (filtrosPublicacionesPanel.value.estatus) params.set('estatus', filtrosPublicacionesPanel.value.estatus)
  if (filtrosPublicacionesPanel.value.fechaDesde) params.set('fechaDesde', filtrosPublicacionesPanel.value.fechaDesde)
  if (filtrosPublicacionesPanel.value.fechaHasta) params.set('fechaHasta', filtrosPublicacionesPanel.value.fechaHasta)
  params.set('limit', String(limit))
  params.set('offset', String(pagina * limit))
  try {
    const payload = await api.get(`/api/admin/panel?${params.toString()}`)
    const articulos = Array.isArray(payload) ? payload : (payload.publicaciones || [])
    const total = Array.isArray(payload) ? articulos.length : (payload.total || 0)
    publicacionesPanel.value = articulos.map((pub) => ({
      id: pub.id_publicacion,
      titulo: pub.titulo,
      estatus: pub.estado_publicacion,
      fecha: pub.fecha_publicacion,
      autor: `${pub.autor_nombre || ''} ${pub.primer_apellido || ''} ${pub.segundo_apellido || ''}`.trim() || 'Desconocido',
      totalPostsAutor: pub.total_posts_autor ?? 0,
    }))
    totalPaginasPublicaciones.value = Math.ceil(total / limit)
  } catch (e) { if (e.status === 401) router.push('/login') }
}

const actualizandoEstatusId = ref(null)

async function cambiarEstatusPublicacionPanel(pub, nuevoEstatus) {
  if (!pub || pub.estatus === nuevoEstatus) return

  if (nuevoEstatus === 'ELIMINADO') {
    if (!confirm(`¿Estás seguro de marcar la publicación "${pub.titulo}" como ELIMINADA?`)) {
      return
    }
  }

  const estatusAnterior = pub.estatus
  pub.estatus = nuevoEstatus
  actualizandoEstatusId.value = pub.id

  try {
    await api.put(`/api/admin/publicaciones/${pub.id}/estatus`, {
      estatus: nuevoEstatus
    })
  } catch (err) {
    console.error('Error al actualizar estatus de publicación:', err)
    pub.estatus = estatusAnterior
    alert(err.data?.error || 'No fue posible actualizar el estatus de la publicación')
  } finally {
    actualizandoEstatusId.value = null
  }
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
    autoresPanel.value = autoresDB.map((autor) => ({ id: autor.id_autor, nombre: autor.nombre, primer_apellido: autor.primer_apellido, segundo_apellido: autor.segundo_apellido, sexo: autor.cod_sexo, email: autor.email, biografia: autor.biografia, estatus: autor.estado_autor || autor.estado_usuario || 'ACTIVO' }))
    totalPaginasAutores.value = Math.ceil(total / limitStr)
  } catch (e) { if (e.status === 401) router.push('/login') }
}

// Métodos para Auditoría y Logs
async function cargarLogsAuditoria(pagina = 1) {
  try {
    paginaLogsActual.value = pagina
    const params = new URLSearchParams({
      page: String(pagina),
      limit: '15',
      tipo_evento: filtrosLogs.value.tipo_evento,
      motivo: filtrosLogs.value.motivo,
      clasificacion: filtrosLogs.value.clasificacion,
      busqueda: filtrosLogs.value.busqueda
    })
    const res = await api.get(`/api/admin/logs?${params.toString()}`)
    eventosLogs.value = res.eventos || []
    statsLogs.value = res.stats || statsLogs.value
    totalPaginasLogs.value = res.totalPaginas || 1
  } catch (err) {
    console.error('Error al cargar logs de auditoría:', err)
  }
}

function dispararBusquedaLogs() {
  if (timerBusquedaLogs.value) clearTimeout(timerBusquedaLogs.value)
  timerBusquedaLogs.value = setTimeout(() => cargarLogsAuditoria(1), 300)
}

function cambiarPaginaLogs(p) {
  if (p >= 1 && p <= totalPaginasLogs.value) {
    cargarLogsAuditoria(p)
  }
}

async function cargarLogsArchivo() {
  cargandoArchivoLogs.value = true
  try {
    const res = await api.get(`/api/admin/logs/archivo?lineas=${maxLineasArchivo.value}`)
    lineasArchivoLogs.value = res.lineas || []
  } catch (err) {
    console.error('Error al cargar archivo de logs:', err)
  } finally {
    cargandoArchivoLogs.value = false
  }
}

function cambiarASubseccionArchivo() {
  subseccionLogs.value = 'archivo'
  cargarLogsArchivo()
}

function verDetallesComportamiento(evento) {
  eventoDetalleSeleccionado.value = evento
  mostrarModalDetalles.value = true
}

function formatearFechaHora(fechaStr) {
  if (!fechaStr) return '-'
  const d = new Date(fechaStr)
  return d.toLocaleString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
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
  else if (seccion === 'autores') cargarAutoresPanel()
  else if (seccion === 'logs') {
    if (subseccionLogs.value === 'metricas') cargarLogsAuditoria(1)
    else cargarLogsArchivo()
  }
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
  nuevoAutorPanel.value = { nombre: '', primer_apellido: '', segundo_apellido: '', sexo: '', email: '', biografia: '', contrasena: '' }
}

function editarAutorPanel(autor) {
  errorMsg.value = ''
  editandoAutorPanelId.value = autor.id
  nuevoAutorPanel.value = { nombre: autor.nombre || '', primer_apellido: autor.primer_apellido || '', segundo_apellido: autor.segundo_apellido || '', sexo: autor.sexo || '', email: autor.email || '', biografia: autor.biografia || '', contrasena: '' }
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
    biografia: nuevoAutorPanel.value.biografia.trim(),
    contrasena: nuevoAutorPanel.value.contrasena,
  }
  const completo = payload.nombre && payload.primer_apellido && payload.segundo_apellido && payload.cod_sexo && payload.email && payload.biografia
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

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: var(--pure-white);
  border: 1px solid var(--border-soft);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.stat-card-danger {
  border-left: 3px solid #b42318;
}

.stat-card-warning {
  border-left: 3px solid #f59e0b;
}

.stat-card-success {
  border-left: 3px solid #16a34a;
}

.stat-number {
  font-size: 1.8rem;
  font-weight: 900;
  margin: 0.3rem 0 0;
  line-height: 1;
}

.badge-danger {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #f87171;
}

.badge-success {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #4ade80;
}

.badge-warning {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fcd34d;
}

.terminal-container {
  background: #0f172a;
  border: 1px solid var(--border-dark);
  border-radius: 4px;
  overflow: hidden;
}

.terminal-header {
  background: #1e293b;
  padding: 0.5rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid #334155;
}

.terminal-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.terminal-dot.red { background: #ef4444; }
.terminal-dot.yellow { background: #f59e0b; }
.terminal-dot.green { background: #10b981; }

.terminal-title {
  color: #94a3b8;
  font-size: 0.75rem;
  font-family: monospace;
  font-weight: 700;
  margin-left: 0.5rem;
}

.terminal-count {
  margin-left: auto;
  color: #64748b;
  font-size: 0.7rem;
  font-family: monospace;
}

.terminal-body {
  padding: 1rem 1.25rem;
  margin: 0;
  max-height: 480px;
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.78rem;
  line-height: 1.5;
  color: #38bdf8;
  background: #0f172a;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
