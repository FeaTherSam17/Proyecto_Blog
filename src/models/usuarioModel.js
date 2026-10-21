const pool = require('../config/db');
const bcrypt = require('bcryptjs');

const registrarAutor = async (autor) => {
    const {
        nombre, primer_apellido, segundo_apellido, cod_sexo, email,
        telefono, biografia, contrasena, estado_usuario = 'PENDIENTE_VERIFICACION'
    } = autor;

    // Si algún apellido está vacío, lo pasamos como null para respetar el schema.
    const p_apellido = primer_apellido ? primer_apellido : null;
    const s_apellido = segundo_apellido ? segundo_apellido : null;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const insertarUsuarioQuery = `
            INSERT INTO USUARIOS (
                NOMBRE, PRIMER_APELLIDO, SEGUNDO_APELLIDO, EMAIL, CONTRASENA,
                ROL, ESTADO_USUARIO, EMAIL_VERIFICADO, FECHA_VERIFICACION
            )
            VALUES ($1, $2, $3, $4, $5, 'AUTOR', $6, $7, $8)
            RETURNING ID_USUARIO, NOMBRE, EMAIL, ROL, ESTADO_USUARIO
        `;

        // La contraseña nunca se persiste en texto plano. El costo 12 dificulta
        // ataques offline sin hacer excesivamente lento el registro.
        const contrasenaHash = await bcrypt.hash(contrasena, 12);
        // Los registros públicos quedan pendientes; el alta administrativa usa
        // ACTIVO porque el administrador ya controla el proceso de creación.
        const verificado = estado_usuario === 'ACTIVO';
        const usuarioResult = await client.query(insertarUsuarioQuery, [
            nombre,
            p_apellido,
            s_apellido,
            email,
            contrasenaHash,
            estado_usuario,
            verificado,
            verificado ? new Date() : null
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
            rol: usuarioResult.rows[0].rol,
            estado_usuario: usuarioResult.rows[0].estado_usuario
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

const actualizarContrasenaHash = async (idUsuario, contrasenaHash) => {
    await pool.query(
        `UPDATE USUARIOS SET CONTRASENA = $1 WHERE ID_USUARIO = $2`,
        [contrasenaHash, idUsuario]
    );
};

const crearTokenVerificacion = async (idUsuario, tokenHash, expiraEn) => {
    // Solo debe existir un token vigente por usuario para invalidar enlaces
    // anteriores cuando se solicita un reenvio.
    await pool.query(
        `DELETE FROM TOKENS_VERIFICACION_EMAIL WHERE ID_USUARIO = $1 AND USADO_EN IS NULL`,
        [idUsuario]
    );
    await pool.query(
        `INSERT INTO TOKENS_VERIFICACION_EMAIL (ID_USUARIO, TOKEN_HASH, EXPIRA_EN)
         VALUES ($1, $2, $3)`,
        [idUsuario, tokenHash, expiraEn]
    );
};

const verificarEmailPorToken = async (tokenHash) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // FOR UPDATE evita que dos peticiones concurrentes consuman el mismo
        // token al mismo tiempo.
        const tokenResult = await client.query(
            `SELECT ID_TOKEN, ID_USUARIO
             FROM TOKENS_VERIFICACION_EMAIL
             WHERE TOKEN_HASH = $1 AND USADO_EN IS NULL AND EXPIRA_EN > CURRENT_TIMESTAMP
             FOR UPDATE`,
            [tokenHash]
        );
        const token = tokenResult.rows[0];
        if (!token) {
            await client.query('ROLLBACK');
            return false;
        }

        // La activacion y el marcado de token usado se confirman en una
        // transaccion para no dejar estados intermedios.
        await client.query(
            `UPDATE USUARIOS
             SET EMAIL_VERIFICADO = TRUE, FECHA_VERIFICACION = CURRENT_TIMESTAMP,
                 ESTADO_USUARIO = 'ACTIVO'
             WHERE ID_USUARIO = $1 AND ESTADO_USUARIO = 'PENDIENTE_VERIFICACION'`,
            [token.id_usuario]
        );
        await client.query(
            `UPDATE TOKENS_VERIFICACION_EMAIL SET USADO_EN = CURRENT_TIMESTAMP WHERE ID_TOKEN = $1`,
            [token.id_token]
        );
        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
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

        // Las contraseñas nuevas o modificadas siguen el mismo esquema de hash
        // que el registro público.
        const contrasenaHash = contrasena ? await bcrypt.hash(contrasena, 12) : null;
        const usuarioValues = contrasena
            ? [nombre, primer_apellido, segundo_apellido, email, contrasenaHash, id_autor]
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

const { escribirLogArchivo } = require('../utils/logger');

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
    // 1. COMPORTAMIENTO se guarda como JSONB para conservar el resumen de Vue
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

    // 2. Registro síncrono en archivo de logs físico (logs/acceso.log)
    try {
        escribirLogArchivo(
            `[AUDIT_EVENT] IP: ${direccion_ip || '-'} | EVENTO: ${tipo_evento} | MOTIVO: ${motivo} | EMAIL: ${email_ingresado || '-'} | BOT: ${clasificacion_comportamiento || '-'} | DURACION: ${duracion_ms || 0}ms`
        );
    } catch (e) {
        // Fallo en archivo no interrumpe el flujo principal
    }
};

/**
 * Consulta y filtra las métricas y eventos de seguridad para el panel de administración
 */
const obtenerMetricasAcceso = async (filtros = {}, limit = 20, offset = 0) => {
    const values = [];
    const whereConditions = [];
    let paramIndex = 1;

    if (filtros.tipo_evento && filtros.tipo_evento !== 'TODOS') {
        whereConditions.push(`M.TIPO_EVENTO = $${paramIndex}`);
        values.push(filtros.tipo_evento);
        paramIndex++;
    }

    if (filtros.motivo && filtros.motivo !== 'TODOS') {
        whereConditions.push(`M.MOTIVO = $${paramIndex}`);
        values.push(filtros.motivo);
        paramIndex++;
    }

    if (filtros.clasificacion && filtros.clasificacion !== 'TODOS') {
        whereConditions.push(`M.CLASIFICACION_COMPORTAMIENTO = $${paramIndex}`);
        values.push(filtros.clasificacion);
        paramIndex++;
    }

    if (filtros.busqueda && filtros.busqueda.trim()) {
        whereConditions.push(`(
            UPPER(M.EMAIL_INGRESADO) LIKE UPPER($${paramIndex})
            OR CAST(M.DIRECCION_IP AS TEXT) LIKE $${paramIndex}
            OR UPPER(M.AGENTE_USUARIO) LIKE UPPER($${paramIndex})
        )`);
        values.push(`%${filtros.busqueda.trim()}%`);
        paramIndex++;
    }

    const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    const query = `
        SELECT 
            M.ID_EVENTO,
            M.ID_USUARIO,
            M.EMAIL_INGRESADO,
            M.TIPO_EVENTO,
            M.MOTIVO,
            HOST(M.DIRECCION_IP) AS DIRECCION_IP,
            M.AGENTE_USUARIO,
            M.DURACION_MS,
            M.COMPORTAMIENTO,
            M.CLASIFICACION_COMPORTAMIENTO,
            M.FECHA_EVENTO,
            U.NOMBRE,
            U.PRIMER_APELLIDO
        FROM METRICAS_ACCESO M
        LEFT JOIN USUARIOS U ON M.ID_USUARIO = U.ID_USUARIO
        ${whereClause}
        ORDER BY M.FECHA_EVENTO DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const countQuery = `
        SELECT COUNT(*) AS total
        FROM METRICAS_ACCESO M
        ${whereClause}
    `;

    const statsQuery = `
        SELECT
            COUNT(*) AS total_eventos,
            COUNT(*) FILTER (WHERE CLASIFICACION_COMPORTAMIENTO = 'SOSPECHOSO') AS sospechosos,
            COUNT(*) FILTER (WHERE MOTIVO = 'BLOQUEADO_RATE_LIMIT') AS bloqueados_rate_limit,
            COUNT(*) FILTER (WHERE MOTIVO = 'EXITOSO') AS exitosos,
            COUNT(*) FILTER (WHERE MOTIVO IN ('CREDENCIALES_INVALIDAS', 'CAPTCHA_INVALIDO')) AS fallidos
        FROM METRICAS_ACCESO
    `;

    const queryValues = [...values, limit, offset];
    const countValues = values.slice(0, paramIndex - 1);

    const [eventosResult, countResult, statsResult] = await Promise.all([
        pool.query(query, queryValues),
        pool.query(countQuery, countValues),
        pool.query(statsQuery)
    ]);

    return {
        eventos: eventosResult.rows,
        total: parseInt(countResult.rows[0]?.total || 0, 10),
        stats: statsResult.rows[0] || {
            total_eventos: 0,
            sospechosos: 0,
            bloqueados_rate_limit: 0,
            exitosos: 0,
            fallidos: 0
        }
    };
};

module.exports = {
    registrarAutor,
    buscarUsuarioPorEmail,
    obtenerAutorPorId,
    obtenerSexos,
    obtenerAutores,
    actualizarAutor,
    eliminarAutor,
    registrarEventoAcceso,
    crearTokenVerificacion,
    verificarEmailPorToken,
    actualizarContrasenaHash,
    obtenerMetricasAcceso
};
