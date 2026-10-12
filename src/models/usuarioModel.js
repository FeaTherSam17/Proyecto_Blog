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

const obtenerAutores = async (termino = '', limit = 10, offset = 0) => {
    const values = [];
    let whereBusqueda = '';
    let paramIndex = 1;

    if (termino && termino.trim()) {
        whereBusqueda = `
            AND (
                UPPER(CONCAT_WS(' ', U.NOMBRE, U.PRIMER_APELLIDO, U.SEGUNDO_APELLIDO)) LIKE UPPER($${paramIndex})
                OR UPPER(U.EMAIL) LIKE UPPER($${paramIndex})
            )
        `;
        values.push(`%${termino.trim()}%`);
        paramIndex++;
    }

    const query = `
        SELECT
            COUNT(*) OVER() AS total_registros,
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
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);

    const result = await pool.query(query, values);
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_registros) : 0;

    return {
        autores: result.rows.map(row => {
            const { total_registros, ...autor } = row;
            return autor;
        }),
        total
    };
};

const actualizarAutor = async (id_autor, datos) => {
    const {
        nombre,
        primer_apellido,
        segundo_apellido,
        cod_sexo,
        email,
        telefono,
        biografia,
        contrasena
    } = datos;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const usuarioQuery = contrasena
            ? `
                UPDATE USUARIOS
                SET NOMBRE = $1,
                    PRIMER_APELLIDO = $2,
                    SEGUNDO_APELLIDO = $3,
                    EMAIL = $4,
                    CONTRASENA = $5
                WHERE ID_USUARIO = $6 AND ROL = 'AUTOR'
                RETURNING ID_USUARIO
            `
            : `
                UPDATE USUARIOS
                SET NOMBRE = $1,
                    PRIMER_APELLIDO = $2,
                    SEGUNDO_APELLIDO = $3,
                    EMAIL = $4
                WHERE ID_USUARIO = $5 AND ROL = 'AUTOR'
                RETURNING ID_USUARIO
            `;

        const usuarioValues = contrasena
            ? [nombre, primer_apellido, segundo_apellido, email, contrasena, id_autor]
            : [nombre, primer_apellido, segundo_apellido, email, id_autor];

        const usuarioResult = await client.query(usuarioQuery, usuarioValues);
        if (!usuarioResult.rows[0]) {
            await client.query('ROLLBACK');
            return null;
        }

        const autorQuery = `
            UPDATE AUTORES
            SET COD_SEXO = $1,
                TELEFONO = $2,
                BIOGRAFIA = $3
            WHERE ID_AUTOR = $4
            RETURNING ID_AUTOR
        `;
        await client.query(autorQuery, [cod_sexo, telefono, biografia, id_autor]);

        await client.query('COMMIT');
        return { id_autor };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const eliminarAutor = async (id_autor) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Eliminar dependencias primero
        await client.query('DELETE FROM PUBLICACIONES WHERE ID_AUTOR = $1', [id_autor]);
        await client.query('DELETE FROM AUTORES WHERE ID_AUTOR = $1', [id_autor]);

        const usuarioResult = await client.query(
            `
                DELETE FROM USUARIOS
                WHERE ID_USUARIO = $1 AND ROL = 'AUTOR'
                RETURNING ID_USUARIO
            `,
            [id_autor]
        );

        if (!usuarioResult.rows[0]) {
            await client.query('ROLLBACK');
            return null;
        }

        await client.query('COMMIT');
        return { id_autor };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// Persiste el resultado del login/logout y sus indicadores de comportamiento.
// La contraseña nunca forma parte de los parámetros de esta función.
const registrarEventoAcceso = async ({
    id_usuario = null,
    email_ingresado = null,
    tipo_evento,
    motivo,
    direccion_ip = null,
    agente_usuario = null,
    duracion_ms = null,
    comportamiento = null,
    clasificacion_comportamiento = null
}) => {
    // COMPORTAMIENTO se guarda como JSONB para conservar el resumen de Vue
    // y permitir consultas posteriores sobre sus propiedades.
    const query = `
        INSERT INTO METRICAS_ACCESO (
            ID_USUARIO, EMAIL_INGRESADO, TIPO_EVENTO, MOTIVO,
            DIRECCION_IP, AGENTE_USUARIO, DURACION_MS,
            COMPORTAMIENTO, CLASIFICACION_COMPORTAMIENTO
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    await pool.query(query, [
        id_usuario,
        email_ingresado,
        tipo_evento,
        motivo,
        direccion_ip,
        agente_usuario,
        duracion_ms,
        comportamiento,
        clasificacion_comportamiento
    ]);
};

module.exports = {
    registrarAutor,
    buscarUsuarioPorEmail,
    obtenerAutorPorId,
    obtenerSexos,
    obtenerAutores,
    actualizarAutor,
    eliminarAutor,
    registrarEventoAcceso
};
