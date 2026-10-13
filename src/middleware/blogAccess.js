const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const ACCESS_TTL_MS = 30 * 60 * 1000;

async function verificarTurnstile(token, req) {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
        return { success: true, skipped: true };
    }
    if (!token || typeof token !== 'string' || token.length > 2048) {
        return { success: false };
    }

    const respuesta = await fetch(TURNSTILE_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            secret,
            response: token,
            remoteip: req.ip || req.socket.remoteAddress
        })
    });

    if (!respuesta.ok) {
        throw new Error(`Turnstile respondió con HTTP ${respuesta.status}`);
    }
    return respuesta.json();
}

async function concederAccesoBlog(req, res) {
    const accesoVigente = Number(req.session.blogAccessExpiresAt || 0) > Date.now();
    if (accesoVigente) {
        return res.json({ accessGranted: true });
    }

    try {
        const resultado = await verificarTurnstile(req.body?.token, req);
        if (!resultado.success) {
            return res.status(403).json({
                error: 'No se pudo validar el acceso al blog. Intenta de nuevo.'
            });
        }

        req.session.blogAccessExpiresAt = Date.now() + ACCESS_TTL_MS;
        return res.json({ accessGranted: true });
    } catch (error) {
        console.error('Error al validar el acceso del blog:', error);
        return res.status(503).json({
            error: 'La protección anti-bot no está disponible. Intenta de nuevo.'
        });
    }
}

function requerirAccesoBlog(req, res, next) {
    const accesoVigente = Number(req.session.blogAccessExpiresAt || 0) > Date.now();
    if (accesoVigente || !process.env.TURNSTILE_SECRET_KEY) {
        return next();
    }

    return res.status(403).json({
        error: 'Debes validar el acceso al blog antes de consultar publicaciones.'
    });
}

module.exports = {
    concederAccesoBlog,
    requerirAccesoBlog
};
