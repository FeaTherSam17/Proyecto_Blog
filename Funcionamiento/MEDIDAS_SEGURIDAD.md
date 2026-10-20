# Medidas de seguridad implementadas

Este documento describe las medidas de seguridad incorporadas en `TAD_BLOG`,
su ubicación, flujo de ejecución, alcance y archivos afectados.

## Resumen

Actualmente el proyecto cuenta con estas medidas principales:

1. Ofuscación ligera de identificadores del formulario de acceso.
2. CAPTCHA matemático en el login.
3. Rate limit para intentos de autenticación.
4. Detección pasiva o no invasiva de bots.
5. Auditoría de accesos y eventos de autenticación.
6. Cloudflare Turnstile para proteger la entrada al blog.
7. Sesiones de Express para conservar autenticación y autorización temporal.
8. Validaciones de entrada en frontend y backend.
9. Protección de rutas administrativas mediante sesión y rol.
10. Navegación de regreso consistente en las interfaces.

Las medidas 1 a 6 son las defensas anti-abuso principales. Las medidas 7 a 9
complementan la protección de sesión, datos y autorización.

---

## 1. Ofuscación ligera del formulario de acceso

### Objetivo

Dificultar que automatizadores básicos dependan de identificadores HTML fijos
como `email`, `password`, `captcha` o `submit`.

### Implementación

En cada carga de `Login.vue` se genera un token aleatorio usando
`crypto.getRandomValues`. Ese token se utiliza para crear dinámicamente los
atributos `id` y `name` del formulario y sus controles.

Ejemplo conceptual:

```text
Carga 1: i-tokenA-a
Carga 2: i-tokenB-a
```

También se mantienen las referencias de las etiquetas `label` para no perder
accesibilidad.

### Flujo

```text
Se carga Login.vue
    ↓
Se genera un token aleatorio
    ↓
Se construyen IDs y names dinámicos
    ↓
Se renderiza el formulario
```

### Alcance y limitaciones

Esta medida sólo dificulta bots simples. No reemplaza CAPTCHA, validación
servidor, rate limit ni Turnstile. Un bot avanzado puede inspeccionar el DOM,
buscar campos por tipo o seguir la estructura accesible del formulario.

### Archivo afectado

- `frontend/src/views/Login.vue`

---

## 2. CAPTCHA matemático del login

### Objetivo

Exigir una interacción adicional antes de procesar la autenticación y dificultar
intentos automatizados básicos.

### Implementación

El backend genera una operación matemática aleatoria usando `crypto.randomInt`.
Puede generar sumas, restas o multiplicaciones con números pequeños.

La respuesta correcta se guarda en la sesión del usuario. El frontend sólo
recibe la pregunta.

### Flujo

```text
Login.vue solicita GET /api/auth/captcha
    ↓
El backend genera una operación
    ↓
La respuesta se guarda en req.session.captcha
    ↓
Se devuelve únicamente la pregunta
    ↓
El usuario responde
    ↓
Se envía POST /api/auth/login
    ↓
El backend compara con la respuesta guardada en sesión
    ↓
La respuesta se elimina de la sesión
```

El backend también comprueba que la respuesta sólo contenga entre 1 y 4
caracteres numéricos.

### Alcance y limitaciones

La validación real ocurre en el backend. La limpieza de caracteres del frontend
es sólo una ayuda de interfaz y no constituye una defensa por sí sola.

Un bot sofisticado podría leer y resolver una operación sencilla, por lo que el
CAPTCHA se combina con rate limit, detección de bots y auditoría.

### Archivos afectados

- `frontend/src/views/Login.vue`
- `src/routes/authRoutes.js`
- `src/controllers/authController.js`
- `BD/init-docker.sql`

---

## 3. Rate limit del login

### Objetivo

Reducir ataques de fuerza bruta y limitar intentos repetidos contra el acceso.

### Configuración actual

```text
Máximo de intentos fallidos: 5
Tiempo de bloqueo: 60 segundos
Identificador: dirección IP
```

### Implementación

