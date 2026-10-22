const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL del contenedor local no ofrece SSL. Neon y otros proveedores
// administrados sí lo requieren, por eso el valor se controla por ambiente.
const usarSsl = process.env.DB_SSL === 'true'
    || (process.env.DB_SSL !== 'false'
        && !['localhost', '127.0.0.1', 'postgres'].includes(process.env.DB_HOST));

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: usarSsl ? { rejectUnauthorized: false } : false
});

module.exports = pool;
