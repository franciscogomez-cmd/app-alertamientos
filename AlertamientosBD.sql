-- ---------------------------------------------------------------------------
-- SCHEMAS
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS alertas;
CREATE SCHEMA IF NOT EXISTS auditoria;

SET search_path TO alertas, public;

-- =============================================================================
-- TIPOS ENUM
-- =============================================================================

CREATE TYPE alertas.nivel_severidad_tipo AS ENUM (
    'preventiva',
    'emergencia',
    'informativa'
);

CREATE TYPE alertas.estatus_alerta_tipo AS ENUM (
    'borrador',
    'activa',
    'desactivada',
    'expirada',
    'cancelada'
);

CREATE TYPE alertas.nivel_cobertura_tipo AS ENUM (
    'pais',
    'estado',
    'municipio',
    'colonia',
    'codigo_postal',
    'zona_personalizada'
);

CREATE TYPE alertas.tipo_zona_tipo AS ENUM (
    'pais',
    'estado',
    'municipio',
    'colonia',
    'codigo_postal',
    'poligono_custom'
);

CREATE TYPE alertas.plataforma_tipo AS ENUM (
    'android',
    'ios',
    'huawei'
);

CREATE TYPE alertas.estatus_envio_tipo AS ENUM (
    'pendiente',
    'enviada',
    'fallida',
    'rebotada'
);

CREATE TYPE alertas.nivel_log_tipo AS ENUM (
    'debug',
    'info',
    'warning',
    'error',
    'critical'
);

-- =============================================================================
-- TABLA: administradores
-- Usuarios del backoffice que crean y gestionan alertas.
-- =============================================================================

CREATE TABLE alertas.alt_administradores (
    id                  INTEGER         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre              VARCHAR(120)    NOT NULL,
    apellidos           VARCHAR(120)    NOT NULL,
    email               VARCHAR(254)    NOT NULL,
    hash_password       VARCHAR(255)    NOT NULL,
    rol                 VARCHAR(60)     NOT NULL DEFAULT 'editor',  -- superadmin | admin | editor
    activo              BOOLEAN         NOT NULL DEFAULT TRUE,

    -- Auditoría
    creado_en           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    creado_por          INTEGER         REFERENCES alertas.alt_administradores(id) ON DELETE RESTRICT,
    actualizado_en      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    actualizado_por     INTEGER         REFERENCES alertas.alt_administradores(id) ON DELETE RESTRICT,
    eliminado_en        TIMESTAMPTZ     NULL DEFAULT NULL,
    eliminado_por       INTEGER         REFERENCES alertas.alt_administradores(id) ON DELETE RESTRICT,

    CONSTRAINT uq_alt_administradores_email UNIQUE (email)
);

COMMENT ON TABLE  alertas.alt_administradores              IS 'Usuarios del backoffice que administran las alertas.';
COMMENT ON COLUMN alertas.alt_administradores.rol          IS 'Rol de acceso: superadmin | admin | editor.';
COMMENT ON COLUMN alertas.alt_administradores.eliminado_en IS 'NULL = activo. Timestamp = borrado lógico.';

-- =============================================================================
-- TABLA: zonas_geograficas
-- Catálogo de zonas reutilizables (estados, municipios, colonias, polígonos).
-- =============================================================================

CREATE TABLE alertas.cat_zonas_geograficas (
    id                  INTEGER                 GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre              VARCHAR(200)            NOT NULL,
    tipo                alertas.tipo_zona_tipo  NOT NULL,

    -- Claves geopolíticas (INEGI)
    clave_pais          CHAR(2)                 NOT NULL DEFAULT 'MX',
    clave_estado        CHAR(2)                 NULL,   -- p.ej. '25' = Sinaloa
    clave_municipio     VARCHAR(3)              NULL,   -- p.ej. '006' = Culiacán
    codigo_postal       VARCHAR(10)             NULL,

    -- Representación geográfica — círculo centrado
    centro_latitud      DECIMAL(10, 7)          NULL,
    centro_longitud     DECIMAL(10, 7)          NULL,
    radio_km            DECIMAL(8, 3)           NULL,

    -- Polígono arbitrario en GeoJSON (array de [lng, lat])
    poligono            JSONB                   NULL,

    -- Metadatos
    activo              BOOLEAN                 NOT NULL DEFAULT TRUE,

    -- Auditoría
    creado_en           TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    creado_por          INTEGER                 REFERENCES alertas.alt_administradores(id) ON DELETE RESTRICT,
    actualizado_en      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    actualizado_por     INTEGER                 REFERENCES alertas.alt_administradores(id) ON DELETE RESTRICT,
    eliminado_en        TIMESTAMPTZ             NULL DEFAULT NULL,
    eliminado_por       INTEGER                 REFERENCES alertas.alt_administradores(id) ON DELETE RESTRICT,

    CONSTRAINT ck_cat_zonas_coordenadas CHECK (
        (centro_latitud IS NOT NULL AND centro_longitud IS NOT NULL)
        OR poligono IS NOT NULL
    )
);

