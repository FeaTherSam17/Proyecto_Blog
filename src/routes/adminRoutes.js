const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Middleware para verificar que el usuario esté autenticado
const requerirAutenticacion = (req, res, next) => {
    if (!req.session.usuarioId) {
        return res.status(401).json({ error: 'Acceso denegado. Por favor, inicia sesión.' });
    }
    next();
};

// Aplicar middleware a todas las rutas de este router
router.use(requerirAutenticacion);

// Rutas privadas
router.get('/panel', adminController.panelAdmin);
router.get('/autores', adminController.listarAutores);
router.post('/publicaciones', adminController.crearPublicacion);
router.get('/publicaciones/:id', adminController.obtenerPublicacionParaEditar);
router.put('/publicaciones/:id', adminController.actualizarPublicacion);
router.delete('/publicaciones/:id', adminController.eliminarPublicacion);

module.exports = router;