El backend mantiene temporalmente los intentos en un `Map` en memoria. Cada
intento fallido de CAPTCHA, credenciales o validación relacionada incrementa el
contador.

Cuando se alcanza el límite, el backend responde con HTTP `429` y el encabezado
`Retry-After`.

### Flujo

```text
Llega POST /api/auth/login
    ↓
Se obtiene la IP del cliente
    ↓
Se consulta el estado del rate limit
    ↓
Si está bloqueada, responde HTTP 429
    ↓
Si falla la autenticación, incrementa el contador
    ↓
Al llegar a 5 fallos, bloquea durante 60 segundos
    ↓
Si el login es exitoso, limpia el contador
```

### Limitaciones

El contador se pierde si el proceso se reinicia y no se comparte entre varias
instancias del backend. Para producción distribuida se recomienda un almacén
compartido como Redis o un rate limiter persistente.

### Archivo afectado

- `src/controllers/authController.js`

---

## 4. Detección pasiva de bots

### Objetivo

Identificar patrones automatizados sin bloquear inmediatamente a usuarios
legítimos ni interrumpir su navegación.

### Implementación

El middleware se instala para todas las rutas `/api` y calcula una puntuación
basada en señales de la petición:

- User-Agent ausente.
- User-Agent con palabras como `headless`, `selenium`, `webdriver`,
  `playwright`, `puppeteer` o `bot`.
- Cabecera `Accept-Language` ausente.
- Volumen elevado de peticiones.
- Cadencia de peticiones inferior a 80 milisegundos.

El resultado se guarda en `req.botAssessment`:

```js
{
  score,
  level,
  signals,
  requestIntervalMs,
  recentRequests
}
```

Los niveles son:

```text
BAJO: 0 a 29 puntos
MEDIO: 30 a 59 puntos
ALTO: 60 puntos o más
```

### Flujo

```text
Llega una petición /api
    ↓
Se identifica al cliente
    ↓
Se observan cabeceras, volumen y velocidad
    ↓
Se calcula la puntuación
    ↓
Se adjunta req.botAssessment
    ↓
La petición continúa con next()
```

### Alcance y limitaciones

Es una señal de riesgo, no una prueba definitiva. El middleware no bloquea por
sí solo porque las señales pueden producir falsos positivos. El resultado se
incorpora al proceso de login y a la auditoría.

### Archivos afectados

- `src/server.js`
- `src/middleware/botDetection.js`
- `src/controllers/authController.js`
- `src/models/usuarioModel.js`
- `BD/init-docker.sql`

---

## 5. Auditoría de accesos

### Objetivo

Conservar evidencia de los intentos de autenticación y permitir revisar
tendencias de seguridad.

### Implementación

La tabla PostgreSQL `METRICAS_ACCESO` registra:

- usuario asociado, cuando existe;
- correo ingresado;
- tipo de evento;
- motivo del resultado;
- dirección IP;
- User-Agent;
- duración de la operación;
- resumen de interacción;
- clasificación de comportamiento;
- fecha y hora.

No se guardan contraseñas ni respuestas del CAPTCHA.

### Eventos actuales

```text
LOGIN exitoso
LOGIN con credenciales inválidas
LOGIN con CAPTCHA inválido
LOGIN con campos requeridos faltantes
LOGIN de usuario inactivo
LOGIN bloqueado por rate limit
LOGIN con error interno
LOGOUT exitoso
```

### Flujo

```text
Se procesa el login o logout
    ↓
Se determina el resultado y motivo
    ↓
Se agrega IP, User-Agent, duración y botAssessment
    ↓
Se ejecuta registrarEventoAcceso()
    ↓
Se inserta el registro en METRICAS_ACCESO
```

También existe la vista `VW_METRICAS_LOGIN_DIARIAS`, que resume intentos,
éxitos, fallos, usuarios únicos, porcentaje de éxito y duración promedio.

### Observación sobre Turnstile