COMMENT ON TABLE  alertas.cat_zonas_geograficas           IS 'Catálogo de zonas geográficas reutilizables para dirigir alertas.';
COMMENT ON COLUMN alertas.cat_zonas_geograficas.tipo      IS 'Granularidad: pais | estado | municipio | colonia | codigo_postal | poligono_custom.';
COMMENT ON COLUMN alertas.cat_zonas_geograficas.poligono  IS 'GeoJSON FeatureCollection o array de coordenadas [lng, lat].';
COMMENT ON COLUMN alertas.cat_zonas_geograficas.radio_km  IS 'Radio en kilómetros desde el centro. Usado para búsquedas de proximidad.';

CREATE INDEX idx_cat_zonas_tipo            ON alertas.cat_zonas_geograficas(tipo)            WHERE eliminado_en IS NULL;
CREATE INDEX idx_cat_zonas_clave_estado    ON alertas.cat_zonas_geograficas(clave_estado)    WHERE eliminado_en IS NULL;
CREATE INDEX idx_cat_zonas_clave_municipio ON alertas.cat_zonas_geograficas(clave_municipio) WHERE eliminado_en IS NULL;
CREATE INDEX idx_cat_zonas_codigo_postal   ON alertas.cat_zonas_geograficas(codigo_postal)   WHERE eliminado_en IS NULL;
CREATE INDEX idx_cat_zonas_poligono        ON alertas.cat_zonas_geograficas USING GIN (poligono);

-- =============================================================================
-- TABLA: categorias_alerta
-- Tipos de alerta: meteorológica, noticias de última hora, vialidad, etc.
-- =============================================================================

CREATE TABLE alertas.cat_categorias_alerta (
    id                  INTEGER         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre              VARCHAR(120)    NOT NULL,
    slug                VARCHAR(80)     NOT NULL,
    icono               VARCHAR(120)    NULL,       -- nombre del ícono o URL
    color_hex           CHAR(7)         NOT NULL DEFAULT '#E24B4A',
    descripcion         TEXT            NULL,
    activo              BOOLEAN         NOT NULL DEFAULT TRUE,

    -- Auditoría
    creado_en           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    creado_por          INTEGER         REFERENCES alertas.alt_administradores(id) ON DELETE RESTRICT,
    actualizado_en      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    actualizado_por     INTEGER         REFERENCES alertas.alt_administradores(id) ON DELETE RESTRICT,
    eliminado_en        TIMESTAMPTZ     NULL DEFAULT NULL,
    eliminado_por       INTEGER         REFERENCES alertas.alt_administradores(id) ON DELETE RESTRICT,

    CONSTRAINT uq_cat_categorias_slug UNIQUE (slug),
    CONSTRAINT ck_cat_color_hex       CHECK  (color_hex ~ '^#[0-9A-Fa-f]{6}$')
);

COMMENT ON TABLE  alertas.cat_categorias_alerta      IS 'Tipos de alerta disponibles (meteorológica, última hora, etc.).';
COMMENT ON COLUMN alertas.cat_categorias_alerta.slug IS 'Identificador único legible: meteorologica, ultima-hora, etc.';

-- Datos semilla
INSERT INTO alertas.cat_categorias_alerta (nombre, slug, color_hex, descripcion)
OVERRIDING SYSTEM VALUE VALUES
    (1, 'Alertas meteorológicas',  'meteorologica', '#E24B4A', 'Fenómenos meteorológicos: tormentas, inundaciones, huracanes.'),
    (2, 'Noticias de última hora', 'ultima-hora',   '#E24B4A', 'Eventos o situaciones importantes que impactan la localidad.'),
    (3, 'Vialidad',                'vialidad',       '#BA7517', 'Cierres viales, accidentes, desvíos.'),
    (4, 'Servicios públicos',      'servicios',      '#185FA5', 'Cortes de agua, luz, gas u otros servicios.');

-- Sincronizar la secuencia interna después de un seed con IDs explícitos
SELECT setval(
    pg_get_serial_sequence('alertas.cat_categorias_alerta', 'id'),
    (SELECT MAX(id) FROM alertas.cat_categorias_alerta)
);

