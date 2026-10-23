const crypto = require('crypto');

const COOKIE_NAME = 'blog_visitor';
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const METODOS_MUTACION = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function obtenerSecreto() {
    const secreto = process.env.SESSION_SECRET || '';
    if (secreto.length < 32) {
        throw new Error('SESSION_SECRET debe tener al menos 32 caracteres');
    }
    return secreto;
}

function firmar(contenido) {
    return crypto.createHmac('sha256', obtenerSecreto()).update(contenido).digest('hex');
}

function leerCookie(req, nombre) {
    const cookies = req.get('cookie') || '';
    const entrada = cookies
        .split(';')
        .map(cookie => cookie.trim())
        .find(cookie => cookie.startsWith(`${nombre}=`));
    if (!entrada) {
        return '';
    }

    try {
        return decodeURIComponent(entrada.slice(nombre.length + 1));
    } catch {
        return '';
    }
}

function cookieValida(valor) {
    const [emision, nonce, firma] = valor.split('.');
    if (!emision || !nonce || !firma || !/^[0-9]+$/.test(emision) || !/^[a-f0-9]{64}$/i.test(nonce)) {
        return false;
    }

    const edad = Date.now() - Number(emision);
    if (edad < 0 || edad > COOKIE_MAX_AGE_MS || !/^[a-f0-9]{64}$/i.test(firma)) {
        return false;
    }

    const esperado = Buffer.from(firmar(`${emision}.${nonce}`), 'hex');
    const recibido = Buffer.from(firma, 'hex');
    return recibido.length === esperado.length && crypto.timingSafeEqual(recibido, esperado);
}

function emitirCookie(res) {
    const contenido = `${Date.now()}.${crypto.randomBytes(32).toString('hex')}`;
    const esProduccion = process.env.NODE_ENV === 'production';
    res.cookie(COOKIE_NAME, `${contenido}.${firmar(contenido)}`, {
        httpOnly: true,
        sameSite: esProduccion ? 'none' : 'lax',
        secure: esProduccion,
        maxAge: COOKIE_MAX_AGE_MS,
        path: '/'
    });
}

function origenNavegadorValido(req) {
    const origenPermitido = process.env.FRONTEND_URL || 'https://proyecto-blog-0nqd.onrender.com';
    const origin = req.get('origin');
    const referer = req.get('referer') || req.get('referrer');
    if (process.env.NODE_ENV !== 'production' && !origin && !referer) {
        return true;
    }

    const origenesPermitidos = process.env.NODE_ENV === 'production'
        ? [origenPermitido]
        : [origenPermitido, 'http://localhost:5174', 'http://127.0.0.1:5174'];
    return origenesPermitidos.some(origenPermitidoActual =>
        origin === origenPermitidoActual
        || Boolean(referer && referer.startsWith(`${origenPermitidoActual}/`))
    );
}

function protegerPeticiones(req, res, next) {
    const cookie = leerCookie(req, COOKIE_NAME);
    if (!cookieValida(cookie)) {
        emitirCookie(res);
        if (METODOS_MUTACION.has(req.method)) {
            return res.status(403).json({
                error: 'Sesión de navegador no preparada. Recarga la página e inténtalo de nuevo.'
            });
        }
    }

    if (METODOS_MUTACION.has(req.method)) {
        const userAgent = req.get('user-agent') || '';
        const accept = req.get('accept') || '';
        const acceptLanguage = req.get('accept-language') || '';

        if (!userAgent || !accept || !acceptLanguage || !origenNavegadorValido(req)) {
            return res.status(403).json({
                error: 'Cabeceras de navegador incompletas o de origen no permitido.'
            });
        }

        if (req.botAssessment?.level === 'ALTO') {
            return res.status(403).json({
                error: 'Solicitud bloqueada por comportamiento automatizado.'
            });
        }
    }

    next();
}

module.exports = protegerPeticiones;
