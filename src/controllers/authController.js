const usuarioModel = require('../models/usuarioModel');
const crypto = require('crypto');

// Configuración de límites de intentos de login y CAPTCHA
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_BLOCK_TIME_MS = 60 * 1000;

const MAX_CAPTCHA_LENGTH = 4;
// Mapa para almacenar los intentos de login por IP
const loginAttempts = new Map();

//Funcion para obtener la clave de rate limit basada en la IP del cliente
function obtenerClaveRateLimit(req) {
    return req.ip || req.socket.remoteAddress || 'unknown';
}

//Funcion para obtener el estado de rate limit para la IP del cliente
function obtenerEstadoRateLimit(req) {
    const key = obtenerClaveRateLimit(req);
    const estado = loginAttempts.get(key);

    if (!estado) {
        return { key, attempts: 0, blockedUntil: 0 };
    }

    if (estado.blockedUntil && estado.blockedUntil <= Date.now()) {
        loginAttempts.delete(key);
        return { key, attempts: 0, blockedUntil: 0 };
    }

    return { key, ...estado };
}

function registrarIntentoFallido(key) {
    const estado = loginAttempts.get(key) || { attempts: 0, blockedUntil: 0 };
    estado.attempts += 1;

    if (estado.attempts >= MAX_LOGIN_ATTEMPTS) {
        estado.blockedUntil = Date.now() + LOGIN_BLOCK_TIME_MS;
    }

    loginAttempts.set(key, estado);
    return estado;
}

function limpiarIntentos(key) {
    loginAttempts.delete(key);
}

function analizarComportamiento(comportamiento) {
    // El cliente puede alterar estos datos, por eso el servidor los valida y limita.
    if (!comportamiento || typeof comportamiento !== 'object') {
        return { datos: null, clasificacion: 'INDETERMINADO' };
    }

    const limitarEntero = (valor, maximo) => {
        const numero = Number(valor);
        return Number.isInteger(numero) ? Math.max(0, Math.min(numero, maximo)) : 0;
    };
    const limitarMilisegundos = (valor) => limitarEntero(valor, 15 * 60 * 1000);
    const intervalos = Array.isArray(comportamiento.keyup_intervals_ms)
        ? comportamiento.keyup_intervals_ms
            .slice(0, 100)
            .map(limitarMilisegundos)
        : [];
    const datos = {
        mousemove_count: limitarEntero(comportamiento.mousemove_count, 100000),
        keyup_count: limitarEntero(comportamiento.keyup_count, 1000),
        keyup_intervals_ms: intervalos,
        focus_submit_ms: limitarMilisegundos(comportamiento.focus_submit_ms),
        send_keys_detected: comportamiento.send_keys_detected === true
    };

    // La clasificación es una señal orientativa; no sustituye contraseña ni CAPTCHA
    // y actualmente no bloquea por sí sola al usuario.
    const sinMovimiento = datos.mousemove_count === 0;
    const sinTeclas = datos.keyup_count === 0;
    const sinTiempoHumano = datos.focus_submit_ms === 0;
    const clasificacion = sinMovimiento && sinTeclas && sinTiempoHumano
        ? 'SOSPECHOSO'
        : datos.keyup_count > 0 || datos.mousemove_count > 0
            ? 'HUMANO'
            : 'INDETERMINADO';

    return { datos, clasificacion };
}

async function registrarMetricaAcceso(req, datos, inicio = Date.now()) {
    try {
        // La IP, el navegador y la duración se obtienen en el servidor para evitar
        // depender completamente de valores enviados por el cliente.
        await usuarioModel.registrarEventoAcceso({
            ...datos,
            direccion_ip: req.ip || req.socket.remoteAddress || null,
            agente_usuario: req.get('user-agent') || null,
            duracion_ms: Math.max(0, Date.now() - inicio),
            comportamiento: {
                ...(datos.comportamiento || {}),
                bot_detection: req.botAssessment || null
            },
            clasificacion_comportamiento: datos.clasificacion_comportamiento
                || req.botAssessment?.level
                || 'INDETERMINADO'
        });
    } catch (error) {
        // Un fallo de métricas no debe impedir el acceso, pero sí debe quedar visible.
        console.error('Error al registrar métrica de acceso:', error);
    }
}

