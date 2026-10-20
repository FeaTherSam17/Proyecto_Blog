# Medidas de seguridad y prueba con Selenium

## Alcance

Este documento describe las medidas de seguridad que actualmente están
implementadas en el sistema y explica por qué
[`selenium_bot_detectado.py`](./selenium_bot_detectado.py) puede completar
algunas etapas de la prueba, aunque el servidor registre el comportamiento
como sospechoso o rechace la petición.

La prueba Selenium utiliza el frontend:

```text
http://10.228.6.137:5174/login
```

El script mantiene el backend configurado en `http://localhost:3000`. Por
tanto, el tercer intento (`requests.post`) prueba el backend local de la
computadora donde se ejecuta el script, no necesariamente el backend de
`10.228.6.137`.

## Medidas con las que cuenta el sistema

### 1. CAPTCHA matemático validado en el backend

El endpoint `GET /api/auth/captcha` genera dos números aleatorios usando
`crypto.randomInt`, calcula la respuesta y guarda el desafío en
`req.session.captcha`. El frontend solo recibe la pregunta.

Cuando llega `POST /api/auth/login`, el backend:

1. Comprueba que la respuesta tenga únicamente entre uno y cuatro dígitos.
2. Obtiene la respuesta almacenada en la sesión.
3. Compara la respuesta enviada con la respuesta del servidor.
4. Elimina el CAPTCHA de la sesión después de validarlo.
5. Devuelve `HTTP 400` si falta, es inválido o no coincide.

La implementación está en
[`src/controllers/authController.js`](./src/controllers/authController.js) y
la interfaz en
[`frontend/src/views/Login.vue`](./frontend/src/views/Login.vue).

El CAPTCHA no se valida únicamente en Vue: la validación decisiva ocurre en el
servidor antes de consultar las credenciales.

### 2. Rate limiting para la API y el login

[`src/middleware/rateLimiter.js`](./src/middleware/rateLimiter.js) contiene dos
limitadores:

| Limitador | Ventana | Límite | Respuesta |
|---|---:|---:|---|
| API general | 15 minutos | 300 solicitudes por clave | `HTTP 429` |
| Login | 1 minuto | 5 intentos normales | `HTTP 429` |

La clave combina la dirección IP y el identificador de sesión cuando existe la
cookie `connect.sid`. Si no existe la cookie, se utiliza la IP como clave
global para evitar que un script básico evada el límite eliminando cookies.

El límite de login se reduce dinámicamente a 3 intentos para una evaluación
`MEDIO` y a 2 para una evaluación `ALTO`.

Además, el controlador mantiene un control interno de cinco intentos fallidos
por IP y sesión, con bloqueo durante 60 segundos. Los bloqueos se registran
como `BLOQUEADO_RATE_LIMIT`.

### 3. Detección pasiva de comportamiento automatizado

[`src/middleware/botDetection.js`](./src/middleware/botDetection.js) calcula un
puntaje para cada petición de la API. Las señales utilizadas son:

| Señal | Puntaje |
|---|---:|
| `User-Agent` ausente | 25 |
| Firma de automatización en `User-Agent` | 50 |
| `Accept-Language` ausente | 15 |
| `Referer` ausente en `POST`, `PUT` o `DELETE` | 20 |
| 30 o más peticiones recientes | 15 |
| 60 o más peticiones recientes | 35 |
| Intervalo entre peticiones menor de 80 ms | 20 |

La clasificación resultante es:

- `BAJO`: menos de 30 puntos.
- `MEDIO`: de 30 a 59 puntos.
- `ALTO`: 60 puntos o más.

Esta detección es pasiva: adjunta el resultado en `req.botAssessment` y lo
utiliza para ajustar el límite de login y registrar la actividad. No rechaza
por sí sola todas las peticiones.

### 4. Métricas de interacción en el frontend

[`frontend/src/views/Login.vue`](./frontend/src/views/Login.vue) registra:

- cantidad de eventos `mousemove`;
- cantidad de eventos `keydown`;
- cantidad de eventos `keyup`;
- intervalos entre eventos `keyup`;
- tiempo desde el primer `focus` hasta el envío;
- presencia de `navigator.webdriver`.

El backend normaliza y limita estos valores antes de guardarlos. Si se detecta
`navigator.webdriver === true`, o si faltan completamente las señales de
interacción, la clasificación del intento puede ser `SOSPECHOSO`.

Estas métricas son señales de riesgo, no una fuente completamente confiable:
un cliente puede falsificar los valores enviados en el JSON.

### 5. Identificadores dinámicos del DOM

El formulario genera IDs y nombres variables en cada renderizado, por ejemplo:

```text
i-<token>-a
i-<token>-b
b-<token>-s
```

Esto dificulta scripts que dependan de IDs fijos. No evita la automatización
por completo, porque un bot puede localizar elementos por tipo, clase, texto,
accesibilidad o estructura del formulario.

### 6. Sesiones y auditoría

El backend usa `express-session` para mantener el CAPTCHA y asociar el flujo
del usuario con una sesión. Además:

- Morgan registra método, URL, estado HTTP, duración, IP, sesión, nivel de bot
  y `User-Agent`.
