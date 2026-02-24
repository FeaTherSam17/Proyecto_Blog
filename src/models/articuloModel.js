const pool = require('../config/db');

// Obtener todas las publicaciones activas con datos del autor y categoría
const obtenerPublicacionesActivas = async () => {
    const query = `
        SELECT 
            P.ID_PUBLICACION, 
            P.TITULO, 
            P.FECHA_PUBLICACION, 
            P.TEXTO_PUBLICACION,
            A.NOMBRE AS AUTOR_NOMBRE,
            C.NOMBRE_CATEGORIA
        FROM PUBLICACIONES P
        INNER JOIN AUTORES A ON P.ID_AUTOR = A.ID_AUTOR
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
            CONCAT_WS(' ', A.NOMBRE, A.PRIMER_APELLIDO, A.SEGUNDO_APELLIDO) AS AUTOR_NOMBRE,
            C.NOMBRE_CATEGORIA
        FROM PUBLICACIONES P
        INNER JOIN AUTORES A ON P.ID_AUTOR = A.ID_AUTOR
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
    crearPublicacion,
    obtenerCategorias 
};



