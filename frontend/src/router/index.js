import { createRouter, createWebHistory } from 'vue-router'
import Inicio from '../views/Inicio.vue'
import Login from '../views/Login.vue'
import Registro from '../views/Registro.vue'
import Articulo from '../views/Articulo.vue'
import Admin from '../views/Admin.vue'
import AdminPanel from '../views/AdminPanel.vue'

const routes = [
  { path: '/', redirect: '/inicio' },
  { path: '/inicio', name: 'Inicio', component: Inicio },
  { path: '/login', name: 'Login', component: Login },
  { path: '/registro', name: 'Registro', component: Registro },
  { path: '/articulo/:id', name: 'Articulo', component: Articulo },
  { path: '/admin', name: 'Admin', component: Admin, meta: { requiresAuth: true } },
  { path: '/admin-panel', name: 'AdminPanel', component: AdminPanel, meta: { requiresAuth: true, requiresAdmin: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Navigation guard for auth
router.beforeEach(async (to) => {
  if (to.meta.requiresAuth) {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) {
        return { name: 'Login' }
      }
      const data = await res.json()
      const rol = ((data.usuario || data.autor)?.rol || '').toUpperCase()
      if (to.meta.requiresAdmin && rol !== 'ADMIN') {
        return { name: 'Admin' }
      }
    } catch {
      return { name: 'Login' }
    }
  }
})


// Agrega esta línea justo antes de configurar la sesión para que Render permita las cookies seguras
app.set('trust proxy', 1);

// Configuración de Sesiones
app.use(session({
    secret: process.env.SESSION_SECRET || 'super_secreto_blog',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true, // Siempre true cuando cruzas dominios con HTTPS
        sameSite: 'none', // <--- ESTO ES VITAL: Permite que la cookie viaje a otro dominio
        maxAge: 1000 * 60 * 60 * 24 // 1 día
    }
}));
export default router
