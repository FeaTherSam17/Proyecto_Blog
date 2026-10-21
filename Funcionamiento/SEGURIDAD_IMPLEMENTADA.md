# Seguridad implementada en TAD_BLOG

Este documento describe las funciones actuales del proyecto relacionadas con
registro de autores, autenticación, verificación de correo, protección contra
automatización y controles de seguridad.

La documentación distingue entre:

- **Implementado:** el control ya existe en el código actual.
- **Parcial:** existe una protección, pero todavía tiene limitaciones.
- **Pendiente:** es una mejora identificada que aún no se ha aplicado.

## 1. Arquitectura general

El proyecto está dividido en:

- **Frontend:** Vue 3.
- **Backend:** Node.js con Express.
- **Base de datos:** PostgreSQL.
- **Sesiones:** `express-session`.
- **Contenedores:** Docker Compose.
- **Correo:** SMTP mediante Nodemailer.

Las rutas principales del backend son:

```text
/api/auth
/api/blog
/api/admin
```

El backend es la autoridad de seguridad. Las validaciones del frontend
solamente mejoran la experiencia del usuario y no sustituyen las validaciones
del servidor.

## 2. Registro de autores

El registro público se encuentra en:

- `src/controllers/authController.js`
- `src/routes/authRoutes.js`
- `frontend/src/views/Registro.vue`

Durante el registro se validan:

- Campos obligatorios.
- Nombre.
- Apellidos.
- Sexo.
- Correo electrónico.
- Teléfono de diez dígitos.
- Biografía.
- Longitudes máximas.
- Formato básico del correo.

El correo se normaliza antes de utilizarlo en las consultas correspondientes y
la base de datos impone una restricción de unicidad para evitar registros
duplicados con la misma dirección.

### Estado inicial de una cuenta

Los autores que se registran desde el formulario público se crean con:

```text
ESTADO_USUARIO = PENDIENTE_VERIFICACION
EMAIL_VERIFICADO = FALSE
```

Esto significa que un registro no se convierte inmediatamente en una cuenta
activa. El usuario debe demostrar que controla el correo electrónico indicado.

Los autores creados por un administrador siguen un flujo diferente y pueden
crearse como cuentas activas porque el administrador controla esa operación.

## 3. Verificación de correo electrónico

La verificación se implementa mediante:

- `src/services/emailService.js`
- `src/controllers/authController.js`
- `src/models/usuarioModel.js`
- `frontend/src/views/VerificarCorreo.vue`
- `BD/migracion-verificacion-correo.sql`

### Flujo de verificación

1. El usuario envía el formulario de registro.
2. El backend crea la cuenta como pendiente.
3. Se genera un token criptográficamente aleatorio.
4. El token original se envía por correo.
5. En la base de datos solo se guarda el hash SHA-256 del token.
6. El token expira después de 30 minutos.
7. El usuario abre el enlace recibido.
8. El backend vuelve a calcular el hash del token.
9. Se valida que el token exista, no haya expirado y no se haya utilizado.
10. La cuenta cambia a `ACTIVO`.
11. El token se marca como usado.

El endpoint de verificación es:

```http
GET /api/auth/verificar-correo?token=...
```

Un token usado o expirado ya no puede reutilizarse.

### Reenvío de verificación

También existe:

```http
POST /api/auth/reenviar-verificacion
```

La respuesta es genérica para no revelar si un correo está registrado. Esto
reduce el riesgo de enumeración de cuentas.

## 4. Migración aplicada en PostgreSQL

La migración para una base existente está en:

```text
BD/migracion-verificacion-correo.sql
```

La migración agrega:

```text
USUARIOS.EMAIL_VERIFICADO
USUARIOS.FECHA_VERIFICACION
TOKENS_VERIFICACION_EMAIL
```

También permite el estado:

```text
PENDIENTE_VERIFICACION
```

La migración utiliza `IF NOT EXISTS` en columnas, tabla e índices para
reducir el riesgo de errores si se ejecuta nuevamente.

Las cuentas que ya estaban activas se marcan como verificadas para evitar que
los usuarios existentes pierdan el acceso después del cambio.

### Tabla de tokens

La tabla `TOKENS_VERIFICACION_EMAIL` contiene:

- Identificador del token.
- Usuario relacionado.
- Hash del token.
- Fecha de expiración.
- Fecha de uso.
- Fecha de creación.

No contiene el valor original que recibió el usuario.

## 5. Contraseñas

Las contraseñas nuevas se almacenan con `bcryptjs` usando un costo de 12.

El registro y la actualización de autores no guardan la contraseña original.
Durante el login se utiliza `bcrypt.compare`.

También se agregó una transición para actualizar credenciales antiguas a
bcrypt después de un login válido. Esta transición es temporal y debe
eliminarse después de confirmar que todas las contraseñas antiguas fueron
migradas o restablecidas.

### Recomendación pendiente

Todavía debe eliminarse completamente la compatibilidad con comparación de
contraseñas en texto plano y establecer una política formal de contraseñas,
incluyendo una longitud mínima.

