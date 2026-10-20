const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logFilePath = path.join(logDir, 'acceso.log');

// Stream de escritura para morgan y registros continuos del servidor
const accessLogStream = fs.createWriteStream(logFilePath, { flags: 'a' });

/**
 * Escribe una línea formateada con timestamp ISO en el archivo de logs
 */
function escribirLogArchivo(mensaje) {
    const timestamp = new Date().toISOString();
    const linea = `[${timestamp}] ${mensaje}\n`;
    try {
        fs.appendFileSync(logFilePath, linea, 'utf8');
    } catch (err) {
        console.error('Error al escribir en archivo de log:', err);
    }
}

/**
 * Lee las últimas N líneas del archivo de logs para inspección en el panel
 */
function leerUltimosLogs(maxLineas = 200) {
    if (!fs.existsSync(logFilePath)) {
        return [];
    }
    try {
        const contenido = fs.readFileSync(logFilePath, 'utf8');
        const lineas = contenido.trim().split('\n').filter(Boolean);
        return lineas.slice(-maxLineas);
    } catch (err) {
        console.error('Error al leer archivo de log:', err);
        return [];
    }
}

function obtenerRutaLog() {
    return logFilePath;
}

module.exports = {
    logFilePath,
    accessLogStream,
    escribirLogArchivo,
    leerUltimosLogs,
    obtenerRutaLog
};