-- =============================================================================
-- TABLA: alertas
-- Registro principal de cada alerta emitida.
-- =============================================================================

CREATE TABLE alertas.alt_alertas (
    id                  BIGINT                          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    categoria_id        INTEGER                         NOT NULL REFERENCES alertas.cat_categorias_alerta(id) ON DELETE RESTRICT,

    titulo              VARCHAR(200)                    NOT NULL,
    descripcion         TEXT                            NOT NULL,
    nivel_severidad     alertas.nivel_severidad_tipo    NOT NULL,
    estatus             alertas.estatus_alerta_tipo     NOT NULL DEFAULT 'borrador',

    -- Vigencia
    fecha_inicio        TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),
    fecha_fin           TIMESTAMPTZ                     NULL,   -- NULL = sin expiración definida

    -- Cobertura geográfica
    nivel_cobertura     alertas.nivel_cobertura_tipo    NOT NULL,
    zona_id             INTEGER                         NULL REFERENCES alertas.cat_zonas_geograficas(id) ON DELETE RESTRICT,

    -- Zona ad-hoc (cuando no se usa una zona del catálogo)
    centro_latitud      DECIMAL(10, 7)                  NULL,
    centro_longitud     DECIMAL(10, 7)                  NULL,
    radio_km            DECIMAL(8, 3)                   NULL,
    poligono_zona       JSONB                           NULL,

    -- Acciones sugeridas al usuario (array de strings)
    acciones            JSONB                           NULL,   -- ["Evita la zona", "Usa rutas alternas"]

    -- Metadata
    imagen_url          VARCHAR(500)                    NULL,
    mapa_visible        BOOLEAN                         NOT NULL DEFAULT TRUE,
    total_enviadas      INTEGER                         NOT NULL DEFAULT 0,

    -- Auditoría
    creado_en           TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),
    creado_por          INTEGER                         NOT NULL REFERENCES alertas.alt_administradores(id) ON DELETE RESTRICT,
    actualizado_en      TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),
    actualizado_por     INTEGER                         REFERENCES alertas.alt_administradores(id) ON DELETE RESTRICT,
    eliminado_en        TIMESTAMPTZ                     NULL DEFAULT NULL,
    eliminado_por       INTEGER                         REFERENCES alertas.alt_administradores(id) ON DELETE RESTRICT,

    CONSTRAINT ck_alt_alertas_fecha CHECK (fecha_fin IS NULL OR fecha_fin > fecha_inicio),
    CONSTRAINT ck_alt_alertas_zona  CHECK (
        zona_id IS NOT NULL
        OR (centro_latitud IS NOT NULL AND centro_longitud IS NOT NULL)
        OR poligono_zona IS NOT NULL
    )
);

COMMENT ON TABLE  alertas.alt_alertas                 IS 'Tabla principal de alertas emitidas hacia la app móvil.';
COMMENT ON COLUMN alertas.alt_alertas.nivel_cobertura IS 'Granularidad de la zona afectada.';
COMMENT ON COLUMN alertas.alt_alertas.zona_id         IS 'Zona del catálogo. Mutuamente exclusivo con zona ad-hoc.';
COMMENT ON COLUMN alertas.alt_alertas.acciones        IS 'Array JSON de recomendaciones a mostrar en la app.';
COMMENT ON COLUMN alertas.alt_alertas.total_enviadas  IS 'Contador desnormalizado de notificaciones push enviadas.';

CREATE INDEX idx_alt_alertas_categoria    ON alertas.alt_alertas(categoria_id)      WHERE eliminado_en IS NULL;
CREATE INDEX idx_alt_alertas_estatus      ON alertas.alt_alertas(estatus)           WHERE eliminado_en IS NULL;
CREATE INDEX idx_alt_alertas_severidad    ON alertas.alt_alertas(nivel_severidad)   WHERE eliminado_en IS NULL;
CREATE INDEX idx_alt_alertas_fecha_inicio ON alertas.alt_alertas(fecha_inicio DESC) WHERE eliminado_en IS NULL;
CREATE INDEX idx_alt_alertas_zona_id      ON alertas.alt_alertas(zona_id)           WHERE eliminado_en IS NULL;
CREATE INDEX idx_alt_alertas_acciones     ON alertas.alt_alertas USING GIN (acciones);

-- =============================================================================
-- TABLA: alertas_zonas
-- Una alerta puede afectar múltiples zonas (p.ej. Huracán afecta 3 municipios).
-- =============================================================================

