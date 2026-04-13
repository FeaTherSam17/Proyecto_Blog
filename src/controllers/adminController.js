const articuloModel = require('../models/articuloModel');
const usuarioModel = require('../models/usuarioModel');

// Panel principal: si es ADMIN devuelve todas las publicaciones, si es AUTOR solo las suyas
const panelAdmin = async (req, res) => {
    try {
        const rol = (req.session.usuarioRol || '').toUpperCase();
        const filtros = {
            autor: req.query.autor,
            estatus: req.query.estatus,
            fechaDesde: req.query.fechaDesde,
            fechaHasta: req.query.fechaHasta
        };
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;

        let resultado;
        if (rol === 'ADMIN') {
            resultado = await articuloModel.obtenerTodasPublicaciones(filtros, limit, offset);
        } else {
            const id_autor = req.session.usuarioId;
            const publicaciones = await articuloModel.obtenerPublicacionesPorAutor(id_autor, filtros);
            resultado = { publicaciones, total: publicaciones.length };
        }

        res.json(resultado);
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

const eliminarPublicacion = async (req, res) => {
    try {
        const { id } = req.params;
        const id_autor = req.session.usuarioId;

        if (!id) {
            return res.status(400).json({ error: 'ID de publicación requerido' });
        }

        const resultado = await articuloModel.eliminarPublicacion(id, id_autor);
        if (!resultado) {
            return res.status(404).json({ error: 'Publicación no encontrada' });
        }

        res.json({ mensaje: 'Publicación eliminada' });
    } catch (error) {
        console.error('Error al eliminar publicación:', error);
        res.status(500).json({ error: 'Error interno del servidor al eliminar' });
    }
};

const obtenerPublicacionParaEditar = async (req, res) => {
    try {
        const { id } = req.params;
        const id_autor = req.session.usuarioId;

        if (!id) {
            return res.status(400).json({ error: 'ID de publicación requerido' });
        }

        const publicacion = await articuloModel.obtenerPublicacionPorAutorId(id, id_autor);
        if (!publicacion) {
            return res.status(404).json({ error: 'Publicación no encontrada' });
        }

        res.json(publicacion);
    } catch (error) {
        console.error('Error al obtener publicación para editar:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

const actualizarPublicacion = async (req, res) => {
    try {
        const { id } = req.params;
        const { titulo, id_categoria, texto_publicacion } = req.body;
        const id_autor = req.session.usuarioId;

        if (!id) {
            return res.status(400).json({ error: 'ID de publicación requerido' });
        }

        if (!titulo || !id_categoria || !texto_publicacion) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }

        if (titulo.length > 200) {
            return res.status(400).json({ error: 'El título no puede exceder los 200 caracteres' });
        }

        const resultado = await articuloModel.actualizarPublicacion(id, id_autor, {
            titulo,
            id_categoria,
            texto_publicacion
        });

        if (!resultado) {
            return res.status(404).json({ error: 'Publicación no encontrada' });
        }

        res.json({ mensaje: 'Publicación actualizada' });
    } catch (error) {
        console.error('Error al actualizar publicación:', error);
        res.status(500).json({ error: 'Error interno del servidor al actualizar' });
    }
};

const crearAutor = async (req, res) => {
    try {
        const { nombre, primer_apellido, segundo_apellido, cod_sexo, email, telefono, biografia, contrasena } = req.body;

        if (!nombre || !cod_sexo || !email || !telefono || !biografia || !contrasena) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }

        if (!primer_apellido && !segundo_apellido) {
            return res.status(400).json({ error: 'Debes proporcionar al menos un apellido' });
        }

        const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'El formato del email es inválido' });
        }

        const telefonoRegex = /^[0-9]{10}$/;
        if (!telefonoRegex.test(telefono)) {
            return res.status(400).json({ error: 'El teléfono debe tener exactamente 10 dígitos' });
        }

        if (biografia.length > 500) {
            return res.status(400).json({ error: 'La biografía no puede exceder los 500 caracteres' });
        }

        const resultado = await usuarioModel.registrarAutor({
            nombre: nombre.trim(),
            primer_apellido: primer_apellido ? primer_apellido.trim() : null,
            segundo_apellido: segundo_apellido ? segundo_apellido.trim() : null,
            cod_sexo,
            email: email.trim(),
            telefono: telefono.trim(),
            biografia: biografia.trim(),
            contrasena: contrasena.trim()
        });

        res.status(201).json({ mensaje: 'Autor creado exitosamente', autor: resultado });
    } catch (error) {
        console.error('Error al crear autor:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }
        res.status(500).json({ error: 'Error interno del servidor al crear autor' });
    }
};

const listarAutores = async (req, res) => {
    try {
        const q = req.query.q || '';
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;
        const autores = await usuarioModel.obtenerAutores(q, limit, offset);
        res.json(autores);
    } catch (error) {
        console.error('Error al obtener autores para el panel:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

const actualizarAutor = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nombre,
            primer_apellido,
            segundo_apellido,
            cod_sexo,
            email,
            telefono,
            biografia,
            contrasena
        } = req.body;

        if (!id) {
            return res.status(400).json({ error: 'ID de autor requerido' });
        }

        if (!nombre || !cod_sexo || !email || !telefono || !biografia) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }

        if (!primer_apellido && !segundo_apellido) {
            return res.status(400).json({ error: 'Debes proporcionar al menos un apellido' });
        }

        let contrasenaHash = null;
        if (contrasena && contrasena.trim()) {
            contrasenaHash = contrasena.trim();
        }

        const resultado = await usuarioModel.actualizarAutor(id, {
            nombre: nombre.trim(),
            primer_apellido: primer_apellido ? primer_apellido.trim() : null,
            segundo_apellido: segundo_apellido ? segundo_apellido.trim() : null,
            cod_sexo,
            email: email.trim(),
            telefono: telefono.trim(),
            biografia: biografia.trim(),
            contrasena: contrasenaHash
        });

        if (!resultado) {
            return res.status(404).json({ error: 'Autor no encontrado' });
        }

        res.json({ mensaje: 'Autor actualizado' });
    } catch (error) {
        console.error('Error al actualizar autor:', error);
        const errorMsg = error.detail || error.message || 'Error interno del servidor al actualizar autor';
        res.status(500).json({ error: errorMsg });
    }
};

const eliminarAutor = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ error: 'ID de autor requerido' });
        }

        if (Number(id) === Number(req.session.usuarioId)) {
            return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
        }

        const resultado = await usuarioModel.eliminarAutor(id);
        if (!resultado) {
            return res.status(404).json({ error: 'Autor no encontrado' });
        }

        res.json({ mensaje: 'Autor eliminado' });
    } catch (error) {
        console.error('Error al eliminar autor:', error);
        const msj = error.detail || error.message || 'Error interno del servidor al eliminar autor';
        res.status(500).json({ error: msj });
    }
};

module.exports = {
    panelAdmin,
    crearPublicacion,
    eliminarPublicacion,
    obtenerPublicacionParaEditar,
    actualizarPublicacion,
    listarAutores,
    crearAutor,
    actualizarAutor,
    eliminarAutor
};