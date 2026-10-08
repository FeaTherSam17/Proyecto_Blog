const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const blogRoutes = require('./routes/blogRoutes');
const adminRoutes = require('./routes/adminRoutes');

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