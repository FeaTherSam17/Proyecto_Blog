Voy a ubicar cada mecanismo en el código y seguir el flujo desde el navegador hasta el backend para distinguir qué es prevención, qué es detección y qué queda sólo como auditoría.

Read 
Completed with input: {
  "path": "C:\\Users\\samAF\\Desktop\\TiaPaola\\TAD_BLOG\\Eje8.py"
}

Search for `crypto|generarToken|domTokens|captcha|rate|limite|bot|comportamiento|auditori...`

Read 
Completed with input: {
  "path": "C:\\Users\\samAF\\Desktop\\TiaPaola\\TAD_BLOG\\src\\middleware\\botDetection.js"
}

Read 
Completed with input: {
  "path": "C:\\Users\\samAF\\Desktop\\TiaPaola\\TAD_BLOG\\src\\middleware\\blogAccess.js"
}

Read , lines 1 to 180
Completed with input: {
  "path": "C:\\Users\\samAF\\Desktop\\TiaPaola\\TAD_BLOG\\src\\controllers\\authController.js",
  "view_range": [
    1,
    180
  ]
}

Read , lines 115 to 215
Completed with input: {
  "path": "C:\\Users\\samAF\\Desktop\\TiaPaola\\TAD_BLOG\\BD\\init-docker.sql",
  "view_range": [
    115,
    215
  ]
}

Read , lines 1 to 60
Completed with input: {
  "path": "C:\\Users\\samAF\\Desktop\\TiaPaola\\TAD_BLOG\\src\\server.js",
  "view_range": [
    1,
    60
  ]
}

Read , lines 105 to 240
Completed with input: {
  "path": "C:\\Users\\samAF\\Desktop\\TiaPaola\\TAD_BLOG\\frontend\\src\\views\\Login.vue",
  "view_range": [
    105,
    240
  ]
}

Read , lines 230 to 285
Completed with input: {
  "path": "C:\\Users\\samAF\\Desktop\\TiaPaola\\TAD_BLOG\\src\\models\\usuarioModel.js",
  "view_range": [
    230,
    285
  ]
}

Read , lines 1 to 80
Completed with input: {
  "path": "C:\\Users\\samAF\\Desktop\\TiaPaola\\TAD_BLOG\\Eje8.py",
  "view_range": [
    1,
    80
  ]
}

Sí. En tu proyecto hay **seis mecanismos relacionados con seguridad**. Cada uno funciona en una capa diferente:

1. Ofuscación ligera del DOM.
2. CAPTCHA matemático.
3. Rate limit.
4. Detección no invasiva de bots.
5. Auditoría de accesos.
6. Validación con Cloudflare Turnstile.

El archivo `Eje8.py` no implementa estos mecanismos del blog. Ese archivo es un scraper de libros con Selenium para otra actividad.

---

# 1. Ofuscación ligera del DOM

## Dónde está

Está en `Login.vue`.

La función principal es:

```js
function generarToken() {
  const bytes = new Uint32Array(2)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
    return Array.from(bytes, valor => valor.toString(36)).join('')
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
}
```

Después genera nombres e identificadores variables:

```js
const domTokens = {
  form: `f-${tokenDom}`,
  emailId: `i-${tokenDom}-a`,
  passwordId: `i-${tokenDom}-b`,
  captchaId: `i-${tokenDom}-c`,
  submitId: `b-${tokenDom}-s`
}
```

## Flujo

```text
Se abre Login.vue
        ↓
Se genera un token aleatorio
        ↓
Se crean IDs y names diferentes
        ↓
Se asignan al formulario y sus controles
        ↓
El bot no puede depender fácilmente de selectores fijos
```

Por ejemplo, un campo puede aparecer como:

```html
<input id="i-abc123-a" name="n-abc123-a">
```

y en otra carga:

```html
<input id="i-xyz789-a" name="n-xyz789-a">
```

## Qué protege

Dificulta bots muy básicos que buscan siempre:

```text
#email
#password
#captcha
#submit
```

## Limitación importante

Esto **no es ofuscación real del código JavaScript**. Es una ofuscación ligera del DOM.

No impide que un bot avanzado:

- inspeccione el formulario;
- busque campos de tipo `email` o `password`;
- use accesibilidad;
- simule eventos;
- lea el HTML en tiempo real.

