const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { loginRateLimiter, registrationRateLimiter } = require('../middleware/rateLimiter');
const { obtenerTokenCsrf, requerirCsrf } = require('../middleware/csrf');

// El frontend obtiene este token antes de enviar cambios de estado.
router.get('/csrf-token', obtenerTokenCsrf);
// El registro limita automatizaciones y exige prueba de origen/sesion.
router.post('/registro', registrationRateLimiter, requerirCsrf, authController.registrar);
router.post('/reenviar-verificacion', registrationRateLimiter, requerirCsrf, authController.reenviarVerificacion);
router.get('/captcha', authController.obtenerCaptcha);
router.post('/login', loginRateLimiter, requerirCsrf, authController.login);
router.post('/logout', requerirCsrf, authController.logout);
router.get('/me', authController.obtenerUsuarioActual); 
router.get('/sexos', authController.obtenerSexos);
// Verificar el correo no requiere sesion: el token del enlace es la credencial
// temporal y de un solo uso para activar la cuenta.
router.get('/verificar-correo', authController.verificarEmail);

module.exports = router;
