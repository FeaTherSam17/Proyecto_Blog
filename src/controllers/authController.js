const bcrypt = require('bcryptjs');
const usuarioModel = require('../models/usuarioModel');

const registrar = async (req, res) => {
    try {
        const { nombre, primer_apellido, segundo_apellido, cod_sexo, email, telefono, biografia, contrasena } = req.body;

        // Validaciones básicas que deberían estar también en frontend
        if (!nombre || !email || !telefono || !biografia || !contrasena || !cod_sexo) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }

        // Revisar si el email ya existe
        const usuarioExistente = await usuarioModel.buscarAutorPorEmail(email);
        if (usuarioExistente) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }

        // Hashear contraseña
        const salt = await bcrypt.genSalt(10);
        const contrasenaHasheada = await bcrypt.hash(contrasena, salt);

        // Guardar en BD
        const nuevoAutor = {
            nombre,
            primer_apellido,
            segundo_apellido,
            cod_sexo,
            email,
            telefono,
            biografia,
            contrasena: contrasenaHasheada
        };

        const resultado = await usuarioModel.registrarAutor(nuevoAutor);
        res.status(201).json({ mensaje: 'Autor registrado exitosamente', autor: resultado });
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ error: 'Error interno del servidor al registrar' });
    }
};

const login = async (req, res) => {
    try {
        const { email, contrasena } = req.body;

        if (!email || !contrasena) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos' });
        }

        const autor = await usuarioModel.buscarAutorPorEmail(email);
        if (!autor) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Verificar contraseña
        const esValida = await bcrypt.compare(contrasena, autor.contrasena);
        if (!esValida) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Guardar sesión
        req.session.usuarioId = autor.id_autor;
        req.session.usuarioNombre = autor.nombre;
        req.session.usuarioEmail = autor.email;

        res.json({ mensaje: 'Login exitoso', redireccionar: '/admin.html' });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor en el login' });
    }
};

const logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Error al cerrar sesión' });
        }
        res.clearCookie('connect.sid'); // Limpia la cookie de sesión por defecto de express-session
        res.json({ mensaje: 'Sesión cerrada', redireccionar: '/login.html' });
    });
};

const obtenerUsuarioActual = async (req, res) => {
    if (!req.session.usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    try {
        const autor = await usuarioModel.buscarAutorPorEmail(req.session.usuarioEmail); // Necesitaremos cambiar esto o usar id
        res.json({ autor: { nombre: req.session.usuarioNombre, id: req.session.usuarioId } });
    } catch (err) {
        res.status(500).json({ error: 'Error de servidor' });
    }
}


module.exports = {
    registrar,
    login,
    logout,
    obtenerUsuarioActual
};
