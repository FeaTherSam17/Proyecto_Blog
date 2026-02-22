const pool = require('../config/db');

const registrarAutor = async (autor) => {
    const { nombre, primer_apellido, segundo_apellido, cod_sexo, email, telefono, biografia, contrasena } = autor;

    const query = `
        INSERT INTO AUTORES (
            NOMBRE, PRIMER_APELLIDO, SEGUNDO_APELLIDO, COD_SEXO, 
            EMAIL, TELEFONO, BIOGRAFIA, CONTRASENA
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING ID_AUTOR, NOMBRE, EMAIL
    `;

    // Si algún apellido está vacío, lo pasamos como null para respetar el schema
    const p_apellido = primer_apellido ? primer_apellido : null;
    const s_apellido = segundo_apellido ? segundo_apellido : null;

    const values = [nombre, p_apellido, s_apellido, cod_sexo, email, telefono, biografia, contrasena];

    const result = await pool.query(query, values);
    return result.rows[0];
};

const buscarAutorPorEmail = async (email) => {
    const query = 'SELECT * FROM AUTORES WHERE EMAIL = $1';
    const result = await pool.query(query, [email]);
    return result.rows[0];
};

const obtenerAutorPorId = async (id_autor) => {
    const query = 'SELECT ID_AUTOR, NOMBRE, PRIMER_APELLIDO, SEGUNDO_APELLIDO, EMAIL, TELEFONO, BIOGRAFIA, ESTADO_AUTOR FROM AUTORES WHERE ID_AUTOR = $1';
    const result = await pool.query(query, [id_autor]);
    return result.rows[0];
};

module.exports = {
    registrarAutor,
    buscarAutorPorEmail,
    obtenerAutorPorId
};
