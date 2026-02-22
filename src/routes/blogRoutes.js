const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');

// Rutas públicas (no requieren sesión)
router.get('/posts', blogController.obtenerTodas);
router.get('/posts/:id', blogController.obtenerPorId);

module.exports = router;
