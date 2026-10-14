# Sistema de Seguridad, Detección de Bots y Métricas de Acceso

Este documento detalla la arquitectura de seguridad implementada en el proyecto para mitigar ataques automatizados, fuerza bruta y scraping mediante herramientas como **Selenium**, **Puppeteer** o **Headless Chrome**.

El sistema se estructura en **5 pilares defensivos** que combinan detección comportamental en el cliente (Vue 3), control de tráfico, auditoría y verificación estricta en el servidor (Express + PostgreSQL).

---

## Tabla de Cumplimiento de Métricas y Mecanismos

| # | Pilar de Seguridad | Estado | Componentes Clave | Propósito Principal |
|---|---|:---:|---|---|
| **1** | **Detección comportamental en Frontend** | ✅ Cumplido | `Login.vue` (`@mousemove`, `@keydown`, `@keyup`, `@focusin`) | Distinguir interacción humana orgánica frente a `send_keys()` o inyección de valores por Selenium. |
| **2** | **Rate Limiting en Backend** | ✅ Cumplido | `express-rate-limit` + `express-session` (`rateLimiter.js`) | Mitigar fuerza bruta y navegación en paralelo multi-pestaña emitiendo `HTTP 429`. |
| **3** | **Desafío y verificación CAPTCHA** | ✅ Cumplido | `authController.js` (`req.session.captcha`) | Evitar bypass por inspección de JavaScript; el servidor es la única fuente de verdad. |
| **4** | **Ofuscación dinámica del DOM** | ✅ Cumplido | `Login.vue` (`:id`, `:name`, `:for` dinámicos + `onMounted`) | Romper localizadores estáticos de Selenium (`By.ID`, `By.CSS_SELECTOR`). |
| **5** | **Inspección de cabeceras, huella y Logs** | ✅ Cumplido | `botDetection.js`, `morgan`, `navigator.webdriver`, PostgreSQL | Auditoría forense en `METRICAS_ACCESO` y ajuste dinámico del Rate Limit. |

---

## 1. Detección Comportamental del Cliente en el Frontend (Vue 3)

### ¿En qué consiste?
Captura de forma pasiva la actividad física del usuario en el formulario mediante event listeners nativos antes de permitir el envío del formulario (`POST /api/auth/login`).

### Métricas clave capturadas:
1. **Patrón de escritura (`@keydown` / `@keyup`):**
   * Mide el tiempo exacto en milisegundos entre cada tecla pulsada utilizando `performance.now()`.
   * Registra `keydown_count` y `keyup_count`.
   * Detecta la inserción instantánea de texto o el llenado vía JavaScript frente al tecleo progresivo letra por letra de un usuario real.
   * Genera el arreglo `keyup_intervals_ms` y la señal booleana `send_keys_detected`.
2. **Conteo de movimientos de ratón (`@mousemove`):**
   * Registra el número de desplazamientos físicos del cursor (`mousemove_count`).
   * No almacena coordenadas invasivas, únicamente la existencia y volumen de actividad física.
3. **Tiempos de interacción (`@focusin` a submit):**
   * Registra el instante del primer foco en cualquier campo del formulario (`inicioFocus`).
   * Al hacer submit, calcula `focus_submit_ms` (duración total entre el inicio de la interacción y el envío).

