const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requerirCsrf } = require('../middleware/csrf');

// Middleware: verifica que el usuario esté autenticado
const requerirAutenticacion = (req, res, next) => {
    if (!req.session.usuarioId) {
        return res.status(401).json({ error: 'Acceso denegado. Por favor, inicia sesión.' });
    }
    next();
};

// Middleware: verifica que el usuario sea ADMIN
const requerirAdmin = (req, res, next) => {
    const rol = (req.session.usuarioRol || '').toUpperCase();
    if (rol !== 'ADMIN') {
        return res.status(403).json({ error: 'Acceso restringido al administrador.' });
    }
    next();
};

// Aplicar autenticación a todas las rutas
router.use(requerirAutenticacion);
router.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        return requerirCsrf(req, res, next);
    }
    next();
});

// Rutas accesibles por AUTOR y ADMIN
router.get('/panel', adminController.panelAdmin);
router.post('/publicaciones', adminController.crearPublicacion);
router.get('/publicaciones/:id', adminController.obtenerPublicacionParaEditar);
router.put('/publicaciones/:id', adminController.actualizarPublicacion);
router.delete('/publicaciones/:id', adminController.eliminarPublicacion);

// Rutas SOLO para ADMIN
router.get('/autores', requerirAdmin, adminController.listarAutores);
router.post('/autores', requerirAdmin, adminController.crearAutor);
router.put('/autores/:id', requerirAdmin, adminController.actualizarAutor);
router.delete('/autores/:id', requerirAdmin, adminController.eliminarAutor);

// Administración de Estatus de Publicaciones (SOLO para ADMIN)
router.put('/publicaciones/:id/estatus', requerirAdmin, adminController.cambiarEstatusPublicacion);
router.patch('/publicaciones/:id/estatus', requerirAdmin, adminController.cambiarEstatusPublicacion);

// Rutas de Auditoría y Logs (SOLO para ADMIN)
router.get('/logs', requerirAdmin, adminController.obtenerLogsAuditoria);
router.get('/logs/archivo', requerirAdmin, adminController.obtenerLogsArchivo);
router.get('/logs/archivo/descargar', requerirAdmin, adminController.descargarLogsArchivo);

module.exports = router;
