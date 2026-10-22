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

// Middleware nativo para habilitar CORS blindado
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://proyecto-blog-0nqd.onrender.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  // X-CSRF-Token debe estar permitido porque el frontend y el backend viven
  // en dominios distintos. Al no declararlo, el navegador rechaza el
  // preflight OPTIONS antes de enviar la petición real.
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token'
  );
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Middlewares para procesar JSON y datos de formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. VITAL: Permitir que Render acepte las cookies seguras de tu proxy
app.set('trust proxy', 1);

// En producción frontend y backend viven en dominios distintos y necesitan
// cookies Secure/SameSite=None. En local Vite usa el proxy /api, por lo que
// la cookie debe poder viajar por HTTP y se configura como SameSite=Lax.
const esProduccion = process.env.NODE_ENV === 'production';

// 2. Configuración de sesiones compatible con producción y desarrollo local
app.use(session({
    secret: process.env.SESSION_SECRET || 'super_secreto_blog',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: esProduccion,
        sameSite: esProduccion ? 'none' : 'lax',
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

// 3. PRIMERO SE DECLARAN LAS RUTAS DE LA API
app.use('/api/auth', authRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/admin', adminRoutes);

// 4. DESPUÉS SE DECLARA EL CATCH-ALL DE PRODUCCIÓN PARA VUE
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend/dist')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
    });
}

// Iniciar el servidor
app.listen(port, () => {
    console.log(`API Backend escuchando en el puerto ${port}`);
});