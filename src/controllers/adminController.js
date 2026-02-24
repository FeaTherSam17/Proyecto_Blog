const articuloModel = require('../models/articuloModel');

const panelAdmin = async (req, res) => {
    try {
        const id_autor = req.session.usuarioId;
        const publicaciones = await articuloModel.obtenerPublicacionesPorAutor(id_autor);
        res.json(publicaciones);
    } catch (error) {
        console.error('Error al obtener el panel de admin:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

const crearPublicacion = async (req, res) => {
    try {
        const { titulo, id_categoria, texto_publicacion } = req.body;
        const id_autor = req.session.usuarioId;

        if (!titulo || !id_categoria || !texto_publicacion) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }

        if (titulo.length > 200) {
            return res.status(400).json({ error: 'El título no puede exceder los 200 caracteres' });
        }

        const nuevaPublicacion = {
            titulo,
            id_autor,
            id_categoria,
            texto_publicacion
        };

        

        const resultado = await articuloModel.crearPublicacion(nuevaPublicacion);
        res.status(201).json({ mensaje: 'Publicación creada exitosamente', id: resultado.id_publicacion });

    } catch (error) {
        console.error('Error al crear publicación:', error);
        res.status(500).json({ error: 'Error interno del servidor al crear' });
    }
};

module.exports = {
    panelAdmin,
    crearPublicacion
};