CREATE TABLE alertas.alt_alertas_zonas (
    id              BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    alerta_id       BIGINT          NOT NULL REFERENCES alertas.alt_alertas(id) ON DELETE CASCADE,
    zona_id         INTEGER         NOT NULL REFERENCES alertas.cat_zonas_geograficas(id) ON DELETE RESTRICT,

    -- Auditoría
    creado_en       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    creado_por      INTEGER         REFERENCES alertas.alt_administradores(id) ON DELETE RESTRICT,
    eliminado_en    TIMESTAMPTZ     NULL DEFAULT NULL,
    eliminado_por   INTEGER         REFERENCES alertas.alt_administradores(id) ON DELETE RESTRICT,

    CONSTRAINT uq_alt_alerta_zona UNIQUE (alerta_id, zona_id)
);

COMMENT ON TABLE alertas.alt_alertas_zonas IS 'Relación N:M entre alertas y zonas geográficas afectadas.';

CREATE INDEX idx_alt_alertas_zonas_alerta ON alertas.alt_alertas_zonas(alerta_id) WHERE eliminado_en IS NULL;
CREATE INDEX idx_alt_alertas_zonas_zona   ON alertas.alt_alertas_zonas(zona_id)   WHERE eliminado_en IS NULL;

-- =============================================================================
-- TABLA: actualizaciones_alerta
-- Historial de cambios de estado y mensajes adicionales por alerta.
-- =============================================================================

CREATE TABLE alertas.alt_actualizaciones_alerta (
    id                  BIGINT                          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    alerta_id           BIGINT                          NOT NULL REFERENCES alertas.alt_alertas(id) ON DELETE CASCADE,
    mensaje             TEXT                            NOT NULL,
    estatus_anterior    alertas.estatus_alerta_tipo     NULL,
    estatus_nuevo       alertas.estatus_alerta_tipo     NOT NULL,
    enviar_push         BOOLEAN                         NOT NULL DEFAULT FALSE,

    -- Auditoría
    creado_en           TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),
    creado_por          INTEGER                         NOT NULL REFERENCES alertas.alt_administradores(id) ON DELETE RESTRICT,
    eliminado_en        TIMESTAMPTZ                     NULL DEFAULT NULL,
    eliminado_por       INTEGER                         REFERENCES alertas.alt_administradores(id) ON DELETE RESTRICT
);

COMMENT ON TABLE  alertas.alt_actualizaciones_alerta             IS 'Historial de actualizaciones y cambios de estatus por alerta.';
COMMENT ON COLUMN alertas.alt_actualizaciones_alerta.enviar_push IS 'Si TRUE, esta actualización dispara una nueva notificación push.';

CREATE INDEX idx_alt_actualizaciones_alerta
    ON alertas.alt_actualizaciones_alerta(alerta_id, creado_en DESC)
    WHERE eliminado_en IS NULL;

-- =============================================================================
-- TABLA: usuarios
-- Dispositivos móviles registrados en la app.
-- =============================================================================

CREATE TABLE alertas.alt_usuarios (
    id                          BIGINT                       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Identificadores del dispositivo
    imei                        VARCHAR(20)                  NULL,
    device_id                   VARCHAR(200)                 NOT NULL,   -- Android ID o iOS identifierForVendor
    token_push                  VARCHAR(500)                 NULL,       -- FCM / APNs token
    plataforma                  alertas.plataforma_tipo      NOT NULL,
    version_app                 VARCHAR(20)                  NULL,
    modelo_dispositivo          VARCHAR(100)                 NULL,
    sistema_operativo           VARCHAR(60)                  NULL,

    -- Ubicación actual del dispositivo
    latitud                     DECIMAL(10, 7)               NULL,
    longitud                    DECIMAL(10, 7)               NULL,
    precision_metros            DECIMAL(8, 2)                NULL,
    ubicacion_actualizada_en    TIMESTAMPTZ                  NULL,

    -- Preferencia de zona cuando GPS está desactivado
    codigo_postal               VARCHAR(10)                  NULL,

    -- Preferencias de notificación
    notif_activas               BOOLEAN                      NOT NULL DEFAULT FALSE,
    gps_activo                  BOOLEAN                      NOT NULL DEFAULT FALSE,
    notif_meteorologicas        BOOLEAN                      NOT NULL DEFAULT TRUE,
    notif_ultima_hora           BOOLEAN                      NOT NULL DEFAULT TRUE,
    notif_vialidad              BOOLEAN                      NOT NULL DEFAULT TRUE,
    notif_servicios             BOOLEAN                      NOT NULL DEFAULT TRUE,

    -- Horario silencioso (sin notificaciones)
    silencio_inicio             TIME                         NULL,   -- p.ej. 22:00
    silencio_fin                TIME                         NULL,   -- p.ej. 07:00

    -- Severidad mínima que acepta recibir
    severidad_minima            alertas.nivel_severidad_tipo NOT NULL DEFAULT 'informativa',

    -- Auditoría (sin creado_por: los usuarios se autoregistran desde la app)
    creado_en                   TIMESTAMPTZ                  NOT NULL DEFAULT NOW(),
    actualizado_en              TIMESTAMPTZ                  NOT NULL DEFAULT NOW(),
    eliminado_en                TIMESTAMPTZ                  NULL DEFAULT NULL,

    CONSTRAINT uq_alt_usuarios_device_id UNIQUE (device_id),
    CONSTRAINT ck_alt_usuarios_silencio  CHECK (
        (silencio_inicio IS NULL AND silencio_fin IS NULL)
        OR (silencio_inicio IS NOT NULL AND silencio_fin IS NOT NULL)
    )
);

