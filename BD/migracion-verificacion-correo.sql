-- Migracion segura para una base de datos existente.
-- Ejecutar directamente en la base de datos de produccion despues de un respaldo.
-- No elimina usuarios, publicaciones ni modifica contrasenas existentes.

-- Estas columnas permiten distinguir una cuenta creada pero aun no confirmada
-- de una cuenta que ya demostro controlar su direccion de correo.
ALTER TABLE USUARIOS
    ADD COLUMN IF NOT EXISTS EMAIL_VERIFICADO BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS FECHA_VERIFICACION TIMESTAMP NULL;

-- El estado PENDIENTE_VERIFICACION tiene 22 caracteres.
-- La definicion original VARCHAR(20) lo rechazaria aunque el CHECK permita
-- el valor. Ampliar la columna no cambia los datos existentes ni los estados
-- ya registrados.
ALTER TABLE USUARIOS
    ALTER COLUMN ESTADO_USUARIO TYPE VARCHAR(30);

-- El perfil del autor ya no contiene telefono. PostgreSQL elimina
-- automaticamente las restricciones que dependan de esta columna.
ALTER TABLE AUTORES DROP COLUMN IF EXISTS TELEFONO;

-- Las cuentas activas existentes se consideran cuentas heredadas para no bloquear
-- el acceso durante el despliegue. Los nuevos registros se crean como pendientes
-- desde el backend y no dependen de este UPDATE.
UPDATE USUARIOS
SET EMAIL_VERIFICADO = TRUE,
    FECHA_VERIFICACION = COALESCE(FECHA_VERIFICACION, CURRENT_TIMESTAMP)
WHERE EMAIL_VERIFICADO = FALSE
  AND ESTADO_USUARIO = 'ACTIVO';

-- Se agrega el estado pendiente sin invalidar los estados ya utilizados.
ALTER TABLE USUARIOS DROP CONSTRAINT IF EXISTS USUARIOS_ESTADO_USUARIO_CK;
ALTER TABLE USUARIOS
    ADD CONSTRAINT USUARIOS_ESTADO_USUARIO_CK
    CHECK (ESTADO_USUARIO IN ('ACTIVO', 'INACTIVO', 'PENDIENTE_VERIFICACION'));

-- Se guarda un hash del token, nunca el token que viaja en el enlace.
-- Si la base de datos se filtra, el atacante no obtiene directamente enlaces
-- utilizables. El token expira y puede consumirse una sola vez.
CREATE TABLE IF NOT EXISTS TOKENS_VERIFICACION_EMAIL (
    ID_TOKEN BIGSERIAL PRIMARY KEY,
    ID_USUARIO INTEGER NOT NULL REFERENCES USUARIOS(ID_USUARIO) ON DELETE CASCADE,
    TOKEN_HASH CHAR(64) NOT NULL UNIQUE,
    EXPIRA_EN TIMESTAMP NOT NULL,
    USADO_EN TIMESTAMP NULL,
    CREADO_EN TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Estos indices aceleran la busqueda por usuario y la limpieza de tokens
-- antiguos sin alterar los registros actuales.
CREATE INDEX IF NOT EXISTS TOKENS_VERIFICACION_EMAIL_USUARIO_IDX
    ON TOKENS_VERIFICACION_EMAIL (ID_USUARIO);

CREATE INDEX IF NOT EXISTS TOKENS_VERIFICACION_EMAIL_EXPIRA_IDX
    ON TOKENS_VERIFICACION_EMAIL (EXPIRA_EN);
