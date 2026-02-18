const express = require('express');
const { Pool } = require('pg');
require('dotenv').config(); // <--- 1. ESTO ES LO NUEVO: Carga el archivo .env

const app = express();
// Usamos el puerto definido en .env o el 3000 por defecto
const port = process.env.PORT || 3000; 

// 1. Configuración de la Base de Datos (Segura)
const pool = new Pool({
    user: process.env.DB_USER,         // Lee DB_USER del .env
    host: process.env.DB_HOST,         // Lee DB_HOST del .env
    database: process.env.DB_NAME,     // Lee DB_NAME del .env
    password: process.env.DB_PASSWORD, // Lee DB_PASSWORD del .env (¡Tu secreto!)
    port: process.env.DB_PORT,         // Lee DB_PORT del .env
});

// 2. Ruta de prueba
app.get('/test-db', async (req, res) => {
    console.log('¡Petición recibida en /test-db!'); 
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({
            estado: 'EXITOSO ',
            mensaje: '¡Conexión a Postgres correcta!',
            fecha_servidor: result.rows[0].now
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ 
            estado: 'ERROR ', 
            error: err.message 
        });
    }
});

// 3. Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
    console.log(`Haz clic aquí para probar: http://localhost:${port}/test-db`);
});