## 6. Inicio y cierre de sesión

La aplicación utiliza sesiones de Express.

Después de un login válido se guardan en la sesión:

- Identificador del usuario.
- Nombre.
- Correo.
- Rol.

El logout destruye la sesión y elimina la cookie de sesión.

Los roles disponibles son:

```text
ADMIN
AUTOR
```

La autorización real se realiza en el backend. Los guards del frontend solo
controlan la navegación y no deben considerarse una barrera de seguridad.

## 7. Autorización administrativa

Las rutas administrativas se encuentran en:

```text
src/routes/adminRoutes.js
```

Estas rutas aplican dos controles:

1. El usuario debe tener una sesión válida.
2. Las operaciones administrativas requieren el rol `ADMIN`.

Los autores pueden administrar sus propias publicaciones según las
restricciones aplicadas por los modelos y controladores.

Las consultas a PostgreSQL utilizan parámetros (`$1`, `$2`, etc.), lo que
reduce el riesgo de inyección SQL convencional.

## 8. Protección CSRF

CSRF significa **Cross-Site Request Forgery**, o falsificación de solicitudes
entre sitios.

El ataque ocurre cuando un sitio malicioso intenta enviar una petición al blog
utilizando automáticamente la cookie de sesión que el navegador ya tiene
almacenada.

Ejemplo:

1. El autor inicia sesión.
2. El navegador guarda la cookie de sesión.
3. El autor visita otra página maliciosa.
4. Esa página intenta enviar una petición para crear o eliminar contenido.
5. El navegador podría adjuntar la cookie del blog.

Para mitigarlo se implementó:

- `src/middleware/csrf.js`
- `GET /api/auth/csrf-token`
- Encabezado `X-CSRF-Token`
- Validación de `Origin`
- Comparación de token en tiempo constante

Las operaciones de modificación deben enviar el token CSRF:

- `POST`
- `PUT`
- `PATCH`
- `DELETE`

Esto incluye registro, login, logout, reenvío de verificación y operaciones
administrativas.

El frontend obtiene el token mediante:

```text
frontend/src/services/api.js
```

CSRF no sustituye la autenticación ni la autorización. Su función es proteger
las acciones que utilizan una sesión existente.

## 9. Rate limiting

El rate limiting se encuentra en:

```text
src/middleware/rateLimiter.js
```

### API general

La API limita aproximadamente:

```text
300 solicitudes cada 15 minutos
```

Cuando se supera el límite se devuelve `HTTP 429` y el encabezado
`Retry-After`.

### Login

El login tiene límites más estrictos:

- Cinco intentos por minuto en condiciones normales.
- Tres intentos si la actividad es moderadamente sospechosa.
- Dos intentos si la actividad es altamente sospechosa.

El controlador también conserva un contador de intentos fallidos y puede
bloquear temporalmente el flujo.

### Registro

El registro público está limitado a:

```text
3 registros por hora
```

Esto reduce registros automatizados y evita consumir excesivamente el servicio
SMTP.

### Limitaciones actuales

Los contadores se almacenan en memoria del proceso. Por lo tanto:

- Se reinician al reiniciar el backend.
- No se comparten entre varias instancias.
- No son suficientes por sí solos contra una botnet o muchas IP.

En una futura mejora deben trasladarse a Redis u otro almacenamiento
compartido.

## 10. CAPTCHA y detección de bots

El login utiliza un CAPTCHA matemático generado en el backend y guardado en la
sesión. La respuesta correcta nunca se envía al frontend.

El CAPTCHA se elimina después de evaluarse para evitar reutilización.

También existe detección pasiva de bots mediante:

- User-Agent.
- Referer.
- Accept-Language.
- Frecuencia de solicitudes.
- `navigator.webdriver`.
- Actividad de teclado.
- Actividad del mouse.
- Tiempo de interacción.

Estos datos son señales de riesgo y no deben considerarse una prueba de
identidad, porque un cliente puede falsificarlos.

La modificación dinámica de identificadores HTML dificulta automatizaciones
simples, pero no es una barrera de seguridad suficiente contra un bot avanzado.

## 11. Cloudflare Turnstile

El proyecto tiene integración con Cloudflare Turnstile para controlar el
acceso al contenido del blog.

Las variables relacionadas son:

```text
VITE_TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY
```

### Estado actual

Turnstile protege el acceso al blog, pero todavía debe integrarse también en el
registro público para impedir que los bots creen grandes cantidades de
cuentas pendientes.

En producción, la ausencia de `TURNSTILE_SECRET_KEY` debería bloquear la
operación en lugar de permitirla.

## 12. Protección contra cuentas basura

La verificación de correo impide que una cuenta no confirmada inicie sesión y
publique como autor.

Sin embargo, una persona o bot todavía puede intentar crear cuentas
`PENDIENTE_VERIFICACION`. Las defensas actuales reducen este comportamiento:

- Rate limit de registro.
- CSRF.
- Correo único.
- Token con expiración.
- No permitir login antes de verificar.