COMMENT ON TABLE  alertas.alt_usuarios                  IS 'Dispositivos móviles registrados en la aplicación de alertas.';
COMMENT ON COLUMN alertas.alt_usuarios.imei             IS 'IMEI del dispositivo. Puede ser NULL en iOS (no es accesible).';
COMMENT ON COLUMN alertas.alt_usuarios.device_id        IS 'Identificador único del dispositivo generado por la app.';
COMMENT ON COLUMN alertas.alt_usuarios.token_push       IS 'Token FCM (Android/Huawei) o APNs (iOS) para notificaciones push.';
COMMENT ON COLUMN alertas.alt_usuarios.severidad_minima IS 'El usuario solo recibe alertas de esta severidad o mayor.';
COMMENT ON COLUMN alertas.alt_usuarios.silencio_inicio  IS 'Inicio del horario en que no se envían notificaciones.';

CREATE INDEX idx_alt_usuarios_token_push ON alertas.alt_usuarios(token_push)       WHERE eliminado_en IS NULL AND token_push IS NOT NULL;
CREATE INDEX idx_alt_usuarios_ubicacion  ON alertas.alt_usuarios(latitud, longitud) WHERE eliminado_en IS NULL AND gps_activo = TRUE;
CREATE INDEX idx_alt_usuarios_cp         ON alertas.alt_usuarios(codigo_postal)     WHERE eliminado_en IS NULL AND codigo_postal IS NOT NULL;
CREATE INDEX idx_alt_usuarios_plataforma ON alertas.alt_usuarios(plataforma)        WHERE eliminado_en IS NULL;

-- =============================================================================
-- TABLA: usuarios_zonas
-- Suscripciones manuales del usuario a zonas adicionales (fuera de su GPS).
-- =============================================================================

CREATE TABLE alertas.alt_usuarios_zonas (
    id              BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id      BIGINT          NOT NULL REFERENCES alertas.alt_usuarios(id) ON DELETE CASCADE,
    zona_id         INTEGER         NOT NULL REFERENCES alertas.cat_zonas_geograficas(id) ON DELETE RESTRICT,
    activo          BOOLEAN         NOT NULL DEFAULT TRUE,

    -- Auditoría
    creado_en       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    eliminado_en    TIMESTAMPTZ     NULL DEFAULT NULL,

    CONSTRAINT uq_alt_usuario_zona UNIQUE (usuario_id, zona_id)
);

COMMENT ON TABLE alertas.alt_usuarios_zonas IS 'Suscripciones manuales de usuarios a zonas adicionales (fuera de su GPS).';

CREATE INDEX idx_alt_usuarios_zonas_usuario ON alertas.alt_usuarios_zonas(usuario_id) WHERE eliminado_en IS NULL;
CREATE INDEX idx_alt_usuarios_zonas_zona    ON alertas.alt_usuarios_zonas(zona_id)    WHERE eliminado_en IS NULL;

-- =============================================================================
-- TABLA: notificaciones_enviadas
-- Registro de cada push notification enviada a cada usuario.
-- Log inmutable: no tiene eliminado_en.
-- =============================================================================

