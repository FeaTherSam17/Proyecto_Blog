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

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../public')));

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/admin', adminRoutes);

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
    console.log(`Haz clic aquí para ver inicio: http://localhost:${port}/inicio.html`);
});