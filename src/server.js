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

// Middleware nativo para habilitar CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://proyecto-blog-0nqd.onrender.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Middlewares para procesar JSON y datos de formularios (Se eliminó el duplicado)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de Sesiones
app.use(session({
    secret: process.env.SESSION_SECRET || 'super_secreto_blog',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // true en producción
        maxAge: 1000 * 60 * 60 * 24 // 1 día
    }
}));

const { accessLogStream } = require('./utils/logger');

// Auditoría y registro de tráfico con Morgan
morgan.token('client-ip', (req) => req.ip || req.socket?.remoteAddress || '-');
morgan.token('session-id', (req) => req.sessionID ? req.sessionID.slice(0, 10) + '...' : '-');
morgan.token('bot-info', (req) => {
    if (!req.botAssessment) return 'bot:N/A';
    return `bot:${req.botAssessment.level}[${req.botAssessment.score}]`;
});

app.use(morgan(':client-ip [:session-id] :method :url :status :res[content-length] - :response-time ms | :bot-info | ":user-agent"'));
app.use(morgan('[:date[iso]] :client-ip [:session-id] :method :url :status :res[content-length] - :response-time ms | :bot-info | ":user-agent"', {
    stream: accessLogStream
}));

// Detección pasiva y Rate Limiting
app.use('/api', detectarBotPasivamente);
app.use('/api', apiRateLimiter);

// 1. PRIMERO SE DECLARAN LAS RUTAS DE LA API
app.use('/api/auth', authRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/admin', adminRoutes);

// 2. DESPUÉS SE DECLARA EL CATCH-ALL DE PRODUCCIÓN
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend/dist')));
    // Al estar debajo de la API, esto solo atrapará rutas que no sean /api/lo-que-sea
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
    });
}

// Iniciar el servidor
app.listen(port, () => {
    console.log(`API Backend escuchando en el puerto ${port}`);
});