Por eso es una capa complementaria, no una defensa principal.

---

# 2. CAPTCHA matemático

## Frontend

Está en `Login.vue`.

El frontend solicita una pregunta al backend:

```js
const data = await api.get('/api/auth/captcha')
captchaPregunta.value = data.pregunta
```

La respuesta del usuario se limpia en el navegador:

```js
function normalizarCaptcha(event) {
  const respuesta = event.target.value.replace(/\D/g, '').slice(0, 4)
  event.target.value = respuesta
  loginData.value.captchaRespuesta = respuesta
}
```

## Backend

La generación está en `authController.js`.

Se generan operaciones como:

```text
3 + 8
9 - 4
6 * 2
```

La respuesta correcta se guarda en la sesión:

```js
req.session.captcha = captcha
```

El navegador sólo recibe la pregunta, no la respuesta.

## Flujo

```text
Login.vue
   ↓
GET /api/auth/captcha
   ↓
Backend genera la operación
   ↓
Guarda respuesta en req.session.captcha
   ↓
Devuelve sólo la pregunta
   ↓
Usuario responde
   ↓
POST /api/auth/login
   ↓
Backend compara respuesta con la sesión
```

La validación está en `authController.js`.

```js
const captcha = req.session.captcha

if (!captcha || String(captchaRespuesta).trim() !== captcha.respuesta) {
  return res.status(400).json({
    error: 'El resultado del captcha es incorrecto'
  })
}
```

Después se elimina:

```js
delete req.session.captcha
```

## Qué protege

Evita que un bot básico envíe el login directamente sin resolver una prueba sencilla.

## Limitación

Un CAPTCHA matemático pequeño puede ser resuelto por:

- OCR;
- modelos de lenguaje;
- automatización que lea la pregunta;
- bots especializados.

Por eso se complementa con rate limit, comportamiento y Turnstile.

---

# 3. Rate limit

## Dónde está

Está en `authController.js`.

La configuración actual es:

```js
const MAX_LOGIN_ATTEMPTS = 5
const LOGIN_BLOCK_TIME_MS = 60 * 1000
```

Esto significa:

```text
5 intentos fallidos
        ↓
Bloqueo durante 60 segundos
```

El identificador utilizado es la IP:

```js
function obtenerClaveRateLimit(req) {
  return req.ip || req.socket.remoteAddress || 'unknown'
}
```

Los intentos se almacenan temporalmente en memoria:

```js
const loginAttempts = new Map()
```

## Flujo

```text
Llega POST /api/auth/login
        ↓
Se identifica la IP
        ↓
Se consulta su estado actual
        ↓
¿Está bloqueada?
   ├── Sí → HTTP 429
   └── No → continúa el login
        ↓
Falla CAPTCHA o credenciales
        ↓
Se incrementa contador
        ↓
Al llegar a 5 → bloqueo por 60 segundos
```

La revisión del bloqueo está al inicio de `login`:

```js
const rateLimit = obtenerEstadoRateLimit(req)

if (rateLimit.blockedUntil) {
  return res.status(429).json(...)
}
```

Los intentos fallidos se incrementan con:

```js
registrarIntentoFallido(rateLimit.key)
```

Si el login es exitoso, se limpia el contador:

```js
limpiarIntentos(rateLimit.key)
```

## Qué protege

Reduce:

- ataques de fuerza bruta;
- prueba masiva de contraseñas;
- intentos repetitivos contra una cuenta;
- abuso del CAPTCHA.

## Limitación actual

El `Map` está en memoria del proceso Node.

Si tienes varios contenedores backend o reinicias Docker:

- se pierde el contador;
- cada instancia tendría su propio contador;
- no es ideal para producción distribuida.

Para producción sería mejor usar Redis o un rate limiter persistente.

---

# 4. Detección no invasiva de bots

## Dónde se conecta

En `server.js`:

```js
app.use('/api', detectarBotPasivamente)
```

Eso significa que el middleware se aplica a todas las rutas que comienzan con `/api`.

El middleware está en `botDetection.js`.

## Qué señales revisa

### User-Agent vacío

```js
if (!userAgent) {
  puntaje += 15
}
```

### User-Agent automatizado

```js
/(headless|phantom|selenium|webdriver|playwright|puppeteer|bot)/i
```

Si encuentra una palabra sospechosa, agrega 45 puntos.

