const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = 3000;

// 1. Configuración de la Base de Datos
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'proyecto_blog',
    password: 'admin', 
    port: 5432,
});

// 2. Ruta de prueba (ESTA ES LA PARTE IMPORTANTE)
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

// 3. Iniciar el servidor 333
app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
    console.log(`Haz clic aquí para probar: http://localhost:${port}/test-db`);
});