Las validaciones de Turnstile se registran en consola cuando ocurre un error,
pero no se almacenan actualmente en `METRICAS_ACCESO`, porque esa tabla sólo
permite los tipos `LOGIN` y `LOGOUT`. Si se requiere auditoría completa de
Turnstile, se debe agregar un tipo de evento o una tabla específica.

### Archivos afectados

- `src/controllers/authController.js`
- `src/models/usuarioModel.js`
- `BD/init-docker.sql`

---

## 6. Cloudflare Turnstile para `/inicio`

### Objetivo

Proteger la entrada y las consultas públicas del blog contra automatización sin
mostrar un CAPTCHA visible a todos los usuarios.

### Implementación

Turnstile se ejecuta cuando se abre `/inicio`. El widget usa modo invisible y
`interaction-only`. El usuario normal normalmente no ve un desafío.

La clave pública se obtiene mediante:

```text
VITE_TURNSTILE_SITE_KEY
```

La clave secreta sólo existe en el backend:

```text
TURNSTILE_SECRET_KEY
```

### Flujo

```text
Se abre /inicio
    ↓
Inicio.vue carga el script de Turnstile
    ↓
Cloudflare analiza la sesión
    ↓
Se genera un token temporal
    ↓
Frontend envía POST /api/blog/access
    ↓
Backend envía el token a Cloudflare Siteverify
    ↓
Si success=true, guarda autorización en la sesión
    ↓
Se permiten posts, categorías y artículos
```

La autorización actual dura 30 minutos:

```js
const ACCESS_TTL_MS = 30 * 60 * 1000
```

Las rutas protegidas son:

```text
GET /api/blog/posts
GET /api/blog/posts/:id
GET /api/blog/categorias
```

Si no hay una autorización válida, responden HTTP `403`.

### Configuración con Docker

`docker-compose.yml` entrega la clave pública al frontend y la secreta al
backend:

```yaml
backend:
  environment:
    TURNSTILE_SECRET_KEY: ${TURNSTILE_SECRET_KEY:-}

frontend:
  environment:
    VITE_TURNSTILE_SITE_KEY: ${VITE_TURNSTILE_SITE_KEY:-}
```

Después de cambiar las claves se deben recrear los contenedores:

```powershell
docker compose down
docker compose up -d --build
```

### Alcance y limitaciones

Turnstile sólo valida la entrada al blog. No sustituye autenticación para el
panel administrativo ni el CAPTCHA del login. La clave secreta no debe
exponerse en el frontend.

### Archivos afectados

- `frontend/src/views/Inicio.vue`
- `frontend/src/services/api.js`
- `src/middleware/blogAccess.js`
- `src/routes/blogRoutes.js`
- `src/server.js`
- `docker-compose.yml`
- `.env`

---

## 7. Sesiones de Express

### Objetivo

Conservar el estado del usuario autenticado y la autorización temporal de
Turnstile.

### Datos manejados en sesión

Para usuarios autenticados:

```text
usuarioId
usuarioNombre
usuarioEmail
usuarioRol
```

Para el CAPTCHA:

```text
captcha
```

Para el acceso validado al blog:

```text
blogAccessExpiresAt
```

### Archivos afectados

- `src/server.js`
- `src/controllers/authController.js`
- `src/middleware/blogAccess.js`
- `src/router/index.js` en el frontend
- `.env`

### Observación para producción

La sesión actual usa el almacenamiento predeterminado en memoria de
`express-session`. Para producción distribuida se recomienda Redis o un store
persistente.

---

## 8. Validaciones de entrada

### Frontend

Se utilizan atributos como:

- `required`;
- `maxlength`;
- `pattern`;
- tipos `email`, `password` y `number`;
- normalización del CAPTCHA;
- estados de carga para evitar envíos repetidos.

### Backend

El backend vuelve a validar los datos porque las validaciones del navegador se
pueden evadir. Se validan, entre otros:

- campos obligatorios;
- longitud de nombres;
- longitud de correo;
- formato del correo;
- formato del teléfono;
- longitud de biografía;
- formato y respuesta del CAPTCHA.

### Archivos afectados

