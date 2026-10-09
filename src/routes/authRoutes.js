const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/registro', authController.registrar);
router.get('/captcha', authController.obtenerCaptcha);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', authController.obtenerUsuarioActual); 
router.get('/sexos', authController.obtenerSexos);

module.exports = router;
