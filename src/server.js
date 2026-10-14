const express = require('express');
const session = require('express-session');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const blogRoutes = require('./routes/blogRoutes');
const adminRoutes = require('./routes/adminRoutes');
const detectarBotPasivamente = require('./middleware/botDetection');
const { apiRateLimiter } = require('./middleware/rateLimiter');

const app = express();
const port = process.env.PORT || 3000;

// Configuración de Sesiones
app.use(session({
    secret: process.env.SESSION_SECRET || 'super_secreto_blog', // Idealmente en .env
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // En producción debería ser true con HTTPS
        maxAge: 1000 * 60 * 60 * 24 // 1 día
    }
}));

// Middlewares para procesar JSON y datos de formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const { accessLogStream } = require('./utils/logger');

// Auditoría y registro de tráfico con Morgan en consola
morgan.token('client-ip', (req) => req.ip || req.socket?.remoteAddress || '-');
morgan.token('session-id', (req) => req.sessionID ? req.sessionID.slice(0, 10) + '...' : '-');
morgan.token('bot-info', (req) => {
    if (!req.botAssessment) return 'bot:N/A';
    return `bot:${req.botAssessment.level}[${req.botAssessment.score}]`;
});
app.use(morgan(':client-ip [:session-id] :method :url :status :res[content-length] - :response-time ms | :bot-info | ":user-agent"'));

// Registro persistente y continuo en archivo de logs (logs/acceso.log)
app.use(morgan('[:date[iso]] :client-ip [:session-id] :method :url :status :res[content-length] - :response-time ms | :bot-info | ":user-agent"', {
    stream: accessLogStream
}));

// Detección pasiva para toda la API. Inspecciona cabeceras (User-Agent, Accept-Language, Referer) y cadencia.
app.use('/api', detectarBotPasivamente);

// Control de tráfico y Rate Limiting para toda la API (estrategia combinada IP + express-session)
app.use('/api', apiRateLimiter);

// El frontend Vue corre en Vite (puerto 5173 en dev).
// En producción, servir el build de Vite desde frontend/dist.
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend/dist')));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
        }
    });
}

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/admin', adminRoutes);

// Iniciar el servidor
app.listen(port, () => {
    console.log(`API Backend escuchando en http://localhost:${port}`);
    console.log(`Frontend Vue: cd frontend && npm run dev`);
});