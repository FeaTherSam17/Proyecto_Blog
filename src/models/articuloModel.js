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

// Obtener publicaciones de un autor específico (para panel de admin)
const obtenerPublicacionesPorAutor = async (id_autor) => {
    const query = `
        SELECT 
            P.ID_PUBLICACION, 
            P.TITULO, 
            P.ESTADO_PUBLICACION,
            C.NOMBRE_CATEGORIA
        FROM PUBLICACIONES P
        INNER JOIN CATEGORIAS C ON P.ID_CATEGORIA = C.ID_CATEGORIA
        WHERE P.ID_AUTOR = $1
        ORDER BY P.FECHA_PUBLICACION DESC
    `;
    const result = await pool.query(query, [id_autor]);
    return result.rows;
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

// Marcar una publicación como inactiva (eliminación lógica)
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
    obtenerPublicacionPorAutorId,
    crearPublicacion,
    eliminarPublicacion,
    actualizarPublicacion,
    obtenerCategorias 
};



