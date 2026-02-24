const bcrypt = require('bcryptjs');
const usuarioModel = require('../models/usuarioModel');

const registrar = async (req, res) => {
    try {
        const { nombre, primer_apellido, segundo_apellido, cod_sexo, email, telefono, biografia, contrasena } = req.body;

        // Validaciones básicas que deberían estar también en frontend
        if (!nombre || !email || !telefono || !biografia || !contrasena || !cod_sexo) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }

        if (!primer_apellido && !segundo_apellido) {
            return res.status(400).json({ error: 'Debes proporcionar al menos un apellido' });
        }       

        // Revisar si el email ya existe
        const usuarioExistente = await usuarioModel.buscarAutorPorEmail(email);
        if (usuarioExistente) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }

        const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'El formato del email es inválido' });
        }

        
        const telefonoRegex = /^[0-9]{10}$/;
        if (!telefonoRegex.test(telefono)) {
            return res.status(400).json({ error: 'El teléfono debe tener exactamente 10 números' });
        }

        // Validar límite de biografía
        if (biografia.length > 500) {
            return res.status(400).json({ error: 'La biografía no puede exceder los 500 caracteres' });
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
        res.clearCookie('connect.sid'); 
        res.json({ mensaje: 'Sesión cerrada', redireccionar: '/inicio.html' }); 
    });
};

const obtenerUsuarioActual = async (req, res) => {
    if (!req.session.usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    try {
        // 1. Usamos la función segura que busca por ID (no trae contraseñas)
        const autor = await usuarioModel.obtenerAutorPorId(req.session.usuarioId); 
        // 2. Por seguridad, validamos que el autor realmente exista
        if (!autor) {
            return res.status(404).json({ error: 'Autor no encontrado' });
        }
        // 3. Enviamos el objeto 'autor' completo a Vue
        res.json({ autor: autor }); 
    } catch (err) {
        console.error('Error al obtener el usuario actual:', err);
        res.status(500).json({ error: 'Error de servidor' });
    }
}

const obtenerSexos = async (req, res) => {
    try {
        const sexos = await usuarioModel.obtenerSexos();
        res.json(sexos);
    } catch (error) {
        console.error('Error al obtener sexos:', error);
        res.status(500).json({ error: 'Error al obtener el catálogo de sexos' });
    }
};


module.exports = {
    registrar,
    login,
    logout,
    obtenerUsuarioActual,
    obtenerSexos
};
