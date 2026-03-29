const { createApp } = Vue;

createApp({
    data() {
        return {
            publicaciones: [],
            publicacionActual: null,
            categorias: [],
            categoriaSeleccionada: null,
            sexos: [],
            loginData: {
                email: '',
                contrasena: ''
            },
            registroData: {
                nombre: '',
                primer_apellido: '',
                segundo_apellido: '',
                cod_sexo: '',
                email: '',
                telefono: '',
                biografia: '',
                contrasena: ''
            },
            nuevaEntrada: {
                titulo: '',
                id_categoria: '',
                texto_publicacion: ''
            },
            mostrarFormulario: false,
            creandoPublicacion: false,
            errorMsg: '',
            cargando: false,
            usuarioActual: null,
            editandoPublicacionId: null,
            seccionPanel: 'publicaciones',
            mostrarModalAutorPanel: false,
            filtrosPublicacionesPanel: {
                autor: '',
                estatus: '',
                fechaDesde: '',
                fechaHasta: ''
            },
            filtroAutoresPanel: '',
            publicacionesPanel: [
                { id: 1, titulo: 'Introduccion a NoSQL', autor: 'ANA PEREZ', fecha: '2026-03-12', estatus: 'ACTIVO' },
                { id: 2, titulo: 'Modelado de Documentos', autor: 'LUIS RAMOS', fecha: '2026-02-28', estatus: 'BORRADOR' },
                { id: 3, titulo: 'Indices y Rendimiento', autor: 'CARLA NUNEZ', fecha: '2026-01-18', estatus: 'INACTIVO' }
            ],
            autoresPanel: [
                {
                    id: 1,
                    nombre: 'ANA',
                    primer_apellido: 'PEREZ',
                    segundo_apellido: 'LOPEZ',
                    sexo: 'F',
                    email: 'ana@blog.com',
                    telefono: '9991234567',
                    biografia: 'Editora y autora de tecnologia.',
                    contrasena: '******',
                    estatus: 'ACTIVO'
                },
                {
                    id: 2,
                    nombre: 'LUIS',
                    primer_apellido: 'RAMOS',
                    segundo_apellido: 'DIAZ',
                    sexo: 'M',
                    email: 'luis@blog.com',
                    telefono: '9995551122',
                    biografia: 'Redactor de bases de datos.',
                    contrasena: '******',
                    estatus: 'ACTIVO'
                }
            ],
            nuevoAutorPanel: {
                nombre: '',
                primer_apellido: '',
                segundo_apellido: '',
                sexo: '',
                email: '',
                telefono: '',
                biografia: '',
                contrasena: ''
            }
        };
    },
    mounted() {
        if (window.location.pathname.includes('inicio.html') || window.location.pathname === '/') {
            this.cargarPublicaciones();
            this.cargarCategorias();
            this.chequearAutenticacion();
        }
        if (window.location.pathname.includes('articulo.html')) {
            this.cargarPublicacionUnica();
        }
        if (window.location.pathname.includes('admin.html')) {
            this.cargarCategorias();
            this.chequearAutenticacion();
            this.cargarPublicacionesAdmin();
        }
        if (window.location.pathname.includes('registro.html')) {
            this.cargarSexos();
        }
        if (window.location.pathname.includes('adminPanel.html')) {
            this.seccionPanel = 'publicaciones';
        }
    },
    computed: {
        publicacionesFiltradasPanel() {
            return this.publicacionesPanel.filter((pub) => {
                const autor = (this.filtrosPublicacionesPanel.autor || '').toUpperCase().trim();
                const estatus = this.filtrosPublicacionesPanel.estatus || '';
                const fechaDesde = this.filtrosPublicacionesPanel.fechaDesde || '';
                const fechaHasta = this.filtrosPublicacionesPanel.fechaHasta || '';

                const coincideAutor = !autor || pub.autor.toUpperCase().includes(autor);
                const coincideEstatus = !estatus || pub.estatus === estatus;
                const coincideFechaDesde = !fechaDesde || pub.fecha >= fechaDesde;
                const coincideFechaHasta = !fechaHasta || pub.fecha <= fechaHasta;

                return coincideAutor && coincideEstatus && coincideFechaDesde && coincideFechaHasta;
            });
        },
        autoresFiltradosPanel() {
            const termino = (this.filtroAutoresPanel || '').toUpperCase().trim();
            if (!termino) {
                return this.autoresPanel;
            }

            return this.autoresPanel.filter((autor) => {
                const nombreCompleto = this.nombreCompletoAutorPanel(autor).toUpperCase();
                const email = (autor.email || '').toUpperCase();
                return nombreCompleto.includes(termino) || email.includes(termino);
            });
        }
    },
    methods: {
        async cargarPublicaciones() {
            try {
                const res = await fetch('/api/blog/posts');
                const data = await res.json();
                this.publicaciones = data;
            } catch (err) {
                console.error("Error al cargar publicaciones", err);
            }
        },
        async cargarPublicacionUnica() {
            const urlParams = new URLSearchParams(window.location.search);
            const id = urlParams.get('id');
            if (!id) return;

            try {
                const res = await fetch(`/api/blog/posts/${id}`);
                if (res.ok) {
                    this.publicacionActual = await res.json();
                } else {
                    this.errorMsg = 'Artículo no encontrado';
                }
            } catch (err) {
                console.error("Error al cargar la publicación", err);
            }
        },
        async hacerLogin() {
            this.cargando = true;
            this.errorMsg = '';
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.loginData)
                });
                const data = await res.json();

                if (res.ok) {
                    this.usuarioActual = {
                        email: this.loginData.email,
                        rol: data.rol
                    };
                    window.location.href = data.redireccionar;
                } else {
                    this.errorMsg = data.error || 'Autenticación fallida';
                }
            } catch (err) {
                this.errorMsg = 'Error al contactar con el servidor';
            } finally {
                this.cargando = false;
            }
        },
        async hacerRegistro() {
            this.cargando = true;
            this.errorMsg = '';

            // VALIDACIÓN FRONTEND: Comprobamos antes de gastar recursos enviando al backend
            if (!this.registroData.primer_apellido && !this.registroData.segundo_apellido) {
                this.errorMsg = 'Por favor, proporciona al menos tu primer o segundo apellido.';
                this.cargando = false;
                return; // Detenemos la ejecución aquí
            }

            try {
                const res = await fetch('/api/auth/registro', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.registroData)
                });
                
                const data = await res.json();

                if (res.ok) {
                    // Si el registro es exitoso, lo enviamos al login
                    alert('¡Registro exitoso! Ahora puedes iniciar sesión.');
                    window.location.href = '/login.html';
                } else {
                    // Si el backend devuelve un error (email repetido, faltan datos, etc.)
                    this.errorMsg = data.error || 'Error al crear la cuenta';
                }
            } catch (err) {
                this.errorMsg = 'Error al contactar con el servidor';
            } finally {
                this.cargando = false;
            }
        },

        async cargarSexos() {
            try {
                const res = await fetch('/api/auth/sexos');
                if (res.ok) {
                    this.sexos = await res.json();
                } else {
                    console.error('Error al obtener los sexos del servidor');
                }
            } catch (err) {
                console.error('Error de red al cargar sexos:', err);
            }
        },


        async chequearAutenticacion() {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    this.usuarioActual = data.usuario || data.autor;
                } else {
                    // Solo redirige a login si estás en la página de admin
                    if (window.location.pathname.includes('admin.html')) {
                        window.location.href = '/login.html';
                    }
                }
            } catch (err) {
                if (window.location.pathname.includes('admin.html')) {
                    window.location.href = '/login.html';
                }
            }
        },
        
        async cargarPublicacionesAdmin() {
            try {
                const res = await fetch('/api/admin/panel');
                if (res.ok) {
                    this.publicaciones = await res.json();
                } else {
                    if (res.status === 401) window.location.href = '/login.html';
                }
            } catch (err) {
                console.error("Error admin fetching", err);
            }
        },
       async cerrarSesion() {
            try {
                await fetch('/api/auth/logout', { method: 'POST' });
                window.location.href = '/inicio.html'; // <-- CAMBIA ESTO AQUÍ
            } catch (err) {
                console.error("Error cerrando sesión");
            }
        },
        
        async cargarCategorias() {
            try {
                const res = await fetch('/api/blog/categorias');
                if (res.ok) {
                    this.categorias = await res.json();
                } else {
                    console.error('Error al obtener las categorías del servidor');
                }
            } catch (err) {
                console.error('Error de red al cargar categorías:', err);
            }
        },

        seleccionarCategoria(cat) {
            // Si hacemos clic en la categoría que ya está abierta, la cerramos
            if (this.categoriaSeleccionada && this.categoriaSeleccionada.id_categoria === cat.id_categoria) {
                this.categoriaSeleccionada = null;
            } else {
                // Si es una nueva, mostramos su información
                this.categoriaSeleccionada = cat;
            }
        },


        async guardarPublicacion() {
            this.creandoPublicacion = true;
            this.errorMsg = '';
            try {
                const url = this.editandoPublicacionId
                    ? `/api/admin/publicaciones/${this.editandoPublicacionId}`
                    : '/api/admin/publicaciones';
                const method = this.editandoPublicacionId ? 'PUT' : 'POST';

                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.nuevaEntrada)
                });

                if (res.ok) {
                    this.resetFormulario();
                    this.cargarPublicacionesAdmin(); // Recargar lista
                } else {
                    const data = await res.json();
                    this.errorMsg = data.error || 'Error al crear la publicación';
                }
            } catch (err) {
                this.errorMsg = 'Error al contactar con el servidor';
            } finally {
                this.creandoPublicacion = false;
            }
        },
        async cargarPublicacionParaEditar(id_publicacion) {
            this.errorMsg = '';
            try {
                const res = await fetch(`/api/admin/publicaciones/${id_publicacion}`);
                if (res.ok) {
                    const data = await res.json();
                    this.nuevaEntrada = {
                        titulo: data.titulo || '',
                        id_categoria: data.id_categoria || '',
                        texto_publicacion: data.texto_publicacion || ''
                    };
                    this.editandoPublicacionId = id_publicacion;
                    this.mostrarFormulario = true;
                } else {
                    const errData = await res.json();
                    this.errorMsg = errData.error || 'Error al cargar la publicación';
                }
            } catch (err) {
                this.errorMsg = 'Error al contactar con el servidor';
            }
        },
        resetFormulario() {
            this.mostrarFormulario = false;
            this.editandoPublicacionId = null;
            this.nuevaEntrada = { titulo: '', id_categoria: '', texto_publicacion: '' };
        },
        toggleFormulario() {
            if (this.mostrarFormulario) {
                this.resetFormulario();
                return;
            }
            this.mostrarFormulario = true;
        },
        async eliminarPublicacion(id_publicacion) {
            if (!confirm('¿Deseas eliminar esta publicación?')) return;

            this.errorMsg = '';
            try {
                const res = await fetch(`/api/admin/publicaciones/${id_publicacion}`, {
                    method: 'DELETE'
                });

                if (res.ok) {
                    this.cargarPublicacionesAdmin();
                } else {
                    const data = await res.json();
                    this.errorMsg = data.error || 'Error al eliminar la publicación';
                }
            } catch (err) {
                this.errorMsg = 'Error al contactar con el servidor';
            }
        },
        formatearFecha(fechaStr) {
            const fecha = new Date(fechaStr);
            return fecha.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase();
        },
        accionPublicacion(event, pub) {
    const accion = event.target.value;

    // Regresar el "combo" a ACCIONES después de elegir
    event.target.value = "";

    if (accion === "editar") {
        this.cargarPublicacionParaEditar(pub.id_publicacion);
        return;
    }

    if (accion === "eliminar") {
        this.eliminarPublicacion(pub.id_publicacion);
        return;
    }
},
        setSeccionPanel(seccion) {
            this.seccionPanel = seccion;
        },
        abrirModalAutorPanel() {
            this.mostrarModalAutorPanel = true;
        },
        cerrarModalAutorPanel() {
            this.mostrarModalAutorPanel = false;
            this.nuevoAutorPanel = {
                nombre: '',
                primer_apellido: '',
                segundo_apellido: '',
                sexo: '',
                email: '',
                telefono: '',
                biografia: '',
                contrasena: ''
            };
        },
        nombreCompletoAutorPanel(autor) {
            return `${autor.nombre || ''} ${autor.primer_apellido || ''} ${autor.segundo_apellido || ''}`.replace(/\s+/g, ' ').trim();
        },
        guardarAutorPanel() {
            const nuevo = {
                id: this.autoresPanel.length + 1,
                nombre: this.nuevoAutorPanel.nombre.trim().toUpperCase(),
                primer_apellido: this.nuevoAutorPanel.primer_apellido.trim().toUpperCase(),
                segundo_apellido: this.nuevoAutorPanel.segundo_apellido.trim().toUpperCase(),
                sexo: this.nuevoAutorPanel.sexo,
                email: this.nuevoAutorPanel.email.trim(),
                telefono: this.nuevoAutorPanel.telefono.trim(),
                biografia: this.nuevoAutorPanel.biografia.trim(),
                contrasena: this.nuevoAutorPanel.contrasena,
                estatus: 'ACTIVO'
            };

            const completo = nuevo.nombre && nuevo.primer_apellido && nuevo.segundo_apellido && nuevo.sexo && nuevo.email && nuevo.telefono && nuevo.biografia && nuevo.contrasena;
            if (!completo) return;

            this.autoresPanel.unshift(nuevo);
            this.seccionPanel = 'autores';
            this.cerrarModalAutorPanel();
        },
    }
}).mount('#app');
