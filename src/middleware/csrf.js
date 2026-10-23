const crypto = require('crypto');

const CSRF_TOKEN_TTL_MS = 30 * 60 * 1000;

function obtenerSecretoCsrf() {
    const secreto = process.env.CSRF_SECRET || process.env.SESSION_SECRET;
    if (!secreto || secreto.length < 32) {
        throw new Error('CSRF_SECRET o SESSION_SECRET debe tener al menos 32 caracteres');
    }
    return secreto;
}

function firmar(valor) {
    return crypto
        .createHmac('sha256', obtenerSecretoCsrf())
        .update(valor)
        .digest('hex');
}

function obtenerTokenCsrf(req, res) {
    // El token no depende de MemoryStore ni de una instancia concreta del
    // backend. Esto permite validarlo correctamente detrás de un proxy o
    // balanceador sin cambiar el modelo de seguridad.
    const emision = Date.now().toString();
    const nonce = crypto.randomBytes(32).toString('hex');
    const contenido = `${emision}.${nonce}`;
    const token = `${contenido}.${firmar(contenido)}`;

    res.set('Cache-Control', 'no-store');
    res.json({ csrfToken: token });
}

function validarOrigen(req) {
    // Origin es una defensa adicional; no sustituye al token porque algunos
    // clientes/proxies pueden omitir ese encabezado.
    const origenPermitido = process.env.FRONTEND_URL || 'https://proyecto-blog-0nqd.onrender.com';
    const origen = req.get('origin');
    if (!origen || origen === origenPermitido) {
        return true;
    }

    return process.env.NODE_ENV !== 'production'
        && ['http://localhost:5174', 'http://127.0.0.1:5174'].includes(origen);
}

function requerirCsrf(req, res, next) {
    if (!validarOrigen(req)) {
        return res.status(403).json({ error: 'Origen no permitido' });
    }

    const token = req.get('x-csrf-token') || '';
    const partes = token.split('.');
    const [emision = '', nonce = '', firma = ''] = partes;
    const contenido = `${emision}.${nonce}`;
    const firmaEsperada = partes.length === 3 ? firmar(contenido) : '';
    const recibido = Buffer.from(firma, 'hex');
    const esperado = Buffer.from(firmaEsperada, 'hex');
    const edad = Number(emision) ? Date.now() - Number(emision) : Infinity;
    // El token debe tener formato correcto, no ser futuro, no superar su TTL
    // y coincidir con la firma HMAC validada en tiempo constante.
    const coincide = partes.length === 3
        && /^[0-9]+$/.test(emision)
        && /^[a-f0-9]{64}$/i.test(nonce)
        && /^[a-f0-9]{64}$/i.test(firma)
        && edad >= 0
        && edad <= CSRF_TOKEN_TTL_MS
        && recibido.length === esperado.length
        && crypto.timingSafeEqual(recibido, esperado);
    if (!coincide) {
        return res.status(403).json({ error: 'Token CSRF inválido o ausente' });
    }
    next();
}

module.exports = { obtenerTokenCsrf, requerirCsrf };