- `frontend/src/views/Login.vue`
- `frontend/src/views/Registro.vue`
- `frontend/src/views/Admin.vue`
- `frontend/src/views/AdminPanel.vue`
- `src/controllers/authController.js`
- `src/controllers/adminController.js`

---

## 9. Protección de rutas administrativas

### Objetivo

Evitar que usuarios no autenticados o sin rol administrativo accedan a las
pantallas y operaciones administrativas.

### Frontend

El router usa metadatos como:

```js
meta: { requiresAuth: true }
meta: { requiresAuth: true, requiresAdmin: true }
```

Antes de entrar a esas rutas consulta:

```text
/api/auth/me
```

### Backend

Los controladores administrativos consultan los datos de sesión y verifican el
usuario y su rol antes de ejecutar operaciones.

### Archivos afectados

- `frontend/src/router/index.js`
- `frontend/src/views/Admin.vue`
- `frontend/src/views/AdminPanel.vue`
- `src/routes/adminRoutes.js`
- `src/controllers/adminController.js`
- `src/server.js`

---

## 10. Botones de regreso y navegación segura

### Objetivo

Mejorar la navegación sin modificar la seguridad de autenticación.

### Implementación

El componente `BotonRegresar.vue` usa el historial del navegador cuando existe
una página anterior. Si la vista se abre directamente, utiliza una ruta de
respaldo, normalmente `/inicio`.

### Archivos afectados

- `frontend/src/components/BotonRegresar.vue`
- `frontend/src/style.css`
- `frontend/src/views/Articulo.vue`
- `frontend/src/views/Login.vue`
- `frontend/src/views/Registro.vue`
- `frontend/src/views/Admin.vue`
- `frontend/src/views/AdminPanel.vue`

---

## Archivos de configuración relacionados

### `.env`

Contiene la configuración local y las claves secretas mediante variables de
entorno. No debe publicarse con secretos reales.

Variables relevantes:

```env
TURNSTILE_SECRET_KEY=...
VITE_TURNSTILE_SITE_KEY=...
SESSION_SECRET=...
DB_PASSWORD=...
```

### `docker-compose.yml`

Define los servicios:

```text
postgres
backend
frontend
```

También entrega las variables de entorno correspondientes a cada contenedor.

### `Dockerfile`

Construye el contenedor del backend Node.js.

### `BD/init-docker.sql`

Inicializa las tablas, restricciones, índices y vista de auditoría de
PostgreSQL.

---

## Flujo integrado de seguridad

```text
Usuario abre /inicio
    ↓
Cloudflare Turnstile valida el acceso
    ↓
Se guarda autorización temporal en sesión
    ↓
Se cargan publicaciones y categorías
    ↓
Usuario abre el login
    ↓
Se generan IDs dinámicos del formulario
    ↓
Se solicita CAPTCHA matemático
    ↓
Usuario envía credenciales
    ↓
Backend revisa rate limit
    ↓
Backend analiza señales pasivas del bot
    ↓
Backend valida CAPTCHA y credenciales
    ↓
Se crea sesión autenticada
    ↓
Se registra el resultado en la auditoría
    ↓
El router y el backend protegen las áreas administrativas
```

## Matriz final

| Medida | Bloquea | Ubicación principal | Persistencia |
|---|---:|---|---|
| Ofuscación ligera del DOM | No | `frontend/src/views/Login.vue` | No |
| CAPTCHA matemático | Sí | `src/controllers/authController.js` | Sesión |
| Rate limit | Sí | `src/controllers/authController.js` | Memoria |
| Detección pasiva de bots | No | `src/middleware/botDetection.js` | Se adjunta a la petición |
| Auditoría | No | `METRICAS_ACCESO` | PostgreSQL |
| Cloudflare Turnstile | Sí | `src/middleware/blogAccess.js` | Sesión temporal |
| Sesiones | Indirectamente | `src/server.js` | Memoria por defecto |
| Validación de entrada | Sí ante datos inválidos | Frontend y backend | No |
| Autorización administrativa | Sí | Router y backend | Sesión |
| Botón de regreso | No | `BotonRegresar.vue` | Historial del navegador |

