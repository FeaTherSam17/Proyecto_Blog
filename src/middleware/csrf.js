const crypto = require('crypto');

function obtenerTokenCsrf(req, res) {
    // El token queda ligado a la sesion. Un sitio externo no puede conocerlo
    // mediante una peticion cross-site normal y, por tanto, no puede falsificar
    // una operacion que use la cookie de sesion.
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    res.json({ csrfToken: req.session.csrfToken });
}

function validarOrigen(req) {
    // Origin es una defensa adicional; no sustituye al token porque algunos
    // clientes/proxies pueden omitir ese encabezado.
    const origenPermitido = process.env.FRONTEND_URL || 'https://proyecto-blog-0nqd.onrender.com';
    const origen = req.get('origin');
    return !origen || origen === origenPermitido;
}

function requerirCsrf(req, res, next) {
    if (!validarOrigen(req)) {
        return res.status(403).json({ error: 'Origen no permitido' });
    }

    const token = req.get('x-csrf-token');
    // Se compara en tiempo constante y se comprueba la longitud antes de llamar
    // a timingSafeEqual, que requiere buffers del mismo tamano.
    const recibido = token ? Buffer.from(token) : null;
    const esperado = req.session.csrfToken ? Buffer.from(req.session.csrfToken) : null;
    const coincide = recibido && esperado
        && recibido.length === esperado.length
        && crypto.timingSafeEqual(recibido, esperado);
    if (!coincide) {
        return res.status(403).json({ error: 'Token CSRF inválido o ausente' });
    }
    next();
}

module.exports = { obtenerTokenCsrf, requerirCsrf };