### Falta de idioma

```js
if (req.get('accept-language') === undefined) {
  puntaje += 10
}
```

### Muchas peticiones

```text
30 peticiones → +15 puntos
60 peticiones → +35 puntos
```

### Peticiones demasiado rápidas

```text
Menos de 80 ms entre peticiones → +20 puntos
```

## Clasificación

```js
const nivel = puntaje >= 60
  ? 'ALTO'
  : puntaje >= 30
    ? 'MEDIO'
    : 'BAJO'
```

El resultado se guarda en:

```js
req.botAssessment = {
  score,
  level,
  signals,
  requestIntervalMs,
  recentRequests
}
```

## Flujo

```text
Llega cualquier petición /api
        ↓
Se obtiene IP y User-Agent
        ↓
Se observan volumen y velocidad
        ↓
Se calcula un puntaje
        ↓
Se guarda en req.botAssessment
        ↓
La petición continúa normalmente
```

## Por qué es “no invasiva”

El middleware termina con:

```js
next()
```

No bloquea automáticamente.

Por ejemplo:

```text
Bot sospechoso → se clasifica como ALTO → la petición continúa
```

La clasificación después puede ser utilizada por login y auditoría.

## Qué protege

Sirve para:

- observar patrones;
- detectar automatización;
- generar evidencia;
- enriquecer auditoría;
- clasificar intentos de login.

## Limitación actual

Por sí sola no bloquea bots.

Además, estas señales pueden dar falsos positivos. Por ejemplo:

- un navegador sin `Accept-Language`;
- una red corporativa;
- un cliente automatizado legítimo;
- un usuario que realiza muchas peticiones rápidamente.

---

# 5. Auditoría de accesos

## Base de datos

La tabla está definida en `init-docker.sql`.

La tabla se llama:

```text
METRICAS_ACCESO
```

Guarda:

- usuario;
- correo ingresado;
- tipo de evento;
- motivo;
- IP;
- User-Agent;
- duración;
- comportamiento;
- clasificación;
- fecha y hora.

No guarda contraseñas ni la respuesta del CAPTCHA.

## Backend

La función que registra la auditoría está en `authController.js`:

```js
async function registrarMetricaAcceso(req, datos, inicio = Date.now())
```

Esta función agrega datos reales del servidor:

```js
direccion_ip: req.ip
agente_usuario: req.get('user-agent')
duracion_ms
```

También incorpora la detección de bots:

```js
bot_detection: req.botAssessment || null
```

## Modelo de persistencia

La inserción en PostgreSQL está en `usuarioModel.js`.

Se ejecuta un `INSERT` parametrizado en `METRICAS_ACCESO`.

## Eventos auditados

Actualmente se registran:

```text
LOGIN exitoso
LOGIN con credenciales inválidas
LOGIN con CAPTCHA inválido
LOGIN con campos faltantes
LOGIN de usuario inactivo
LOGIN bloqueado por rate limit
LOGIN con error interno
LOGOUT exitoso
```

## Flujo de auditoría

```text
Usuario intenta iniciar sesión
        ↓
Backend valida datos
        ↓
Se obtiene resultado
        ↓
Se llama registrarMetricaAcceso()
        ↓
Se agregan IP, navegador, duración y botAssessment
        ↓
usuarioModel.registrarEventoAcceso()
        ↓
INSERT en METRICAS_ACCESO
```

## Vista de reportes

También existe:

```text
VW_METRICAS_LOGIN_DIARIAS
```

En `init-docker.sql`.

Resume:

- cantidad de intentos;
- logins exitosos;
- logins fallidos;
- usuarios únicos;
- porcentaje de éxito;
- duración promedio.

## Observación importante

La auditoría actual está enfocada principalmente en `LOGIN` y `LOGOUT`.

El acceso con Cloudflare a `/api/blog/access` no se registra en `METRICAS_ACCESO`, porque la tabla sólo permite:

```sql
CHECK (TIPO_EVENTO IN ('LOGIN', 'LOGOUT'))
```

Por eso actualmente:

```text
Turnstile válido → permite acceso al blog
Turnstile inválido → se registra en consola, pero no en METRICAS_ACCESO
```

Ese es un punto que se podría mejorar agregando eventos como:

```text
BLOG_ACCESS
TURNSTILE_INVALIDO
```

