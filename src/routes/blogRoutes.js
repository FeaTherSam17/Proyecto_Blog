const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const {
    concederAccesoBlog,
    requerirAccesoBlog
} = require('../middleware/blogAccess');

router.post('/access', concederAccesoBlog);

// Rutas públicas (no requieren sesión)
router.get('/posts', requerirAccesoBlog, blogController.obtenerTodas);
router.get('/posts/:id', requerirAccesoBlog, blogController.obtenerPorId);
router.get('/categorias', requerirAccesoBlog, blogController.obtenerCategorias);
module.exports = router;
