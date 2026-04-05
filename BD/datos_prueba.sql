-- Script automatizado usando PL/pgSQL para generar 50 autores y 12 publicaciones por cada uno

-- 1. Primero limpiamos posibles datos de prueba anteriores para evitar errores y acumulación masiva
DELETE FROM PUBLICACIONES WHERE TITULO LIKE 'Publicación de prueba%';
DELETE FROM AUTORES WHERE ID_AUTOR IN (SELECT ID_USUARIO FROM USUARIOS WHERE EMAIL LIKE 'autor%@test.com');
DELETE FROM USUARIOS WHERE EMAIL LIKE 'autor%@test.com';

DO $$
DECLARE
    i INT;
    j INT;
    num_autores INT := 50;
    num_posts_por_autor INT := 12;
    nuevo_id_usuario INT;
    estado_arr VARCHAR[] := ARRAY['ACTIVO', 'INACTIVO', 'PENDIENTE_VERIFICACION', 'SUSPENDIDO'];
    sexo_arr CHAR[] := ARRAY['M', 'F'];
    categoria_id INT;
BEGIN
    -- Crear 50 Autores
    FOR i IN 1..num_autores LOOP
        -- Insertar Usuario
        INSERT INTO USUARIOS (NOMBRE, PRIMER_APELLIDO, SEGUNDO_APELLIDO, EMAIL, CONTRASENA, ROL, ESTADO_USUARIO)
        VALUES (
            'AutorNombre ' || i, 
            'Apellido ' || i, 
            'SegundoApellido ' || i, 
            'autor' || i || '@test.com', 
            '123456', 
            'AUTOR', 
            'ACTIVO'
        )
        RETURNING ID_USUARIO INTO nuevo_id_usuario;

        -- Insertar perfil en AUTORES vinculado al ID generado
        INSERT INTO AUTORES (ID_AUTOR, COD_SEXO, TELEFONO, BIOGRAFIA)
        VALUES (
            nuevo_id_usuario, 
            sexo_arr[1 + (i % 2)], 
            '555000' || LPAD(i::text, 4, '0'), 
            'Biografía generada automáticamente para el autor de prueba número ' || i || '. Experto en diversos campos y contribuidor regular del blog.'
        );

        -- Insertar mínimo 12 Publicaciones por cada uno de esos 50 autores
        FOR j IN 1..num_posts_por_autor LOOP
            
            -- Obtener una categoría dinámicamente o usar la 1 por defecto
            categoria_id := (SELECT ID_CATEGORIA FROM CATEGORIAS LIMIT 1 OFFSET (j % 5));
            IF categoria_id IS NULL THEN
                categoria_id := (SELECT MIN(ID_CATEGORIA) FROM CATEGORIAS);
            END IF;

            -- Generar el artículo falso
            INSERT INTO PUBLICACIONES (TITULO, ID_AUTOR, ID_CATEGORIA, TEXTO_PUBLICACION, ESTADO_PUBLICACION, FECHA_PUBLICACION)
            VALUES (
                'Publicación de prueba ' || j || ' del Autor ' || i,
                nuevo_id_usuario,
                categoria_id,
                'Este es el contenido extenso generado automáticamente para la publicación número ' || j || ' escrita por el ' || 'AutorNombre ' || i || '. Su único propósito es permitir probar la paginación, filtros y búsquedas robustas en el panel de administración.',
                estado_arr[1 + (j % 4)], -- Asigna estatus variable
                CURRENT_TIMESTAMP - (j || ' days')::interval - (i || ' hours')::interval -- Escalar fechas
            );
        END LOOP;
    END LOOP;
END $$;