o creando una tabla separada para auditoría de validaciones anti-bot.

---

# 6. Cloudflare Turnstile

## Frontend

Se implementa en `Inicio.vue`.

Al abrir `/inicio`, se ejecuta:

```js
onMounted(iniciarAccesoBlog)
```

La función:

```js
async function iniciarAccesoBlog()
```

hace lo siguiente:

```text
Abre /inicio
        ↓
Carga Turnstile
        ↓
Obtiene token
        ↓
POST /api/blog/access
        ↓
Espera confirmación del backend
        ↓
Carga publicaciones y categorías
```

La autorización no se aplica al login. El login conserva su CAPTCHA matemático propio.

## Backend

La ruta se conecta en `blogRoutes.js`:

```js
router.post('/access', concederAccesoBlog)
```

La lógica está en `blogAccess.js`.

El backend envía el token a Cloudflare:

```js
fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
  method: 'POST',
  ...
})
```

Después guarda una autorización temporal:

```js
req.session.blogAccessExpiresAt = Date.now() + ACCESS_TTL_MS
```

La duración actual es:

```js
const ACCESS_TTL_MS = 30 * 60 * 1000
```

Es decir, 30 minutos.

## Protección de las rutas del blog

Las rutas tienen este middleware:

```js
router.get('/posts', requerirAccesoBlog, blogController.obtenerTodas)
router.get('/posts/:id', requerirAccesoBlog, blogController.obtenerPorId)
router.get('/categorias', requerirAccesoBlog, blogController.obtenerCategorias)
```

Si no existe una autorización vigente, el servidor responde:

```http
403 Forbidden
```

## Flujo completo

```text
Usuario entra a /inicio
        ↓
Inicio.vue solicita Turnstile
        ↓
Turnstile genera token
        ↓
POST /api/blog/access
        ↓
Backend envía token a Cloudflare
        ↓
Cloudflare responde success: true/false
        ↓
Si es válido:
    guarda autorización en sesión
        ↓
    permite /posts y /categorias
        ↓
    muestra el blog

Si es inválido:
    HTTP 403
        ↓
    no se cargan las publicaciones
```

## Configuración en Docker

En `docker-compose.yml`:

```yaml
backend:
  environment:
    TURNSTILE_SECRET_KEY: ${TURNSTILE_SECRET_KEY:-}
```

Y para el frontend:

```yaml
frontend:
  environment:
    VITE_TURNSTILE_SITE_KEY: ${VITE_TURNSTILE_SITE_KEY:-}
```

La clave pública llega al contenedor frontend y la secreta al backend.

---

# Flujo general de las seis implementaciones

```text
Usuario entra al sitio
        ↓
Cloudflare Turnstile valida acceso a /inicio
        ↓
Se concede sesión temporal
        ↓
Se cargan publicaciones
        ↓
Usuario va a Login
        ↓
Frontend genera IDs variables
        ↓
Frontend carga CAPTCHA matemático
        ↓
Usuario envía correo, contraseña y CAPTCHA
        ↓
Backend revisa rate limit
        ↓
Backend analiza señales de bot
        ↓
Backend valida CAPTCHA
        ↓
Backend valida credenciales
        ↓
Se registra auditoría
        ↓
Se crea sesión del usuario
```

# Resumen de responsabilidades

| Mecanismo | Ubicación principal | ¿Bloquea? | Función |
|---|---|---:|---|
| Ofuscación ligera | `Login.vue` | No | Cambia IDs y nombres del DOM |
| CAPTCHA matemático | `authController.js` | Sí | Exige resolver una operación |
| Rate limit | `authController.js` | Sí | Bloquea después de 5 fallos por IP |
| Detección pasiva de bots | `botDetection.js` | No | Calcula riesgo y genera señales |
| Auditoría | `METRICAS_ACCESO` | No | Guarda evidencia de accesos |
| Cloudflare Turnstile | `blogAccess.js` | Sí | Valida el acceso inicial al blog |

La distinción más importante es esta:

- **CAPTCHA y Turnstile**: validan antes de permitir una acción.
- **Rate limit**: bloquea después de demasiados fallos.
- **Detección pasiva**: observa, pero no bloquea.
- **Auditoría**: registra lo ocurrido.
- **Ofuscación**: dificulta automatizaciones simples, pero no constituye una barrera fuerte.