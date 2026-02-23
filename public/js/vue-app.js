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
            usuarioActual: null
        };
    },
    mounted() {
        if (window.location.pathname.includes('inicio.html') || window.location.pathname === '/') {
            this.cargarPublicaciones();
            this.cargarCategorias();
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
                if (!res.ok) {
                    window.location.href = '/login.html';
                } else {
                    const data = await res.json();
                    this.usuarioActual = data.autor;
                }
            } catch (err) {
                window.location.href = '/login.html';
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
                window.location.href = '/login.html';
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


        async crearPublicacion() {
            this.creandoPublicacion = true;
            this.errorMsg = '';
            try {
                const res = await fetch('/api/admin/publicaciones', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.nuevaEntrada)
                });

                if (res.ok) {
                    this.mostrarFormulario = false;
                    this.nuevaEntrada = { titulo: '', id_categoria: '', texto_publicacion: '' };
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
        formatearFecha(fechaStr) {
            const fecha = new Date(fechaStr);
            return fecha.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase();
        }
    }
}).mount('#app');
