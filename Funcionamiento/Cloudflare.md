Turnstile es el sistema anti-bots de Cloudflare. En el proyecto funciona así:

## Flujo actual en `/inicio`

1. El usuario entra a `/inicio`.
2. `Inicio.vue` carga el script de Cloudflare:

```text
https://challenges.cloudflare.com/turnstile/v0/api.js
```

3. Turnstile analiza silenciosamente al visitante.
4. Si lo considera una persona normal, devuelve un token.
5. Si detecta riesgo, puede mostrar un desafío visual.
6. El frontend envía ese token al backend:

```http
POST /api/blog/access
```

Con un cuerpo similar a:

```json
{
  "token": "token-generado-por-cloudflare"
}
```

7. El backend, mediante `blogAccess.js`, envía ese token a Cloudflare junto con la clave secreta:

```text
https://challenges.cloudflare.com/turnstile/v0/siteverify
```

8. Si Cloudflare responde correctamente:

```json
{
  "success": true
}
```

el backend guarda una autorización en la sesión:

```js
req.session.blogAccessExpiresAt = Date.now() + 30 * 60 * 1000
```

Eso significa que el usuario puede consultar publicaciones durante 30 minutos sin repetir el desafío.

9. Después se cargan:

```text
/api/blog/posts
/api/blog/categorias
```

y las rutas de artículos.

## Qué hace Docker

En `docker-compose.yml` las claves se separan:

```yaml
backend:
  environment:
    TURNSTILE_SECRET_KEY: ${TURNSTILE_SECRET_KEY:-}

frontend:
  environment:
    VITE_TURNSTILE_SITE_KEY: ${VITE_TURNSTILE_SITE_KEY:-}
```

La clave pública va al frontend:

```env
VITE_TURNSTILE_SITE_KEY=tu_site_key
```

La clave secreta sólo va al backend:

```env
TURNSTILE_SECRET_KEY=tu_secret_key
```

La clave secreta nunca debe colocarse en `Inicio.vue`, porque sería visible para cualquier visitante.

## Muy importante con Vite y Docker

Como `VITE_TURNSTILE_SITE_KEY` se incorpora cuando Vite inicia, después de cambiar el `.env` tienes que recrear o reiniciar el frontend:

```powershell
docker compose down
docker compose up -d --build
```

También puedes reiniciar sólo el frontend:

```powershell
docker compose up -d --force-recreate frontend
```

Pero para evitar problemas de caché durante desarrollo, recomiendo:

```powershell
docker compose down
docker compose up -d --build
```

## Por qué puede aparecer “imposible validar”

Las causas más comunes son:

### 1. Las claves están invertidas

Debe ser:

```env
VITE_TURNSTILE_SITE_KEY=clave pública
TURNSTILE_SECRET_KEY=clave secreta
```

No las intercambies.

### 2. Las claves no están realmente dentro de los contenedores

Puedes comprobarlo sin mostrar las claves completas:

```powershell
docker compose exec frontend sh -c "printenv VITE_TURNSTILE_SITE_KEY | cut -c1-8"
```

```powershell
docker compose exec backend sh -c "printenv TURNSTILE_SECRET_KEY | cut -c1-8"
```

Ambos comandos deberían mostrar los primeros caracteres de cada clave.

### 3. El dominio no está registrado en Cloudflare Turnstile

En tu widget debes incluir:

```text
localhost
127.0.0.1
```

Si accedes desde otra dirección, como la IP de tu computadora:

```text
192.168.1.100
```

también tendrías que agregar esa dirección como hostname, aunque para pruebas locales normalmente es mejor usar:

```text
http://localhost:5174
```

### 4. El frontend conserva una configuración anterior

Vite puede conservar la variable anterior si el contenedor no se recrea. Ejecuta:

```powershell
docker compose down
docker compose up -d --build
```

### 5. Site Key y Secret Key pertenecen a widgets distintos

Ambas claves deben provenir del mismo widget de Turnstile. No mezcles la clave pública de un widget con la secreta de otro.

### 6. Estás usando una clave de producción en un dominio no permitido

Para desarrollo local, Cloudflare proporciona claves de prueba. Puedes usar:

```env
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

Estas sirven para comprobar que la integración funciona, pero no deben usarse en producción.

## Cómo verificar el flujo

Abre el navegador en:

```text
http://localhost:5174/inicio
```

Después abre las herramientas de desarrollador y revisa la pestaña **Network**.

Deberías observar esta secuencia:

```text
POST /api/blog/access    200
GET  /api/blog/posts     200
GET  /api/blog/categorias 200
```

Si observas:

```text
POST /api/blog/access    403
```

el token fue rechazado por Cloudflare.

Si observas:

```text
POST /api/blog/access    503
```

el backend no pudo comunicarse correctamente con Cloudflare.

Y si `/api/blog/access` funciona, pero `/api/blog/posts` da `403`, normalmente es un problema con la sesión o con las cookies del navegador.