const articuloModel = require('../models/articuloModel');

const obtenerTodas = async (req, res) => {
    try {
        const publicaciones = await articuloModel.obtenerPublicacionesActivas();
        res.json(publicaciones);
    } catch (error) {
        console.error('Error al obtener publicaciones:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

const obtenerPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const publicacion = await articuloModel.obtenerPublicacionPorId(id);

        if (!publicacion) {
            return res.status(404).json({ error: 'Publicación no encontrada' });
        }

        res.json(publicacion);
    } catch (error) {
        console.error('Error al obtener la publicación:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

module.exports = {
    obtenerTodas,
    obtenerPorId
};