function generarCaptcha() {
    let numero1 = crypto.randomInt(1, 11);
    let numero2 = crypto.randomInt(1, 11);
    if (numero1 < numero2) {
        [numero1, numero2] = [numero2, numero1];
    }
    const operaciones = [
        { simbolo: '+', respuesta: numero1 + numero2 },
        { simbolo: '-', respuesta: numero1 - numero2 },
        { simbolo: '*', respuesta: numero1 * numero2 }
    ];
    const operacion = operaciones[crypto.randomInt(0, operaciones.length)];

    return {
        pregunta: `${numero1} ${operacion.simbolo} ${numero2}`,
        respuesta: String(operacion.respuesta)
    };
}

const obtenerCaptcha = (req, res) => {
    const captcha = generarCaptcha();
    req.session.captcha = captcha;
    res.json({ pregunta: captcha.pregunta });
};

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

        if (nombre.length > 50) {
            return res.status(400).json({ error: 'El nombre no puede exceder los 50 caracteres' });
        }
        
        if (primer_apellido && primer_apellido.length > 50) {
            return res.status(400).json({ error: 'El primer apellido no puede exceder los 50 caracteres' });
        }
        
        if (segundo_apellido && segundo_apellido.length > 50) {
            return res.status(400).json({ error: 'El segundo apellido no puede exceder los 50 caracteres' });
        }

        if (email.length > 150) {
            return res.status(400).json({ error: 'El email no puede exceder los 150 caracteres' });
        }

        // Revisar si el email ya existe
        const usuarioExistente = await usuarioModel.buscarUsuarioPorEmail(email);
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

        // Guardar en BD
        const nuevoAutor = {
            nombre,
            primer_apellido,
            segundo_apellido,
            cod_sexo,
            email,
            telefono,
            biografia,
            contrasena: contrasena
        };

        const resultado = await usuarioModel.registrarAutor(nuevoAutor);
        res.status(201).json({ mensaje: 'Autor registrado exitosamente', autor: resultado });
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ error: 'Error interno del servidor al registrar' });
    }
};

