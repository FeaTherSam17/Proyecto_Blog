# Funcionamiento del correo de verificación

Este documento describe cómo se envía y valida el correo de activación de
autores en TAD_BLOG. El flujo utiliza Brevo como proveedor externo y mantiene
los secretos únicamente en variables de entorno.

## 1. Objetivo

El correo de verificación demuestra que la persona que se registra controla la
dirección indicada. Una cuenta creada desde el registro público no puede iniciar
sesión hasta completar este paso.

El flujo utiliza:

- Frontend Vue para el formulario y la pantalla de confirmación.
- Backend Node.js/Express para validar y controlar el proceso.
- PostgreSQL para guardar el estado de la cuenta y los hashes de tokens.
- Brevo API HTTPS como canal principal de envío.
- SMTP de Brevo como alternativa.

Archivos principales:

- [`src/services/emailService.js`](../src/services/emailService.js): construye
  y envía el mensaje.
- [`src/controllers/authController.js`](../src/controllers/authController.js):
  crea tokens, registra usuarios y procesa la verificación.
- [`src/models/usuarioModel.js`](../src/models/usuarioModel.js): persiste
  usuarios y tokens.
- [`src/routes/authRoutes.js`](../src/routes/authRoutes.js): expone los
  endpoints.
- [`frontend/src/views/VerificarCorreo.vue`](../frontend/src/views/VerificarCorreo.vue):
  muestra el resultado al usuario.
- [`BD/migracion-verificacion-correo.sql`](../BD/migracion-verificacion-correo.sql):
  prepara las columnas y la tabla requeridas.

## 2. Flujo del registro

1. El usuario completa el formulario de registro.
2. El frontend solicita un token CSRF y envía el formulario a
   `POST /api/auth/registro`.
3. El backend valida los campos, el formato del correo y que no exista otra
   cuenta con la misma dirección.
4. El backend crea el usuario con:

   ```text
   ESTADO_USUARIO = PENDIENTE_VERIFICACION
   EMAIL_VERIFICADO = FALSE
   ```

5. Se genera un token aleatorio con `crypto.randomBytes(32)`.
6. El token original se conserva únicamente durante la operación de envío.
7. En PostgreSQL se guarda solamente su hash SHA-256.
8. Se construye un enlace de verificación con `FRONTEND_URL`.
9. El backend envía el correo mediante Brevo.
10. El frontend informa que debe revisar la bandeja de entrada.

El registro no activa la cuenta inmediatamente. Si falla el envío, el usuario
puede permanecer como pendiente y debe utilizar el reenvío de verificación o
ser atendido desde el panel administrativo.

## 3. Token y seguridad

El enlace tiene esta forma:

```text
https://dominio-frontend/verificar-correo?token=TOKEN
```

El token:

- Tiene 64 caracteres hexadecimales.
- Expira después de 30 minutos.
- Solo puede utilizarse una vez.
- No se guarda en texto plano en la base.
- Se invalida al generar un nuevo token de reenvío.

La tabla `TOKENS_VERIFICACION_EMAIL` guarda:

```text
ID_TOKEN
ID_USUARIO
TOKEN_HASH
EXPIRA_EN
USADO_EN
CREADO_EN
```

Cuando el usuario abre el enlace, el backend vuelve a calcular el SHA-256 del
token recibido y busca un registro que cumpla simultáneamente:

- Coincidencia del hash.
- `USADO_EN IS NULL`.
- `EXPIRA_EN > CURRENT_TIMESTAMP`.

La activación y el marcado del token como usado se realizan dentro de una
transacción con bloqueo `FOR UPDATE`. Esto evita que dos solicitudes
concurrentes consuman el mismo token.

## 4. Envío mediante Brevo API

El método preferido es la API HTTPS de Brevo:

```text
POST https://api.brevo.com/v3/smtp/email
```

Se usa HTTPS por el puerto 443, que normalmente está permitido en plataformas
como Render aunque las conexiones SMTP salientes puedan sufrir timeouts.

El mensaje incluye:

- Remitente configurado en Brevo.
- Destinatario del registro.
- Asunto de verificación.
- Versión de texto plano.
- Versión HTML.
- Enlace con el token codificado.

El nombre del usuario se escapa antes de incluirse en HTML para evitar que un
dato ingresado en el registro se interprete como marcado HTML.

Si Brevo responde con un estado HTTP distinto de 2xx, el servicio genera un
error explícito y el backend lo registra. No se presenta un envío exitoso
falso.

## 5. Envío SMTP de respaldo

