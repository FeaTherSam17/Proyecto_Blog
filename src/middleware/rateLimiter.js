const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const usuarioModel = require('../models/usuarioModel');

/**
 * Estrategia combinada: Dirección IP + Token de sesión (express-session).
 * Identifica cada flujo de usuario en función de su dirección IP y su identificador de sesión.
 * Si el cliente no transmite cookie de sesión (ej. bot básico o script cURL), recurre a la IP
 * para evitar que la falta de cookies evada el control de tráfico.
 */
function generarClaveRateLimit(req) {
    const ip = ipKeyGenerator(req.ip || req.socket?.remoteAddress || 'unknown');
    const tieneCookieSesion = Boolean(req.headers?.cookie && req.headers.cookie.includes('connect.sid'));
    const sessionId = (tieneCookieSesion && req.sessionID) ? req.sessionID : 'ip-global';
    return `${ip}::${sessionId}`;
}

/**
 * Limitador general para la API:
 * Mitiga peticiones masivas en paralelo (ej. navegación concurrente en múltiples pestañas desde Selenium)
 * y sobrecarga general en el servidor Node.js/Express.
 */
const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Ventana de 15 minutos
    limit: 300, // Máximo 300 solicitudes por IP + Sesión
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: generarClaveRateLimit,
    handler: (req, res, next, options) => {
        const retryAfter = Math.ceil(options.windowMs / 1000);
        res.set('Retry-After', String(retryAfter));
        return res.status(429).json({
            error: 'Demasiadas solicitudes a la API. Límite de tráfico excedido.',
            retryAfter
        });
    }
});

/**
 * Limitador estricto para Login:
 * Mitiga ataques de fuerza bruta y automatizaciones de autenticación con Selenium.
 * Aplica reglas dinámicas adaptándose al puntaje del análisis de bot pasivo.
 */
const loginRateLimiter = rateLimit({
    windowMs: 60 * 1000, // Ventana de 1 minuto
    limit: (req) => {
        // Regla dinámica: si la inspección de cabeceras/comportamiento detectó nivel ALTO, reduce drásticamente la cuota
        if (req.botAssessment?.level === 'ALTO') {
            return 2; // Máximo 2 intentos por minuto si hay firmas sospechosas (ej. HeadlessChrome / Webdriver)
        }
        if (req.botAssessment?.level === 'MEDIO') {
            return 3;
        }
        return 5; // Cuota estándar de 5 intentos por minuto
    },
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: generarClaveRateLimit,
    handler: async (req, res, next, options) => {
        const retryAfter = Math.ceil(options.windowMs / 1000);
        res.set('Retry-After', String(retryAfter));

        // Registro forense en la bitácora de auditoría (METRICAS_ACCESO)
        try {
            await usuarioModel.registrarEventoAcceso({
                email_ingresado: req.body?.email || null,
                tipo_evento: 'LOGIN',
                motivo: 'BLOQUEADO_RATE_LIMIT',
                direccion_ip: req.ip || req.socket?.remoteAddress || null,
                agente_usuario: req.get('user-agent') || null,
                duracion_ms: 0,
                comportamiento: {
                    bot_detection: req.botAssessment || null,
                    rate_limit_strategy: 'IP_PLUS_SESSION',
                    clave_limiter: generarClaveRateLimit(req)
                },
                clasificacion_comportamiento: 'SOSPECHOSO'
            });
        } catch (err) {
            console.error('Error al registrar métrica de rate limit en BD:', err);
        }

        return res.status(429).json({
            error: `Demasiados intentos de inicio de sesión. Intenta de nuevo en ${retryAfter} segundos.`,
            retryAfter
        });
    }
});

const registrationRateLimiter = rateLimit({
    // Reduce registros automatizados y evita consumir masivamente el servicio
    // SMTP. El limite es independiente del limite de inicio de sesion.
    windowMs: 60 * 60 * 1000,
    limit: 3,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: generarClaveRateLimit,
    handler: (req, res) => res.status(429).json({
        error: 'Demasiados registros desde esta conexión. Intenta más tarde.'
    })
});

module.exports = {
    generarClaveRateLimit,
    apiRateLimiter,
    loginRateLimiter,
    registrationRateLimiter
};