const login = async (req, res) => {
    const inicio = Date.now();
    const rateLimit = obtenerEstadoRateLimit(req);
    if (rateLimit.blockedUntil) {
        const retryAfter = Math.ceil((rateLimit.blockedUntil - Date.now()) / 1000);
        res.set('Retry-After', String(retryAfter));
        await registrarMetricaAcceso(req, {
            email_ingresado: req.body?.email || null,
            tipo_evento: 'LOGIN',
            motivo: 'BLOQUEADO_RATE_LIMIT'
        }, inicio);
        return res.status(429).json({
            error: `Demasiados intentos. Intenta de nuevo en ${retryAfter} segundos`,
            retryAfter
        });
    }

    try {
        const { email, contrasena, captchaRespuesta, comportamiento } = req.body;
        // Se analiza el comportamiento antes de validar credenciales para conservar
        // evidencia de todos los intentos, incluso los que terminan en error.
        const analisisComportamiento = analizarComportamiento(comportamiento);
        const nivelCliente = analisisComportamiento.clasificacion;
        const nivelServidor = req.botAssessment?.level;
        const clasificacionComportamiento = nivelServidor === 'ALTO'
            || nivelCliente === 'SOSPECHOSO'
            ? 'SOSPECHOSO'
            : nivelServidor === 'MEDIO'
                ? 'INDETERMINADO'
                : nivelCliente;
        const datosComportamiento = {
            comportamiento: analisisComportamiento.datos,
            clasificacion_comportamiento: clasificacionComportamiento
        };

        if (!email || !contrasena) {
            registrarIntentoFallido(rateLimit.key);
            await registrarMetricaAcceso(req, {
                email_ingresado: email || null,
                tipo_evento: 'LOGIN',
                motivo: 'CAMPOS_REQUERIDOS',
                ...datosComportamiento
            }, inicio);
            return res.status(400).json({ error: 'Email y contraseña son requeridos' });
        }

        if (!/^\d{1,4}$/.test(String(captchaRespuesta || ''))) {
            registrarIntentoFallido(rateLimit.key);
            await registrarMetricaAcceso(req, {
                email_ingresado: email,
                tipo_evento: 'LOGIN',
                motivo: 'CAPTCHA_INVALIDO',
                ...datosComportamiento
            }, inicio);
            return res.status(400).json({
                error: `El captcha solo acepta números de hasta ${MAX_CAPTCHA_LENGTH} caracteres`
            });
        }

        const captcha = req.session.captcha;
        if (!captcha || String(captchaRespuesta).trim() !== captcha.respuesta) {
            registrarIntentoFallido(rateLimit.key);
            await registrarMetricaAcceso(req, {
                email_ingresado: email,
                tipo_evento: 'LOGIN',
                motivo: 'CAPTCHA_INVALIDO',
                ...datosComportamiento
            }, inicio);
            return res.status(400).json({ error: 'El resultado del captcha es incorrecto' });
        }
        delete req.session.captcha;

        const usuario = await usuarioModel.buscarUsuarioPorEmail(email);
        if (!usuario) {
            registrarIntentoFallido(rateLimit.key);
            await registrarMetricaAcceso(req, {
                email_ingresado: email,
                tipo_evento: 'LOGIN',
                motivo: 'CREDENCIALES_INVALIDAS',
                ...datosComportamiento
            }, inicio);
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        if (usuario.estado_usuario !== 'ACTIVO') {
            registrarIntentoFallido(rateLimit.key);
            await registrarMetricaAcceso(req, {
                id_usuario: usuario.id_usuario,
                email_ingresado: email,
                tipo_evento: 'LOGIN',
                motivo: 'USUARIO_INACTIVO',
                ...datosComportamiento
            }, inicio);
            return res.status(403).json({ error: 'Usuario inactivo' });
        }

        // Verificar contraseña
        if (contrasena !== usuario.contrasena) {
            registrarIntentoFallido(rateLimit.key);
            await registrarMetricaAcceso(req, {
                id_usuario: usuario.id_usuario,
                email_ingresado: email,
                tipo_evento: 'LOGIN',
                motivo: 'CREDENCIALES_INVALIDAS',
                ...datosComportamiento
            }, inicio);
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        limpiarIntentos(rateLimit.key);

        // Guardar sesión
        req.session.usuarioId = usuario.id_usuario;
        req.session.usuarioNombre = usuario.nombre;
        req.session.usuarioEmail = usuario.email;
        req.session.usuarioRol = usuario.rol;

        const rol = (usuario.rol || '').toUpperCase();

        let redireccionar = '/inicio.html';
        if (rol === 'ADMIN') {
            redireccionar = '/adminPanel.html';
        }

        await registrarMetricaAcceso(req, {
            id_usuario: usuario.id_usuario,
            email_ingresado: email,
            tipo_evento: 'LOGIN',
            motivo: 'EXITOSO',
            ...datosComportamiento
        }, inicio);
        res.json({ mensaje: 'Login exitoso', redireccionar, rol });
    } catch (error) {
        console.error('Error en login:', error);
        await registrarMetricaAcceso(req, {
            email_ingresado: req.body?.email || null,
            tipo_evento: 'LOGIN',
            motivo: 'ERROR_INTERNO',
            comportamiento: null,
            clasificacion_comportamiento: 'INDETERMINADO'
        }, inicio);
        res.status(500).json({ error: 'Error interno del servidor en el login' });
    }
};

const logout = async (req, res) => {
    const idUsuario = req.session.usuarioId || null;
    const email = req.session.usuarioEmail || null;
    const inicio = Date.now();

    try {
        await new Promise((resolve, reject) => {
            req.session.destroy((err) => (err ? reject(err) : resolve()));
        });

        await registrarMetricaAcceso(req, {
            id_usuario: idUsuario,
            email_ingresado: email,
            tipo_evento: 'LOGOUT',
            motivo: 'EXITOSO'
        }, inicio);
        res.clearCookie('connect.sid'); 
        res.json({ mensaje: 'Sesión cerrada', redireccionar: '/inicio.html' }); 
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        res.status(500).json({ error: 'Error al cerrar sesión' });
    }
};

const obtenerUsuarioActual = async (req, res) => {
    if (!req.session.usuarioId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    try {
        const usuario = await usuarioModel.obtenerAutorPorId(req.session.usuarioId);
        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json({ usuario: usuario });
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
    obtenerCaptcha,
    login,
    logout,
    obtenerUsuarioActual,
    obtenerSexos
};