- Los eventos de login se guardan en la auditoría de la base de datos.
- Los logs persistentes se escriben en
  [`logs/acceso.log`](./logs/acceso.log).
- Los motivos incluyen `CAPTCHA_INVALIDO`,
  `CREDENCIALES_INVALIDAS`, `BLOQUEADO_RATE_LIMIT` y `EXITOSO`.

La configuración general se encuentra en
[`src/server.js`](./src/server.js).

## Qué ocurre con `selenium_bot_detectado.py`

### Intento 1: CAPTCHA vacío

El script abre el formulario, introduce correo y contraseña y envía el
formulario sin contestar el CAPTCHA.

Resultado esperado:

```text
HTTP 400 - CAPTCHA inválido
```

El backend rechaza la petición antes de autenticar. El intento se registra con
motivo `CAPTCHA_INVALIDO`. Como Selenium expone
`navigator.webdriver === true`, el comportamiento también puede quedar
clasificado como `SOSPECHOSO`.

### Intento 2: CAPTCHA resuelto automáticamente

El script lee la pregunta matemática del DOM, calcula la respuesta y la
introduce mediante Selenium. Esto puede superar la validación del CAPTCHA
porque:

1. La pregunta debe mostrarse al navegador para que un usuario pueda verla.
2. El CAPTCHA matemático es legible por un programa.
3. El script conserva la cookie de sesión del navegador.
4. La respuesta calculada coincide con la respuesta guardada en el backend.

Por eso el script puede pasar el CAPTCHA. Eso no significa que haya evadido
la detección: el mismo intento envía o provoca señales como:

- `navigator_webdriver = true`;
- cero o pocos movimientos de mouse;
- interacción muy rápida;
- comportamiento automatizado registrado por el frontend.

El login puede llegar a ser aceptado si las credenciales son correctas, pero
el evento se registra como `SOSPECHOSO`. En otras palabras, en la
implementación actual la clasificación sospechosa no equivale siempre a un
rechazo automático.

### Intento 3: peticiones directas a la API

El script envía ocho peticiones en intervalos de 50 milisegundos, sin
`Referer`, sin `Accept-Language` y con `navigator_webdriver: true` en el
objeto de comportamiento.

Estas peticiones generan señales acumulativas:

- ausencia de `Referer`: +20 en métodos de escritura;
- ausencia de `Accept-Language`: +15;
- cadencia menor de 80 ms: +20;
- volumen elevado de peticiones: +15 o +35;
- ausencia o firma automatizada del `User-Agent`, si aplica.

El resultado puede ser:

- `HTTP 400` por CAPTCHA vacío o inválido;
- `HTTP 429` cuando se alcanza el límite de login o de la API;
- registro de `BLOQUEADO_RATE_LIMIT`;
- clasificación `MEDIO` o `ALTO` en `botAssessment`.

El script no debe considerarse una prueba válida del backend remoto mientras
`BACKEND` continúe apuntando a `http://localhost:3000`.

## Cómo el log detecta comportamiento inusual

El middleware de Morgan escribe entradas con esta estructura:

```text
[fecha] IP [sesión] MÉTODO URL ESTADO tamaño - duración | bot:NIVEL[PUNTAJE] | "User-Agent"
```

Ejemplo de una petición normal:

```text
POST /api/auth/login 200 ... | bot:BAJO[15] | "Mozilla/5.0 ..."
```

Una secuencia inusual se identifica al observar:

1. La misma IP y sesión realizando muchas peticiones en poco tiempo.
2. Intervalos inferiores a 80 ms entre peticiones.
3. `User-Agent` ausente o con marcas como `HeadlessChrome`, `Selenium`,
   `WebDriver`, `Playwright` o `Puppeteer`.
4. Ausencia de `Accept-Language`.
5. Ausencia de `Referer` en peticiones `POST`.
6. Respuestas repetidas `400` por CAPTCHA inválido.
7. Respuestas `429` por exceso de intentos.
8. Eventos de auditoría con `BOT: SOSPECHOSO`.

Un evento de auditoría tiene un formato similar a:

```text
[AUDIT_EVENT] IP: ... | EVENTO: LOGIN | MOTIVO: CAPTCHA_INVALIDO |
EMAIL: ... | BOT: SOSPECHOSO | DURACION: ...ms
```

El log de Morgan muestra principalmente la petición HTTP y su puntaje. El
registro de auditoría contiene el motivo funcional del resultado del login.
Ambos registros deben analizarse juntos para distinguir entre:

- una petición rápida pero válida;
- un CAPTCHA inválido;
- credenciales inválidas;
- un bloqueo por rate limit;
- un login exitoso marcado como sospechoso.

## Conclusión

El sistema cuenta con CAPTCHA de servidor, rate limiting por IP y sesión,
detección pasiva por cabeceras y cadencia, métricas de interacción,
identificadores dinámicos, sesiones y auditoría.

El script pasa las pruebas que son deliberadamente compatibles con un
navegador real, especialmente el CAPTCHA matemático del segundo intento. La
defensa no depende de que el bot no pueda leer la pregunta, sino de combinar
la validación del CAPTCHA con señales de automatización, límites de tráfico y
registros de auditoría. Actualmente las señales de bot sirven principalmente
para clasificar y limitar; no todas provocan un rechazo inmediato por sí
solas.
