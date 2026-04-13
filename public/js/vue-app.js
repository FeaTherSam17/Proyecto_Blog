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
            editandoAutorPanelId: null,
            filtrosPublicacionesPanel: {
                autor: '',
                estatus: '',
                fechaDesde: '',
                fechaHasta: ''
            },
            filtroAutoresPanel: '',
            publicacionesPanel: [],
            autoresPanel: [],
            paginaAutoresActual: 0,
            totalPaginasAutores: 0,
            paginaPublicacionesActual: 0,
            totalPaginasPublicaciones: 0,
            timerBusquedaPublicaciones: null,
            timerBusquedaAutores: null,
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
            this.chequearAutenticacion();
            this.cargarPublicacionesPanel();
            this.cargarAutoresPanel();
            this.cargarSexos();
        }
    },
    computed: {
        publicacionesFiltradasPanel() {
            return this.publicacionesPanel;
        },
        autoresFiltradosPanel() {
            return this.autoresPanel;
        },
        paginasPublicacionesVisibles() {
            return this.construirPaginadoVisible(this.totalPaginasPublicaciones, this.paginaPublicacionesActual);
        },
        paginasAutoresVisibles() {
            return this.construirPaginadoVisible(this.totalPaginasAutores, this.paginaAutoresActual);
        }
    },
    watch: {
        'filtrosPublicacionesPanel.autor'() {
            this.dispararBusquedaPublicaciones();
        },
        'filtrosPublicacionesPanel.estatus'() {
            this.dispararBusquedaPublicaciones();
        },
        'filtrosPublicacionesPanel.fechaDesde'() {
            this.dispararBusquedaPublicaciones();
        },
        'filtrosPublicacionesPanel.fechaHasta'() {
            this.dispararBusquedaPublicaciones();
        },
        filtroAutoresPanel() {
            this.dispararBusquedaAutores();
        }
    },
    methods: {
        construirPaginadoVisible(totalPaginas, paginaActual) {
            const total = Number(totalPaginas) || 0;
            const actual = Number(paginaActual) || 0;
            if (total <= 1) return [];

            if (total <= 7) {
                return Array.from({ length: total }, (_, idx) => ({ type: 'page', page: idx + 1 }));
            }

            // Devuelve un array de items: { type: 'page', page: number } o { type: 'ellipsis' }
            // `page` es 1-based para render; el índice real es `page - 1`.
            const items = [];
            const addPage = (page) => items.push({ type: 'page', page });
            const addEllipsis = () => {
                if (items.length === 0 || items[items.length - 1].type === 'ellipsis') return;
                items.push({ type: 'ellipsis' });
            };

            const currentPage = Math.min(Math.max(actual + 1, 1), total);

            // Ventana de páginas alrededor de la actual
            const windowSize = 2; // muestra actual ±2
            const start = Math.max(2, currentPage - windowSize);
            const end = Math.min(total - 1, currentPage + windowSize);

            addPage(1);

            if (start > 2) addEllipsis();

            for (let page = start; page <= end; page += 1) {
                addPage(page);
            }

            if (end < total - 1) addEllipsis();

            if (total > 1) addPage(total);

            return items;
        },
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
                    const rol = (data.rol || '').toUpperCase();
                    const destinoPorRol = rol === 'ADMIN' ? '/adminPanel.html' : '/inicio.html';

                    this.usuarioActual = {
                        email: this.loginData.email,
                        rol
                    };
                    window.location.href = data.redireccionar || destinoPorRol;
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

                    const rolActual = (this.usuarioActual?.rol || '').toUpperCase();
                    const enAdminPanel = window.location.pathname.includes('adminPanel.html');
                    const enAdminAutor = window.location.pathname.includes('admin.html') && !enAdminPanel;

                    // Si es ADMIN y está en el panel de autor → redirigir al panel de admin
                    if (rolActual === 'ADMIN' && enAdminAutor) {
                        window.location.href = '/adminPanel.html';
                        return;
                    }
                    // Si es ADMIN y no está en adminPanel → redirigir al adminPanel
                    if (rolActual === 'ADMIN' && !enAdminPanel) {
                        window.location.href = '/adminPanel.html';
                        return;
                    }
                } else {
                    // Sin sesión: redirigir a login si está en página protegida
                    if (window.location.pathname.includes('admin.html') || window.location.pathname.includes('adminPanel.html')) {
                        window.location.href = '/login.html';
                    }
                }
            } catch (err) {
                if (window.location.pathname.includes('admin.html') || window.location.pathname.includes('adminPanel.html')) {
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
                window.location.href = '/inicio.html'; // <-- Regresa al inico
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

            if (seccion === 'publicaciones') {
                this.cargarPublicacionesPanel();
            } else {
                this.cargarAutoresPanel();
            }
        },
        dispararBusquedaPublicaciones() {
            if (this.timerBusquedaPublicaciones) {
                clearTimeout(this.timerBusquedaPublicaciones);
            }
            this.timerBusquedaPublicaciones = setTimeout(() => {
                this.cargarPublicacionesPanel(0);
            }, 300);
        },
        dispararBusquedaAutores() {
            if (this.timerBusquedaAutores) {
                clearTimeout(this.timerBusquedaAutores);
            }
            this.timerBusquedaAutores = setTimeout(() => {
                this.cargarAutoresPanel();
            }, 300);
        },
        async cargarPublicacionesPanel(pagina = 0) {
            try {
                this.paginaPublicacionesActual = pagina;
                const limitStr = 10;

                const params = new URLSearchParams();
                if (this.filtrosPublicacionesPanel.autor) {
                    params.set('autor', this.filtrosPublicacionesPanel.autor);
                }
                if (this.filtrosPublicacionesPanel.estatus) {
                    params.set('estatus', this.filtrosPublicacionesPanel.estatus);
                }
                if (this.filtrosPublicacionesPanel.fechaDesde) {
                    params.set('fechaDesde', this.filtrosPublicacionesPanel.fechaDesde);
                }
                if (this.filtrosPublicacionesPanel.fechaHasta) {
                    params.set('fechaHasta', this.filtrosPublicacionesPanel.fechaHasta);
                }
                params.set('limit', limitStr);
                params.set('offset', this.paginaPublicacionesActual * limitStr);

                const res = await fetch(`/api/admin/panel?${params.toString()}`);
                if (!res.ok) {
                    if (res.status === 401) window.location.href = '/login.html';
                    return;
                }

                const payload = await res.json();
                const pubsDB = Array.isArray(payload) ? payload : (payload.publicaciones || []);
                const total = Array.isArray(payload) ? pubsDB.length : (payload.total || 0);

                this.publicacionesPanel = pubsDB.map((pub) => ({
                    id: pub.id_publicacion,
                    titulo: pub.titulo,
                    autor: pub.autor_nombre || '',
                    fecha: pub.fecha_publicacion,
                    estatus: pub.estado_publicacion,
                    totalPostsAutor: pub.total_posts_autor || 0
                }));

                this.totalPaginasPublicaciones = Math.ceil(total / limitStr);
            } catch (err) {
                console.error('Error al cargar publicaciones del panel:', err);
            }
        },
        async cargarAutoresPanel(pagina = 0) {
            try {
                this.paginaAutoresActual = pagina;

                const params = new URLSearchParams();
                if (this.filtroAutoresPanel) {
                    params.set('q', this.filtroAutoresPanel);
                }
                
                const limitStr = 10;
                params.set('limit', limitStr);
                params.set('offset', this.paginaAutoresActual * limitStr);

                const query = params.toString();
                const res = await fetch(`/api/admin/autores${query ? '?' + query : ''}`);
                if (!res.ok) {
                    if (res.status === 401) window.location.href = '/login.html';
                    return;
                }

                const payload = await res.json();
                const autoresDB = Array.isArray(payload) ? payload : (payload.autores || []);
                const total = Array.isArray(payload) ? autoresDB.length : (payload.total || 0);

                this.autoresPanel = autoresDB.map((autor) => ({
                    id: autor.id_autor,
                    nombre: autor.nombre,
                    primer_apellido: autor.primer_apellido,
                    segundo_apellido: autor.segundo_apellido,
                    sexo: autor.cod_sexo,
                    email: autor.email,
                    telefono: autor.telefono,
                    biografia: autor.biografia,
                    estatus: autor.estado_autor || autor.estado_usuario || 'ACTIVO'
                }));

                this.totalPaginasAutores = Math.ceil(total / limitStr);
            } catch (err) {
                console.error('Error al cargar autores del panel:', err);
            }
        },
        cambiarPaginaAutores(pagina) {
            if (pagina >= 0 && pagina < this.totalPaginasAutores) {
                this.cargarAutoresPanel(pagina);
            }
        },
        cambiarPaginaPublicaciones(pagina) {
            if (pagina >= 0 && pagina < this.totalPaginasPublicaciones) {
                this.cargarPublicacionesPanel(pagina);
            }
        },
        retrocederPaginaAutores() {
            this.cambiarPaginaAutores(this.paginaAutoresActual - 1);
        },
        avanzarPaginaAutores() {
            this.cambiarPaginaAutores(this.paginaAutoresActual + 1);
        },
        retrocederPaginaPublicaciones() {
            this.cambiarPaginaPublicaciones(this.paginaPublicacionesActual - 1);
        },
        avanzarPaginaPublicaciones() {
            this.cambiarPaginaPublicaciones(this.paginaPublicacionesActual + 1);
        },
        abrirModalAutorPanel() {
            this.errorMsg = '';
            this.editandoAutorPanelId = null;
            this.mostrarModalAutorPanel = true;
        },
        cerrarModalAutorPanel() {
            this.mostrarModalAutorPanel = false;
            this.editandoAutorPanelId = null;
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
        editarAutorPanel(autor) {
            this.errorMsg = '';
            this.editandoAutorPanelId = autor.id;
            this.nuevoAutorPanel = {
                nombre: autor.nombre || '',
                primer_apellido: autor.primer_apellido || '',
                segundo_apellido: autor.segundo_apellido || '',
                sexo: autor.sexo || '',
                email: autor.email || '',
                telefono: autor.telefono || '',
                biografia: autor.biografia || '',
                contrasena: ''
            };
            this.mostrarModalAutorPanel = true;
        },
        async eliminarAutorPanel(autor) {
            const confirmar = confirm(`¿Deseas eliminar al autor ${this.nombreCompletoAutorPanel(autor)}?`);
            if (!confirmar) return;

            this.errorMsg = '';
            try {
                const res = await fetch(`/api/admin/autores/${autor.id}`, {
                    method: 'DELETE'
                });

                const data = await res.json();
                if (!res.ok) {
                    this.errorMsg = data.error || 'No fue posible eliminar el autor';
                    return;
                }

                this.cargarAutoresPanel();
            } catch (err) {
                this.errorMsg = 'Error al contactar con el servidor';
            }
        },
        async guardarAutorPanel() {
            this.errorMsg = '';
            const payload = {
                nombre: this.nuevoAutorPanel.nombre.trim(),
                primer_apellido: this.nuevoAutorPanel.primer_apellido.trim(),
                segundo_apellido: this.nuevoAutorPanel.segundo_apellido.trim(),
                cod_sexo: this.nuevoAutorPanel.sexo,
                email: this.nuevoAutorPanel.email.trim(),
                telefono: this.nuevoAutorPanel.telefono.trim(),
                biografia: this.nuevoAutorPanel.biografia.trim(),
                contrasena: this.nuevoAutorPanel.contrasena
            };

            const completo = payload.nombre && payload.primer_apellido && payload.segundo_apellido && payload.cod_sexo && payload.email && payload.telefono && payload.biografia;
            if (!completo) {
                this.errorMsg = 'Por favor, llena todos los campos obligatorios.';
                return;
            }

            if (!this.editandoAutorPanelId && !payload.contrasena) {
                this.errorMsg = 'La contraseña es obligatoria para un autor nuevo.';
                return;
            }

            if (this.editandoAutorPanelId && !payload.contrasena) {
                delete payload.contrasena;
            }

            try {
                const esEdicion = !!this.editandoAutorPanelId;
                const endpoint = esEdicion
                    ? `/api/admin/autores/${this.editandoAutorPanelId}`
                    : '/api/admin/autores';
                const method = esEdicion ? 'PUT' : 'POST';

                const res = await fetch(endpoint, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (!res.ok) {
                    this.errorMsg = data.error || 'No fue posible registrar el autor';
                    return;
                }

                this.errorMsg = '';
                this.seccionPanel = 'autores';
                this.cerrarModalAutorPanel();
                this.cargarAutoresPanel();
            } catch (err) {
                this.errorMsg = 'Error al contactar con el servidor';
            }
        },
    }
}).mount('#app');