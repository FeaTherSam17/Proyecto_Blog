const pool = require('../config/db');

// Obtener todas las publicaciones activas con datos del autor y categoría
const obtenerPublicacionesActivas = async () => {
    const query = `
        SELECT 
            P.ID_PUBLICACION, 
            P.TITULO, 
            P.FECHA_PUBLICACION, 
            P.TEXTO_PUBLICACION,
            CONCAT_WS(' ', U.NOMBRE, U.PRIMER_APELLIDO, U.SEGUNDO_APELLIDO) AS AUTOR_NOMBRE,
            C.NOMBRE_CATEGORIA
        FROM PUBLICACIONES P
        INNER JOIN AUTORES A ON P.ID_AUTOR = A.ID_AUTOR
        INNER JOIN USUARIOS U ON A.ID_AUTOR = U.ID_USUARIO
        INNER JOIN CATEGORIAS C ON P.ID_CATEGORIA = C.ID_CATEGORIA
        WHERE P.ESTADO_PUBLICACION = 'ACTIVO'
        ORDER BY P.FECHA_PUBLICACION DESC
    `;
    const result = await pool.query(query);
    return result.rows;
};

// Obtener una publicación específica por ID
const obtenerPublicacionPorId = async (id) => {
    const query = `
        SELECT 
            P.ID_PUBLICACION, 
            P.TITULO, 
            P.FECHA_PUBLICACION, 
            P.TEXTO_PUBLICACION,
            CONCAT_WS(' ', U.NOMBRE, U.PRIMER_APELLIDO, U.SEGUNDO_APELLIDO) AS AUTOR_NOMBRE,
            C.NOMBRE_CATEGORIA
        FROM PUBLICACIONES P
        INNER JOIN AUTORES A ON P.ID_AUTOR = A.ID_AUTOR
        INNER JOIN USUARIOS U ON A.ID_AUTOR = U.ID_USUARIO
        INNER JOIN CATEGORIAS C ON P.ID_CATEGORIA = C.ID_CATEGORIA
        WHERE P.ID_PUBLICACION = $1 AND P.ESTADO_PUBLICACION = 'ACTIVO'
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
};

// Obtener publicaciones de un autor específico (panel del autor — AUTOR role)
const obtenerPublicacionesPorAutor = async (id_autor, filtros = {}) => {
    const condiciones = ['P.ID_AUTOR = $1'];
    const values = [id_autor];
    let paramIndex = 2;

    if (filtros.autor && filtros.autor.trim()) {
        condiciones.push(`UPPER(CONCAT_WS(' ', U.NOMBRE, U.PRIMER_APELLIDO, U.SEGUNDO_APELLIDO)) LIKE UPPER($${paramIndex})`);
        values.push(`%${filtros.autor.trim()}%`);
        paramIndex += 1;
    }

    if (filtros.estatus && filtros.estatus.trim()) {
        condiciones.push(`P.ESTADO_PUBLICACION = $${paramIndex}`);
        values.push(filtros.estatus.trim());
        paramIndex += 1;
    }

    if (filtros.fechaDesde) {
        condiciones.push(`DATE(P.FECHA_PUBLICACION) >= $${paramIndex}`);
        values.push(filtros.fechaDesde);
        paramIndex += 1;
    }

    if (filtros.fechaHasta) {
        condiciones.push(`DATE(P.FECHA_PUBLICACION) <= $${paramIndex}`);
        values.push(filtros.fechaHasta);
        paramIndex += 1;
    }

    const query = `
        SELECT
            P.ID_PUBLICACION,
            P.TITULO,
            P.ESTADO_PUBLICACION,
            P.FECHA_PUBLICACION,
            CONCAT_WS(' ', U.NOMBRE, U.PRIMER_APELLIDO, U.SEGUNDO_APELLIDO) AS AUTOR_NOMBRE,
            C.NOMBRE_CATEGORIA
        FROM PUBLICACIONES P
        INNER JOIN AUTORES A ON P.ID_AUTOR = A.ID_AUTOR
        INNER JOIN USUARIOS U ON A.ID_AUTOR = U.ID_USUARIO
        INNER JOIN CATEGORIAS C ON P.ID_CATEGORIA = C.ID_CATEGORIA
        WHERE ${condiciones.join(' AND ')}
        ORDER BY P.FECHA_PUBLICACION DESC
    `;
    const result = await pool.query(query, values);
    return result.rows;
};

// Obtener TODAS las publicaciones (para panel de ADMIN) con filtros opcionales y paginación
const obtenerTodasPublicaciones = async (filtros = {}, limit = 10, offset = 0) => {
    const condiciones = [];
    const values = [];
    let paramIndex = 1;

    if (filtros.autor && filtros.autor.trim()) {
        condiciones.push(`UPPER(CONCAT_WS(' ', U.NOMBRE, U.PRIMER_APELLIDO, U.SEGUNDO_APELLIDO)) LIKE UPPER($${paramIndex})`);
        values.push(`%${filtros.autor.trim()}%`);
        paramIndex += 1;
    }

    if (filtros.estatus && filtros.estatus.trim()) {
        condiciones.push(`P.ESTADO_PUBLICACION = $${paramIndex}`);
        values.push(filtros.estatus.trim());
        paramIndex += 1;
    }

    if (filtros.fechaDesde) {
        condiciones.push(`DATE(P.FECHA_PUBLICACION) >= $${paramIndex}`);
        values.push(filtros.fechaDesde);
        paramIndex += 1;
    }

    if (filtros.fechaHasta) {
        condiciones.push(`DATE(P.FECHA_PUBLICACION) <= $${paramIndex}`);
        values.push(filtros.fechaHasta);
        paramIndex += 1;
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    // Agregar limit y offset al final del array de valores
    values.push(limit, offset);

    const query = `
        SELECT
            COUNT(*) OVER() AS total_registros,
            P.ID_PUBLICACION,
            P.TITULO,
            P.ESTADO_PUBLICACION,
            P.FECHA_PUBLICACION,
            CONCAT_WS(' ', U.NOMBRE, U.PRIMER_APELLIDO, U.SEGUNDO_APELLIDO) AS AUTOR_NOMBRE,
            C.NOMBRE_CATEGORIA,
            (
                SELECT COUNT(*) FROM PUBLICACIONES P2 WHERE P2.ID_AUTOR = P.ID_AUTOR
            ) AS TOTAL_POSTS_AUTOR
        FROM PUBLICACIONES P
        INNER JOIN AUTORES A ON P.ID_AUTOR = A.ID_AUTOR
        INNER JOIN USUARIOS U ON A.ID_AUTOR = U.ID_USUARIO
        INNER JOIN CATEGORIAS C ON P.ID_CATEGORIA = C.ID_CATEGORIA
        ${where}
        ORDER BY P.FECHA_PUBLICACION DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const result = await pool.query(query, values);
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_registros) : 0;

    return {
        publicaciones: result.rows.map(row => {
            const { total_registros, ...pub } = row;
            return pub;
        }),
        total
    };
};