Si `BREVO_API_KEY` no está configurada, el servicio utiliza Nodemailer con
SMTP. Se requieren:

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario_smtp_de_brevo
SMTP_PASSWORD=clave_smtp_de_brevo
SMTP_FROM=correo_remitente_verificado
```

El transporte tiene límites de tiempo para evitar que el formulario quede
indefinidamente en estado de registro:

- Conexión: 10 segundos.
- Saludo SMTP: 10 segundos.
- Socket: 15 segundos.

El transporte se cierra después del envío.

## 6. Variables de entorno

### Brevo API, recomendada

```env
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=Mi Blog
FRONTEND_URL=http://localhost:5174
```

En producción, `FRONTEND_URL` debe ser el dominio público del frontend, sin
agregar rutas como `/inicio`:

```env
FRONTEND_URL=https://proyecto-blog-0nqd.onrender.com
```

### Variables SMTP, solo si se usa el respaldo

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
```

### Separación de ambientes

| Ambiente | `FRONTEND_URL` | Canal recomendado |
|---|---|---|
| Local | `http://localhost:5174` | Brevo API o SMTP |
| Producción | dominio público del frontend | Brevo API |

El archivo `.env` es local y no debe subirse al repositorio. Debe versionarse
únicamente la plantilla
[`.env.example`](../.env.example), sin secretos reales.

## 7. Endpoints relacionados

### Obtener CSRF

```http
GET /api/auth/csrf-token
```

Se usa antes de las operaciones mutables del frontend.

### Registrar autor

```http
POST /api/auth/registro
```

Requiere `X-CSRF-Token`. Crea la cuenta pendiente y envía el mensaje.

### Verificar correo

```http
GET /api/auth/verificar-correo?token=TOKEN
```

No requiere sesión: el token temporal es la credencial de esta operación.

### Reenviar verificación

```http
POST /api/auth/reenviar-verificacion
```

Requiere `X-CSRF-Token` y está protegido por rate limiting. Genera un token
nuevo, invalida tokens pendientes anteriores y vuelve a enviar el correo.

## 8. Estados de cuenta

### Cuenta pendiente

```text
ESTADO_USUARIO = PENDIENTE_VERIFICACION
EMAIL_VERIFICADO = FALSE
```

No puede iniciar sesión.

### Cuenta verificada

```text
ESTADO_USUARIO = ACTIVO
EMAIL_VERIFICADO = TRUE
FECHA_VERIFICACION = fecha de confirmación
```

Puede iniciar sesión conforme al resto de controles de autenticación.

Las cuentas activas existentes se marcaron como verificadas durante la
migración para no bloquear usuarios creados antes de incorporar este flujo.

## 9. Configuración local con Docker

En desarrollo, el backend corre en el contenedor `mi-blog-backend` y el
frontend en `mi-blog-frontend`. El envío de correo no lo realiza PostgreSQL ni
Docker: el backend sale a Internet y llama a Brevo.

La base de datos local solo almacena:

- Estado de verificación.
- Hashes de tokens.
- Fechas de expiración y uso.

Para probar el flujo local:

1. Configura las variables en `.env`.
2. Inicia los servicios:

   ```powershell
   docker compose up -d --build
   ```

3. Abre `http://localhost:5174/registro`.
4. Registra un correo que puedas consultar.
5. Revisa la bandeja de entrada y spam.
6. Abre el enlace recibido.
7. Comprueba que el usuario pase a `ACTIVO`.

## 10. Diagnóstico de errores

### El usuario se guarda, pero no llega el correo

Revisar:

1. `BREVO_API_KEY` esté configurada en el backend, no en el frontend.
2. `BREVO_SENDER_EMAIL` sea un remitente verificado en Brevo.
3. El dominio o correo remitente no esté bloqueado.
4. Los logs del backend muestren la respuesta de Brevo.
5. La carpeta de spam y los límites de la cuenta de Brevo.

### Error `ETIMEDOUT` o `CONNECT_TIMEOUT`

Normalmente indica que SMTP no pudo conectarse. Se recomienda configurar
`BREVO_API_KEY` y utilizar la API HTTPS en lugar del SMTP.

### Error `Falta la variable FRONTEND_URL`

El backend no puede construir el enlace. Define `FRONTEND_URL` y reinicia el
servicio.

### Error `sender not authorized` o HTTP 400/401 de Brevo

La clave puede ser inválida o el remitente no está validado. Verifica la API
key y la identidad de envío en Brevo.

### El enlace dice que expiró o ya fue usado

Los tokens duran 30 minutos y son de un solo uso. Solicita un reenvío para
generar un enlace nuevo.

### El backend responde 500 después de crear el usuario

El correo se envía después de crear la cuenta. Si Brevo falla, la cuenta puede
quedar pendiente aunque el envío no se complete. No se debe registrar de nuevo
con el mismo correo; se debe usar el reenvío o revisar los logs.

## 11. Recomendaciones operativas

- Nunca subir `.env`, API keys, claves SMTP o contraseñas al repositorio.
- Revocar y regenerar credenciales que hayan sido expuestas.
- Mantener el remitente verificado en Brevo.
- Configurar rate limiting para registro y reenvío.
- Eliminar periódicamente tokens expirados.
- Considerar la limpieza de cuentas pendientes antiguas.
- Usar una base de datos local o de desarrollo separada de Neon.
- Revisar los logs sin imprimir tokens ni credenciales.
