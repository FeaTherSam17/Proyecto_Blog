const actividadPorCliente = new Map();

const VENTANA_ACTIVIDAD_MS = 10 * 60 * 1000;
const MAX_REGISTROS_CLIENTE = 120;

function obtenerIdentificadorCliente(req) {
    return req.ip || req.socket.remoteAddress || 'unknown';
}

function limpiarActividadAntigua(ahora) {
    for (const [cliente, actividad] of actividadPorCliente.entries()) {
        if (ahora - actividad.ultimaPeticion > VENTANA_ACTIVIDAD_MS) {
            actividadPorCliente.delete(cliente);
        }
    }
}

function detectarBotPasivamente(req, res, next) {
    const ahora = Date.now();
    limpiarActividadAntigua(ahora);

    const cliente = obtenerIdentificadorCliente(req);
    const anterior = actividadPorCliente.get(cliente) || {
        primeraPeticion: ahora,
        ultimaPeticion: ahora,
        peticiones: []
    };

    const intervaloMs = anterior.ultimaPeticion === ahora
        ? 0
        : ahora - anterior.ultimaPeticion;
    anterior.peticiones.push(ahora);
    anterior.peticiones = anterior.peticiones.filter(
        momento => ahora - momento <= VENTANA_ACTIVIDAD_MS
    ).slice(-MAX_REGISTROS_CLIENTE);
    anterior.ultimaPeticion = ahora;
    actividadPorCliente.set(cliente, anterior);

    let puntaje = 0;
    const senales = [];
    const userAgent = req.get('user-agent') || '';
    const userAgentNormalizado = userAgent.toLowerCase();

    // Estas cabeceras sólo son señales: pueden faltar en clientes legítimos.
    if (!userAgent) {
        puntaje += 15;
        senales.push('USER_AGENT_AUSENTE');
    }
    if (/(headless|phantom|selenium|webdriver|playwright|puppeteer|bot)/i.test(userAgentNormalizado)) {
        puntaje += 45;
        senales.push('USER_AGENT_AUTOMATIZADO');
    }
    if (req.get('accept-language') === undefined) {
        puntaje += 10;
        senales.push('IDIOMA_AUSENTE');
    }

    const peticionesRecientes = anterior.peticiones.length;
    if (peticionesRecientes >= 60) {
        puntaje += 35;
        senales.push('VOLUMEN_ALTO');
    } else if (peticionesRecientes >= 30) {
        puntaje += 15;
        senales.push('VOLUMEN_ELEVADO');
    }
    if (intervaloMs > 0 && intervaloMs < 80) {
        puntaje += 20;
        senales.push('CADENCIA_MUY_RAPIDA');
    }

    const nivel = puntaje >= 60
        ? 'ALTO'
        : puntaje >= 30
            ? 'MEDIO'
            : 'BAJO';

    // La evaluación se adjunta a la petición para que login y otros controladores
    // puedan registrarla sin bloquear automáticamente a usuarios legítimos.
    req.botAssessment = {
        score: Math.min(puntaje, 100),
        level: nivel,
        signals: senales,
        requestIntervalMs: intervaloMs,
        recentRequests: peticionesRecientes
    };

    next();
}

module.exports = detectarBotPasivamente;