// Obtener una publicación de un autor para edición
const obtenerPublicacionPorAutorId = async (id_publicacion, id_autor) => {
    const query = `
        SELECT 
            P.ID_PUBLICACION,
            P.TITULO,
            P.ID_CATEGORIA,
            P.TEXTO_PUBLICACION
        FROM PUBLICACIONES P
        WHERE P.ID_PUBLICACION = $1
            AND P.ID_AUTOR = $2
            AND P.ESTADO_PUBLICACION <> 'ELIMINADO'
    `;
    const result = await pool.query(query, [id_publicacion, id_autor]);
    return result.rows[0];
};

// Crear una nueva publicación
const crearPublicacion = async (publicacion) => {
    const { titulo, id_autor, id_categoria, texto_publicacion } = publicacion;
    const query = `
        INSERT INTO PUBLICACIONES (TITULO, ID_AUTOR, ID_CATEGORIA, TEXTO_PUBLICACION)
        VALUES ($1, $2, $3, $4)
        RETURNING ID_PUBLICACION
    `;
    const values = [titulo, id_autor, id_categoria, texto_publicacion];
    const result = await pool.query(query, values);
    return result.rows[0];
};

// Marcar una publicación como eliminada (eliminación lógica)
const eliminarPublicacion = async (id_publicacion, id_autor) => {
    const query = `
        UPDATE PUBLICACIONES
        SET ESTADO_PUBLICACION = 'ELIMINADO'
        WHERE ID_PUBLICACION = $1 AND ID_AUTOR = $2
        RETURNING ID_PUBLICACION
    `;
    const result = await pool.query(query, [id_publicacion, id_autor]);
    return result.rows[0];
};

// Actualizar publicación (solo del autor)
const actualizarPublicacion = async (id_publicacion, id_autor, datos) => {
    const { titulo, id_categoria, texto_publicacion } = datos;
    const query = `
        UPDATE PUBLICACIONES
        SET TITULO = $1,
            ID_CATEGORIA = $2,
            TEXTO_PUBLICACION = $3
        WHERE ID_PUBLICACION = $4
            AND ID_AUTOR = $5
            AND ESTADO_PUBLICACION <> 'ELIMINADO'
        RETURNING ID_PUBLICACION
    `;
    const values = [titulo, id_categoria, texto_publicacion, id_publicacion, id_autor];
    const result = await pool.query(query, values);
    return result.rows[0];
};

// Obtener todas las categorías disponibles
const obtenerCategorias = async () => {
    const query = 'SELECT ID_CATEGORIA, NOMBRE_CATEGORIA, DESCRIPCION FROM CATEGORIAS ORDER BY NOMBRE_CATEGORIA ASC';
    const result = await pool.query(query);
    return result.rows;
};

module.exports = {
    obtenerPublicacionesActivas,
    obtenerPublicacionPorId,
    obtenerPublicacionesPorAutor,
    obtenerTodasPublicaciones,
    obtenerPublicacionPorAutorId,
    crearPublicacion,
    eliminarPublicacion,
    actualizarPublicacion,
    obtenerCategorias
};