### Pendientes recomendados

Para evitar que la tabla crezca con cuentas abandonadas se debe agregar:

1. Turnstile al registro.
2. Rate limit por IP.
3. Rate limit por dirección de correo.
4. Limpieza periódica de cuentas pendientes antiguas.
5. Limpieza de tokens expirados y usados.

La limpieza debe eliminar únicamente cuentas pendientes, no verificadas y sin
publicaciones.

## 13. Auditoría y logs

El proyecto registra información de acceso mediante Morgan y PostgreSQL.

Se registran datos como:

- IP.
- Método HTTP.
- URL.
- Estado de respuesta.
- Duración.
- User-Agent.
- Nivel de detección de bot.
- Correo ingresado en intentos de autenticación.
- Motivo del resultado.

Los administradores tienen rutas para consultar y descargar información de
auditoría.

### Consideraciones pendientes

Se debe definir:

- Retención de logs.
- Rotación de archivos.
- Redacción de datos personales.
- Auditoría de descargas.
- Protección de los archivos de logs.
- Eliminación de registros antiguos.

## 14. Base de datos y consultas

El esquema incluye:

- Usuarios.
- Autores.
- Categorías.
- Publicaciones.
- Catálogo de sexos.
- Métricas de acceso.
- Tokens de verificación.

Existen restricciones para:

- Correos únicos.
- Roles válidos.
- Estados válidos.
- Relaciones entre tablas.
- Teléfonos.
- Apellidos.

Las consultas de la aplicación están parametrizadas.

### Pendientes de base de datos

- Limpiar tokens antiguos.
- Agregar una tarea de limpieza de cuentas pendientes.
- Revisar la validación TLS hacia Neon.
- Definir retención de métricas.
- Evitar credenciales débiles en configuraciones de ejemplo.

## 15. Docker y configuración

Docker Compose incluye:

- PostgreSQL.
- Backend.
- Frontend.
- Healthcheck.
- Volumen persistente.
- Variables SMTP.
- Variables de Turnstile.

La configuración actual está orientada principalmente a desarrollo:

- Usa `npm run dev`.
- Utiliza volúmenes con el código fuente.
- Tiene credenciales predeterminadas en el archivo.
- Expone PostgreSQL al host.

Para producción se recomienda:

- Usar `npm ci`.
- Construir imágenes inmutables.
- Ejecutar `npm start`.
- No montar el código fuente.
- No usar contraseñas predeterminadas.
- No exponer PostgreSQL públicamente sin necesidad.
- Administrar secretos desde el proveedor de despliegue.

## 16. Mejoras pendientes prioritarias

### Prioridad crítica

1. Agregar Turnstile al registro.
2. Eliminar la compatibilidad con contraseñas en texto plano.
3. Cambiar secretos y credenciales débiles.
4. Regenerar el identificador de sesión después del login.
5. Usar almacenamiento compartido para sesiones y rate limits.
6. Agregar `X-CSRF-Token` a los encabezados permitidos por CORS.

### Prioridad alta

1. Agregar limpieza automática de cuentas pendientes.
2. Eliminar tokens expirados y usados.
3. Escapar nombres usados en el HTML del correo.
4. Hacer que Turnstile falle de forma cerrada en producción.
5. Agregar encabezados de seguridad.
6. Corregir la validación TLS hacia Neon.
7. Agregar límites de tamaño a publicaciones y paginación.
8. Establecer una política de contraseñas.

### Prioridad media

1. Agregar pruebas automatizadas.
2. Cambiar la verificación que modifica estado mediante GET a un flujo
   tolerante a scanners de correo.
3. Definir retención y redacción de logs.
4. Reemplazar la escritura síncrona de logs.
5. Preparar una imagen Docker específica para producción.

## 17. Pruebas realizadas hasta ahora

Se validó:

- Sintaxis de los archivos JavaScript del backend.
- Compilación del frontend con Vite.
- Integración de la vista de verificación.
- Integración de las rutas de autenticación.
- Generación y uso de tokens.
- Uso de bcrypt para nuevas contraseñas.

El proyecto todavía no tiene una suite automatizada completa. El comando de
pruebas actual debe reemplazarse por pruebas reales de:

- Registro.
- Verificación.
- Login.
- Logout.
- CSRF.
- Rate limiting.
- Autorización por rol.
- Expiración y reutilización de tokens.
- Acceso de autores a publicaciones ajenas.

## 18. Conclusión

La aplicación ya cuenta con una base importante de seguridad. El registro
público no activa directamente a los autores y exige demostrar el control del
correo mediante un token temporal.

La protección actual evita que las cuentas no verificadas publiquen, pero no
impide completamente que un atacante intente llenar la tabla con registros
pendientes. Para ese escenario, las mejoras más importantes son:

```text
Turnstile en registro
    +
rate limit por IP y correo
    +
limpieza automática de pendientes
    +
almacenamiento compartido de límites
```

La migración de correo ya puede permanecer aplicada en Neon mientras se
implementan gradualmente las siguientes mejoras.
