# Guía de Entorno Docker - Proyecto Blog

Este documento explica cómo levantar el entorno de desarrollo utilizando Docker. La arquitectura del proyecto está dividida en un Backend (API REST Node.js) y un Frontend (Vue 3 / Vite), ambos corriendo en contenedores con Hot-Reloading junto a una base de datos PostgreSQL.

---

## 1. Instalación por Primera Vez (Entorno Nuevo)

Abre tu terminal en la carpeta raíz del proyecto (`/mi-blog`) y ejecuta:

```bash
docker-compose up -d --build
```

**¿Qué hace este comando?**
1. Instala automáticamente las dependencias del Backend (Node.js) y levanta el servidor API.
2. Instala automáticamente las dependencias del Frontend (Vue) y levanta el servidor Vite.
3. Levanta un contenedor de PostgreSQL.
4. Ejecuta en automático los scripts `init-docker.sql` y `datos_prueba.sql` (creando la administradora y usuarios de prueba).

Al terminar (puede tardar un minuto la primera vez instalando dependencias), tendrás acceso a:

* 🌐 **Frontend (Vue):** 👉 [http://localhost:5174](http://localhost:5174)
* ⚙️ **Backend API (Express):** 👉 `http://localhost:3002`

*Nota: Cualquier cambio que hagas en `src/` (backend) o en `frontend/src/` (Vue) se recargará automáticamente en tiempo real gracias a los volúmenes de Docker.*

---

## 2. Actualización (Limpiar una Base de Datos Vieja)

**IMPORTANTE:** Docker guarda tu base de datos en un volumen (`postgres_data`). Si el equipo hizo cambios en la estructura SQL (nuevas tablas o datos), **Docker NO ejecutará los nuevos scripts automáticamente** a menos que borres ese volumen.

Para resetear tu base de datos a la versión más reciente del código:

```bash
# 1. Apaga el proyecto y destruye el volumen viejo (la -v es obligatoria)
docker-compose down -v

# 2. Vuelve a encender el proyecto limpio
docker-compose up -d --build
```

---

## 3. Datos de Conexión (pgAdmin / DBeaver / TablePlus)

Si necesitas conectarte a la base de datos visualmente desde tu computadora, usa estos datos:

* **Host name/address:** `localhost`
* **Port:** `5435` *(Mapeado para no interferir con otros proyectos Docker)*
* **Maintenance database:** `proyecto_blog`
* **Username:** `postgres`
* **Password:** `admin`

---

## 4. Comandos Útiles

Si quieres ver los logs de los 3 contenedores (útil si la pantalla se queda en blanco o hay errores):
```bash
docker-compose logs -f
```

Si quieres ver solo los logs del frontend (Vite):
```bash
docker-compose logs -f frontend
```

Si quieres apagar el proyecto al final del día (sin borrar la base de datos):
```bash
docker-compose down
```