### Archivos y funciones:
* **Frontend:** [frontend/src/views/Login.vue](file:///frontend/src/views/Login.vue)
  * Listeners en el formulario: `@mousemove="registrarMovimiento"`, `@focusin="registrarFocus"`, `@keydown="registrarKeydown"`, `@keyup="registrarKeyup"`.
  * Función `obtenerComportamiento()`: empaqueta las métricas en un objeto JSON enviado junto a las credenciales.
* **Backend:** [src/controllers/authController.js](file:///src/controllers/authController.js)
  * Función `analizarComportamiento(comportamiento)`: valida y clasifica el intento en `HUMANO`, `SOSPECHOSO` o `INDETERMINADO`.
  * Si `mousemove_count === 0`, `keyup_count === 0` y `focus_submit_ms === 0`, el intento se etiqueta inmediatamente como `SOSPECHOSO`.

---

## 2. Control de Tráfico y Peticiones con Rate Limiting (Express)

### ¿En qué consiste?
Implementación del middleware `express-rate-limit` configurado con una **estrategia combinada de Dirección IP + Token de sesión (`express-session`)**.

### Comportamiento y Cuotas:
* **Generación de Clave Única:**
  * Función `generarClaveRateLimit(req)`: combina la IP normalizada del cliente (`ipKeyGenerator`) con el identificador único de sesión del usuario (`req.sessionID`).
  * Si un bot intenta evadir el límite de sesión omitiendo las cookies de `express-session`, el sistema recurre al identificador por IP para evitar bypass.
* **Limitador Global de API (`apiRateLimiter`):**
  * Protege toda la ruta `/api` en [src/server.js](file:///src/server.js).
  * Máximo 300 peticiones cada 15 minutos por IP + Sesión.
  * Mitiga ataques masivos en paralelo y scraping concurrente desde múltiples pestañas de Selenium.
* **Limitador Estricto de Autenticación (`loginRateLimiter`):**
  * Aplicado en `POST /api/auth/login` en [src/routes/authRoutes.js](file:///src/routes/authRoutes.js).
  * Ventana de 1 minuto contra ataques de fuerza bruta.
  * **Ajuste dinámico:** Si el análisis de bot pasivo clasifica al cliente con nivel `ALTO`, la cuota se reduce automáticamente de 5 a 2 intentos por minuto.
* **Bloqueo HTTP 429 Too Many Requests:**
  * Al exceder la cuota, el servidor bloquea la ráfaga emitiendo un estado **`HTTP 429`**, la cabecera estándar `Retry-After` y un JSON estructurado con el tiempo de espera.
  * Registra el evento `BLOQUEADO_RATE_LIMIT` en la base de datos PostgreSQL.

### Archivos y funciones:
* [src/middleware/rateLimiter.js](file:///src/middleware/rateLimiter.js): definición de `generarClaveRateLimit`, `apiRateLimiter` y `loginRateLimiter`.
* [src/server.js](file:///src/server.js): montaje global en `app.use('/api', apiRateLimiter)`.
* [src/routes/authRoutes.js](file:///src/routes/authRoutes.js): montaje en `router.post('/login', loginRateLimiter, ...)`.

---

## 3. Desafío y Verificación CAPTCHA del Lado del Servidor

### ¿En qué consiste?
Generación de un desafío aritmético aleatorio almacenado exclusivamente en el contexto de la sesión del servidor (`req.session.captcha`).

### Regla estricta de validación:
1. **Generación Segura:**
   * El backend genera dos números aleatorios mediante `crypto.randomInt` y selecciona una operación matemática (`+`, `-`, `*`).
   * La respuesta correcta se almacena en `req.session.captcha`.
   * El endpoint `GET /api/auth/captcha` responde **únicamente** con la pregunta textual (ej. `{"pregunta": "8 * 3"}`), nunca con la respuesta.
2. **Evaluación exclusiva en Backend:**
   * Al recibir `POST /api/auth/login`, el servidor compara la respuesta del cliente contra `req.session.captcha.respuesta`.
   * Si la respuesta es incorrecta o el formato no es numérico, responde **`HTTP 400 Bad Request`** (`"El resultado del captcha es incorrecto"`).
   * **Invalidez inmediata:** Tras evaluarse, se destruye de la sesión (`delete req.session.captcha`) para impedir ataques de repetición o reutilización.
3. **El cliente Vue 3 no tiene lógica de solución:**
   * [Login.vue](file:///frontend/src/views/Login.vue) se limita a pintar el texto reactivo `{{ captchaPregunta }}`.

### Archivos y funciones:
* [src/controllers/authController.js](file:///src/controllers/authController.js): funciones `generarCaptcha()`, `obtenerCaptcha()` y validación en `login()`.
* [frontend/src/views/Login.vue](file:///frontend/src/views/Login.vue): función `cargarCaptcha()` y renderizado de la pregunta.

---

## 4. Ofuscación del DOM mediante IDs y Selectores Dinámicos

### ¿En qué consiste?
Uso de variables reactivas en Vue 3 que generan identificadores pseudoaleatorios criptográficos para los elementos del formulario al cargarse y renderizarse el componente (`onMounted`).

### Propósito:
Romper la automatización de scripts de scraping estáticos y bots de Selenium que dependen de localizadores fijos (`By.ID("email")`, `By.NAME("password")`, `By.CSS_SELECTOR`), obligando a reestructurar continuamente los algoritmos de localización.

### Implementación:
* Función `generarToken()`: genera una semilla aleatoria mediante `crypto.getRandomValues(new Uint32Array(2))`.
* Se crean tokens reactivos para:
  * Formulario: `:data-dom-token="domTokens.form"` (ej. `f-8a2z9x`)
  * Campo email: `:id="domTokens.emailId"` y `:name="domTokens.emailName"`
  * Campo contraseña: `:id="domTokens.passwordId"` y `:name="domTokens.passwordName"`
  * Campo captcha: `:id="domTokens.captchaId"` y `:name="domTokens.captchaName"`
  * Botones: `:id="domTokens.refreshId"`, `:id="domTokens.submitId"`
  * Etiquetas accesibles: `<label :for="domTokens.emailId">` vincula dinámicamente con su input correspondiente.
* En el hook `onMounted()`, los tokens se reasignan reactivamente para garantizar identificadores distintos por cada montaje en el DOM.

### Archivo:
* [frontend/src/views/Login.vue](file:///frontend/src/views/Login.vue) (líneas `crearTokensDom()` y `onMounted`).

---

## 5. Inspección de Cabeceras, Huella del Navegador y Auditoría de Logs

### ¿En qué consiste?
Estrategia de defensa en profundidad que complementa el análisis de tráfico en el servidor con detección activa de firmas de navegadores controlados por software.

### Mecanismos evaluados:

1. **Auditoría de Tráfico en Tiempo Real con `morgan`:**
   * Formato personalizado integrado en [src/server.js](file:///src/server.js):
     ```
     :client-ip [:session-id] :method :url :status :res[content-length] - :response-time ms | :bot-info | ":user-agent"
     ```
   * Registra en consola la IP, los primeros caracteres de la sesión, la latencia en milisegundos, el nivel de bot asignado (`bot:BAJO`, `bot:MEDIO`, `bot:ALTO`) y la firma del navegador.

2. **Inspección de Cabeceras en Backend ([src/middleware/botDetection.js](file:///src/middleware/botDetection.js)):**
   * **`User-Agent`:** Comprobación por expresión regular de firmas automatizadas:
     `/(headlesschrome|headless|phantom|selenium|webdriver|playwright|puppeteer|bot|crawl|spider)/i`.
     Penaliza con +50 puntos de sospecha si se detecta un navegador headless o framework de automatización.
   * **`Accept-Language`:** Penaliza (+15 puntos) si la cabecera está ausente, rasgo común en bots cURL/Python sin perfil configurado.
   * **`Referer`:** Penaliza (+20 puntos) si peticiones de mutación (`POST`, `PUT`, `DELETE`) no contienen cabecera de procedencia.

3. **Evaluación de Huella (`navigator.webdriver`):**
   * Los navegadores lanzados por Selenium o WebDriver activan la propiedad nativa `navigator.webdriver = true` de acuerdo a la especificación W3C.
   * En [frontend/src/views/Login.vue](file:///frontend/src/views/Login.vue), la función `evaluarHuellaNavegador()` verifica:
     ```javascript
     const webdriverDetectado = Boolean(
       window.navigator?.webdriver === true ||
       ('webdriver' in window.navigator && window.navigator.webdriver) ||
       document.documentElement?.getAttribute('webdriver')
     );
     ```
   * El valor se envía en el payload como `navigator_webdriver`.
   * En [src/controllers/authController.js](file:///src/controllers/authController.js), si `navigator_webdriver === true`, el intento se reclasifica inmediatamente como **`SOSPECHOSO`**.

4. **Persistencia Forense en Base de Datos (PostgreSQL):**
   * Cada intento de acceso (exitoso o fallido) se inserta en la tabla `METRICAS_ACCESO`:
     * `DIRECCION_IP`: IP del cliente.
     * `AGENTE_USUARIO`: User-Agent completo.
     * `TIPO_EVENTO`: `LOGIN` o `LOGOUT`.
     * `MOTIVO`: `EXITOSO`, `CREDENCIALES_INVALIDAS`, `CAPTCHA_INVALIDO`, `BLOQUEADO_RATE_LIMIT`, etc.
     * `DURACION_MS`: Duración del procesamiento en el servidor.
     * `COMPORTAMIENTO` (`JSONB`): Métricas de interacción (`mousemove_count`, `keydown_count`, `keyup_count`, `keyup_intervals_ms`, `focus_submit_ms`, `navigator_webdriver`).
     * `CLASIFICACION_COMPORTAMIENTO`: `HUMANO`, `SOSPECHOSO` o `INDETERMINADO`.

---

## Estructura de la Tabla `METRICAS_ACCESO` (SQL)

Definida en [BD/init-docker.sql](file:///BD/init-docker.sql):

```sql
CREATE TABLE METRICAS_ACCESO (
    ID_EVENTO BIGSERIAL PRIMARY KEY,
    ID_USUARIO INTEGER,
    EMAIL_INGRESADO VARCHAR(150),
    TIPO_EVENTO VARCHAR(20) NOT NULL,
    MOTIVO VARCHAR(40) NOT NULL,
    DIRECCION_IP INET,
    AGENTE_USUARIO VARCHAR(500),
    DURACION_MS INTEGER,
    COMPORTAMIENTO JSONB,
    CLASIFICACION_COMPORTAMIENTO VARCHAR(20),
    FECHA_EVENTO TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

---

## Verificación Práctica

### Comprobar el servidor y dependencias
```bash
# Iniciar servidor backend
npm run dev

# En otra terminal, compilar o iniciar el frontend
cd frontend
npm run dev
```

### Simulación de ráfagas (Rate Limiting HTTP 429)
Al realizar más de 5 peticiones por minuto hacia `/api/auth/login` desde una misma sesión/IP, el servidor responderá:
```json
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: application/json

{
  "error": "Demasiados intentos de inicio de sesión. Intenta de nuevo en 60 segundos.",
  "retryAfter": 60
}
```

### Simulación de Selenium / HeadlessChrome
Cuando una petición incluye la cabecera `User-Agent: Mozilla/5.0 HeadlessChrome/...` o el frontend reporta `navigator_webdriver: true`, el log de Morgan mostrará:
```text
::1 [s7d2jK1...] POST /api/auth/login 400 - 14.2 ms | bot:ALTO | "Mozilla/5.0 HeadlessChrome/120.0"
```
Y en la tabla `METRICAS_ACCESO`, el intento quedará registrado con `CLASIFICACION_COMPORTAMIENTO = 'SOSPECHOSO'`.
