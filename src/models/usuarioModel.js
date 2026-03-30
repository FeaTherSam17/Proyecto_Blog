const pool = require('../config/db');

const registrarAutor = async (autor) => {
    const { nombre, primer_apellido, segundo_apellido, cod_sexo, email, telefono, biografia, contrasena } = autor;

    // Si algún apellido está vacío, lo pasamos como null para respetar el schema
    const p_apellido = primer_apellido ? primer_apellido : null;
    const s_apellido = segundo_apellido ? segundo_apellido : null;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const insertarUsuarioQuery = `
            INSERT INTO USUARIOS (
                NOMBRE, PRIMER_APELLIDO, SEGUNDO_APELLIDO, EMAIL, CONTRASENA, ROL
            )
            VALUES ($1, $2, $3, $4, $5, 'AUTOR')
            RETURNING ID_USUARIO, NOMBRE, EMAIL, ROL
        `;

        const usuarioResult = await client.query(insertarUsuarioQuery, [
            nombre,
            p_apellido,
            s_apellido,
            email,
            contrasena
        ]);

        const idUsuario = usuarioResult.rows[0].id_usuario;

        const insertarAutorQuery = `
            INSERT INTO AUTORES (ID_AUTOR, COD_SEXO, TELEFONO, BIOGRAFIA)
            VALUES ($1, $2, $3, $4)
        `;
        await client.query(insertarAutorQuery, [idUsuario, cod_sexo, telefono, biografia]);

        await client.query('COMMIT');
        return {
            id_autor: idUsuario,
            nombre: usuarioResult.rows[0].nombre,
            email: usuarioResult.rows[0].email,
            rol: usuarioResult.rows[0].rol
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const buscarUsuarioPorEmail = async (email) => {
    const query = `
        SELECT ID_USUARIO, NOMBRE, PRIMER_APELLIDO, SEGUNDO_APELLIDO, EMAIL, CONTRASENA, ROL, ESTADO_USUARIO
        FROM USUARIOS
        WHERE EMAIL = $1
    `;
    const result = await pool.query(query, [email]);
    return result.rows[0];
};

const obtenerAutorPorId = async (id_autor) => {
    const query = `
        SELECT
            U.ID_USUARIO AS ID_AUTOR,
            U.NOMBRE,
            U.PRIMER_APELLIDO,
            U.SEGUNDO_APELLIDO,
            U.EMAIL,
            U.ROL,
            U.ESTADO_USUARIO,
            A.TELEFONO,
            A.BIOGRAFIA,
            A.ESTADO_AUTOR
        FROM USUARIOS U
        LEFT JOIN AUTORES A ON U.ID_USUARIO = A.ID_AUTOR
        WHERE U.ID_USUARIO = $1
    `;
    const result = await pool.query(query, [id_autor]);
    return result.rows[0];
};

const obtenerSexos = async () => {
    const query = 'SELECT COD_SEXO, DESCRIPCION FROM CAT_SEXOS ORDER BY DESCRIPCION ASC';
    const result = await pool.query(query);
    return result.rows;
};

const obtenerAutores = async (termino = '') => {
    const values = [];
    let whereBusqueda = '';

    if (termino && termino.trim()) {
        whereBusqueda = `
            AND (
                UPPER(CONCAT_WS(' ', U.NOMBRE, U.PRIMER_APELLIDO, U.SEGUNDO_APELLIDO)) LIKE UPPER($1)
                OR UPPER(U.EMAIL) LIKE UPPER($1)
            )
        `;
        values.push(`%${termino.trim()}%`);
    }

    const query = `
        SELECT
            U.ID_USUARIO AS ID_AUTOR,
            U.NOMBRE,
            U.PRIMER_APELLIDO,
            U.SEGUNDO_APELLIDO,
            U.EMAIL,
            U.ESTADO_USUARIO,
            A.COD_SEXO,
            A.TELEFONO,
            A.BIOGRAFIA,
            A.ESTADO_AUTOR
        FROM USUARIOS U
        INNER JOIN AUTORES A ON U.ID_USUARIO = A.ID_AUTOR
        WHERE U.ROL = 'AUTOR'
        ${whereBusqueda}
        ORDER BY U.NOMBRE ASC, U.PRIMER_APELLIDO ASC, U.SEGUNDO_APELLIDO ASC
    `;

    const result = await pool.query(query, values);
    return result.rows;
};

module.exports = {
    registrarAutor,
    buscarUsuarioPorEmail,
    obtenerAutorPorId,
    obtenerSexos,
    obtenerAutores
};
