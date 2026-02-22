const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/registro', authController.registrar);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', authController.obtenerUsuarioActual); // Para chequear si el usuario está logueado

module.exports = router;