CREATE TABLE alertas.alt_notificaciones_enviadas (
    id                  BIGINT                          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    alerta_id           BIGINT                          NOT NULL REFERENCES alertas.alt_alertas(id) ON DELETE CASCADE,
    actualizacion_id    BIGINT                          NULL     REFERENCES alertas.alt_actualizaciones_alerta(id) ON DELETE SET NULL,
    usuario_id          BIGINT                          NOT NULL REFERENCES alertas.alt_usuarios(id) ON DELETE CASCADE,

    estatus_envio       alertas.estatus_envio_tipo      NOT NULL DEFAULT 'pendiente',
    intento_numero      SMALLINT                        NOT NULL DEFAULT 1,
    mensaje_error       TEXT                            NULL,       -- Respuesta del proveedor en caso de fallo
    provider_message_id VARCHAR(300)                    NULL,       -- ID del mensaje en FCM / APNs

    -- Snapshot de coordenadas del dispositivo al momento del envío
    latitud_envio       DECIMAL(10, 7)                  NULL,
    longitud_envio      DECIMAL(10, 7)                  NULL,

    enviada_en          TIMESTAMPTZ                     NULL,
    leida_en            TIMESTAMPTZ                     NULL,
    creado_en           TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),

    -- Sin eliminado_en: tabla de log, los registros son inmutables.
    CONSTRAINT ck_alt_notif_intento CHECK (intento_numero BETWEEN 1 AND 10)
);

COMMENT ON TABLE  alertas.alt_notificaciones_enviadas                     IS 'Registro de cada push notification enviada a cada usuario.';
COMMENT ON COLUMN alertas.alt_notificaciones_enviadas.intento_numero      IS 'Número de intento de envío (para reintentos automáticos).';
COMMENT ON COLUMN alertas.alt_notificaciones_enviadas.provider_message_id IS 'ID asignado por FCM o APNs para trazabilidad.';

CREATE INDEX idx_alt_notif_alerta    ON alertas.alt_notificaciones_enviadas(alerta_id,  creado_en DESC);
CREATE INDEX idx_alt_notif_usuario   ON alertas.alt_notificaciones_enviadas(usuario_id, creado_en DESC);
CREATE INDEX idx_alt_notif_estatus   ON alertas.alt_notificaciones_enviadas(estatus_envio)
    WHERE estatus_envio IN ('pendiente', 'fallida');
CREATE INDEX idx_alt_notif_no_leidas ON alertas.alt_notificaciones_enviadas(usuario_id)
    WHERE leida_en IS NULL AND enviada_en IS NOT NULL;

-- =============================================================================
-- TABLA: bitacora_errores
-- Log centralizado de errores y eventos del sistema.
-- =============================================================================

