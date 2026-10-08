# Guía de Entorno Docker - Proyecto Blog

Este documento explica cómo levantar el entorno de desarrollo utilizando Docker, asegurando que todos en el equipo tengamos exactamente la misma base de datos, estructura y usuarios de prueba.

---

## 1. Instalación por Primera Vez (Entorno Nuevo)

Si es la primera vez que descargas el proyecto o nunca habías levantado Docker en tu computadora, solo necesitas abrir tu terminal en la carpeta raíz del proyecto (`/mi-blog`) y ejecutar:

```bash
docker-compose up -d --build
```

**¿Qué hace este comando?**
1. Instala automáticamente todas las dependencias de Node.js (ya no necesitas correr `npm install` localmente).
2. Levanta un contenedor de PostgreSQL.
3. Ejecuta en automático los scripts `init-docker.sql` y `datos_prueba.sql`.
4. Al terminar, tu base de datos tendrá la estructura lista junto con la administradora (Erika) y los 50 usuarios de prueba con sus publicaciones.

Para ver que el servidor de Node arrancó correctamente, puedes entrar a:
👉 [http://localhost:3000/inicio.html](http://localhost:3000/inicio.html)

---

## 2. Actualización (Limpiar una Base de Datos Vieja)

**IMPORTANTE:** Si ya habías corrido el proyecto antes, Docker guardó tu base de datos antigua en un volumen (`postgres_data`). Si el equipo hizo cambios recientes en la estructura (nuevas tablas o nuevos usuarios de prueba), **Docker NO ejecutará los nuevos cambios automáticamente** a menos que borres ese volumen.

Para actualizar tu base de datos a la versión más reciente del código, ejecuta:

```bash
# 1. Apaga el proyecto y destruye el volumen viejo (la -v es obligatoria)
docker-compose down -v

# 2. Vuelve a encender el proyecto limpio
docker-compose up -d --build
```

*(Después de esto, si tenías abierto pgAdmin, recuerda desconectarte y volver a conectarte para ver la tabla limpia).*

---

## 3. Datos de Conexión (pgAdmin / DBeaver)

Si necesitas explorar la base de datos visualmente para revisar tablas o consultas, configura tu conexión con los siguientes datos:

* **Host name/address:** `localhost`
* **Port:** `5434` *(OJO: Se cambió al 5434 para evitar conflictos con PostgreSQL local)*
* **Maintenance database:** `proyecto_blog`
* **Username:** `postgres`
* **Password:** `admin`

---

## 4. Comandos Útiles

Si quieres ver los logs de la aplicación o de la base de datos para buscar errores en tiempo real:
```bash
docker-compose logs -f
```

Si quieres apagar el proyecto al final del día (sin borrar la base de datos):
```bash
docker-compose down
```