CREATE TABLE auditoria.aud_bitacora_errores (
    id                  BIGINT                  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nivel               alertas.nivel_log_tipo  NOT NULL DEFAULT 'error',
    modulo              VARCHAR(100)            NOT NULL,   -- 'notificaciones' | 'alertas' | 'usuarios'
    operacion           VARCHAR(100)            NULL,       -- 'envio_push' | 'creacion_alerta'
    mensaje             TEXT                    NOT NULL,
    detalle             JSONB                   NULL,       -- Stack trace, payload, contexto adicional
    codigo_error        VARCHAR(60)             NULL,

    -- Sin FK intencional: los logs deben persistir aunque se elimine el registro referenciado
    usuario_id          BIGINT                  NULL,
    administrador_id    INTEGER                 NULL,
    entidad             VARCHAR(100)            NULL,       -- Nombre de la tabla afectada
    entidad_id          BIGINT                  NULL,       -- ID numérico del registro afectado

    ip_origen           INET                    NULL,
    request_id          VARCHAR(100)            NULL,       -- Correlación con logs de la API
    creado_en           TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  auditoria.aud_bitacora_errores            IS 'Log centralizado de errores y eventos del sistema de alertas.';
COMMENT ON COLUMN auditoria.aud_bitacora_errores.nivel      IS 'Severidad: debug | info | warning | error | critical.';
COMMENT ON COLUMN auditoria.aud_bitacora_errores.modulo     IS 'Módulo o servicio que originó el evento.';
COMMENT ON COLUMN auditoria.aud_bitacora_errores.detalle    IS 'Contexto adicional: stack trace, payload, request body, etc.';
COMMENT ON COLUMN auditoria.aud_bitacora_errores.request_id IS 'ID de correlación para rastrear el flujo completo en logs.';
COMMENT ON COLUMN auditoria.aud_bitacora_errores.usuario_id IS 'Sin FK intencional: el log debe sobrevivir al registro referenciado.';

CREATE INDEX idx_aud_bitacora_nivel   ON auditoria.aud_bitacora_errores(nivel,   creado_en DESC);
CREATE INDEX idx_aud_bitacora_modulo  ON auditoria.aud_bitacora_errores(modulo,  creado_en DESC);
CREATE INDEX idx_aud_bitacora_entidad ON auditoria.aud_bitacora_errores(entidad, entidad_id) WHERE entidad IS NOT NULL;
CREATE INDEX idx_aud_bitacora_creado  ON auditoria.aud_bitacora_errores(creado_en DESC);


-- =============================================================================
-- TABLA: auditoria_cambios
-- Registro inmutable de INSERT/UPDATE/DELETE lógico en tablas clave.
-- =============================================================================

CREATE TABLE auditoria.aud_auditoria_cambios (
    id                  BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tabla               VARCHAR(100)    NOT NULL,
    operacion           CHAR(6)         NOT NULL,   -- INSERT | UPDATE | DELETE
    registro_id         BIGINT          NOT NULL,   -- ID numérico del registro afectado
    datos_anteriores    JSONB           NULL,       -- NULL en INSERT
    datos_nuevos        JSONB           NULL,       -- NULL en DELETE lógico
    campos_modificados  TEXT[]          NULL,       -- Columnas que cambiaron en UPDATE

    -- Sin FK: el log debe sobrevivir aunque se elimine el admin o usuario
    administrador_id    INTEGER         NULL,
    usuario_id          BIGINT          NULL,

    ip_origen           INET            NULL,
    request_id          VARCHAR(100)    NULL,
    creado_en           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Sin eliminado_en: tabla inmutable.
    CONSTRAINT ck_aud_auditoria_operacion CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE'))
);

COMMENT ON TABLE  auditoria.aud_auditoria_cambios                    IS 'Registro inmutable de cambios en tablas principales (audit trail).';
COMMENT ON COLUMN auditoria.aud_auditoria_cambios.datos_anteriores   IS 'Snapshot JSON del registro antes del cambio (NULL en INSERT).';
COMMENT ON COLUMN auditoria.aud_auditoria_cambios.datos_nuevos       IS 'Snapshot JSON del registro después del cambio (NULL en DELETE lógico).';
COMMENT ON COLUMN auditoria.aud_auditoria_cambios.campos_modificados IS 'Array de nombres de columnas modificadas en un UPDATE.';
COMMENT ON COLUMN auditoria.aud_auditoria_cambios.registro_id        IS 'ID numérico del registro afectado en la tabla indicada.';

CREATE INDEX idx_aud_auditoria_tabla     ON auditoria.aud_auditoria_cambios(tabla, registro_id);
CREATE INDEX idx_aud_auditoria_creado    ON auditoria.aud_auditoria_cambios(creado_en DESC);
CREATE INDEX idx_aud_auditoria_admin     ON auditoria.aud_auditoria_cambios(administrador_id) WHERE administrador_id IS NOT NULL;
CREATE INDEX idx_aud_auditoria_operacion ON auditoria.aud_auditoria_cambios(operacion, tabla);

-- =============================================================================
-- FUNCIONES Y TRIGGERS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Función: fn_actualizar_timestamp
-- Mantiene actualizado_en al día en cada UPDATE automáticamente.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION alertas.fn_actualizar_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_actualizar_ts_alt_administradores
    BEFORE UPDATE ON alertas.alt_administradores
    FOR EACH ROW EXECUTE FUNCTION alertas.fn_actualizar_timestamp();

CREATE TRIGGER trg_actualizar_ts_cat_zonas
    BEFORE UPDATE ON alertas.cat_zonas_geograficas
    FOR EACH ROW EXECUTE FUNCTION alertas.fn_actualizar_timestamp();

CREATE TRIGGER trg_actualizar_ts_cat_categorias
    BEFORE UPDATE ON alertas.cat_categorias_alerta
    FOR EACH ROW EXECUTE FUNCTION alertas.fn_actualizar_timestamp();

CREATE TRIGGER trg_actualizar_ts_alt_alertas
    BEFORE UPDATE ON alertas.alt_alertas
    FOR EACH ROW EXECUTE FUNCTION alertas.fn_actualizar_timestamp();

CREATE TRIGGER trg_actualizar_ts_alt_usuarios
    BEFORE UPDATE ON alertas.alt_usuarios
    FOR EACH ROW EXECUTE FUNCTION alertas.fn_actualizar_timestamp();

CREATE TRIGGER trg_actualizar_ts_alt_usuarios_zonas
    BEFORE UPDATE ON alertas.alt_usuarios_zonas
    FOR EACH ROW EXECUTE FUNCTION alertas.fn_actualizar_timestamp();

-- ---------------------------------------------------------------------------
-- Función: fn_auditoria_alertas
-- Graba en auditoria.aud_auditoria_cambios cada INSERT/UPDATE sobre alertas.alt_alertas.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION alertas.fn_auditoria_alertas()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_campos TEXT[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO auditoria.aud_auditoria_cambios
            (tabla, operacion, registro_id, datos_nuevos, administrador_id)
        VALUES
            ('alertas.alt_alertas', 'INSERT', NEW.id,
             row_to_json(NEW)::JSONB,
             NEW.creado_por);

    ELSIF TG_OP = 'UPDATE' THEN
        -- Detectar solo las columnas que realmente cambiaron
        SELECT array_agg(key)
        INTO   v_campos
        FROM   jsonb_each(row_to_json(OLD)::JSONB) o
        JOIN   jsonb_each(row_to_json(NEW)::JSONB) n USING (key)
        WHERE  o.value IS DISTINCT FROM n.value;

        INSERT INTO auditoria.aud_auditoria_cambios
            (tabla, operacion, registro_id,
             datos_anteriores, datos_nuevos,
             campos_modificados, administrador_id)
        VALUES
            ('alertas.alt_alertas', 'UPDATE', NEW.id,
             row_to_json(OLD)::JSONB,
             row_to_json(NEW)::JSONB,
             v_campos,
             NEW.actualizado_por);
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auditoria_alt_alertas
    AFTER INSERT OR UPDATE ON alertas.alt_alertas
    FOR EACH ROW EXECUTE FUNCTION alertas.fn_auditoria_alertas();

-- ---------------------------------------------------------------------------
-- Función: fn_contar_notificacion_enviada
-- Incrementa el contador desnormalizado total_enviadas en alertas.alt_alertas
-- cuando una notificación pasa a estatus 'enviada'.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION alertas.fn_contar_notificacion_enviada()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.estatus_envio = 'enviada' AND
       (OLD IS NULL OR OLD.estatus_envio <> 'enviada') THEN
        UPDATE alertas.alt_alertas
        SET    total_enviadas = total_enviadas + 1
        WHERE  id = NEW.alerta_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contar_alt_notificacion
    AFTER INSERT OR UPDATE OF estatus_envio ON alertas.alt_notificaciones_enviadas
    FOR EACH ROW EXECUTE FUNCTION alertas.fn_contar_notificacion_enviada();

-- ---------------------------------------------------------------------------
-- Nota: expirar alertas vencidas
-- Ejecutar periódicamente desde pg_cron o un job externo:
--
--   UPDATE alertas.alt_alertas
--   SET    estatus        = 'expirada',
--          actualizado_en = NOW()
--   WHERE  fecha_fin < NOW()
--     AND  estatus    = 'activa'
--     AND  eliminado_en IS NULL;
-- ---------------------------------------------------------------------------

-- =============================================================================
-- VISTAS DE CONVENIENCIA
-- =============================================================================

-- Alertas activas con datos de categoría y zona principal
CREATE OR REPLACE VIEW alertas.v_alertas_activas AS
SELECT
    a.id,
    a.titulo,
    a.descripcion,
    a.nivel_severidad,
    a.estatus,
    a.nivel_cobertura,
    a.fecha_inicio,
    a.fecha_fin,
    a.centro_latitud,
    a.centro_longitud,
    a.radio_km,
    a.acciones,
    a.imagen_url,
    a.mapa_visible,
    a.total_enviadas,
    c.nombre    AS categoria_nombre,
    c.slug      AS categoria_slug,
    c.color_hex AS categoria_color,
    c.icono     AS categoria_icono,
    z.nombre    AS zona_nombre,
    z.tipo      AS zona_tipo,
    a.creado_en,
    a.actualizado_en
FROM  alertas.alt_alertas a
JOIN  alertas.cat_categorias_alerta   c ON c.id = a.categoria_id AND c.eliminado_en IS NULL
LEFT JOIN alertas.cat_zonas_geograficas z ON z.id = a.zona_id    AND z.eliminado_en IS NULL
WHERE a.eliminado_en IS NULL
  AND a.estatus = 'activa';

COMMENT ON VIEW alertas.v_alertas_activas IS 'Alertas activas con datos de categoría y zona principal.';

-- Errores y eventos del sistema en las últimas 24 horas
CREATE OR REPLACE VIEW auditoria.v_errores_recientes AS
SELECT
    id,
    nivel,
    modulo,
    operacion,
    mensaje,
    codigo_error,
    entidad,
    entidad_id,
    ip_origen,
    request_id,
    creado_en
FROM  auditoria.aud_bitacora_errores
WHERE creado_en >= NOW() - INTERVAL '24 hours'
ORDER BY creado_en DESC;

COMMENT ON VIEW auditoria.v_errores_recientes IS 'Errores y eventos del sistema en las últimas 24 horas.';