-- =============================================================================
-- Script complementario: elementos que Drizzle ORM no gestiona.
-- Ejecutar DESPUÉS de `drizzle-kit push`.
--
-- Incluye: CHECK constraints, índices parciales/GIN, funciones,
--          triggers, datos semilla y vistas.
-- =============================================================================

SET search_path TO alertas, public;

-- =============================================================================
-- CHECK CONSTRAINTS
-- =============================================================================

-- Zonas: debe tener coordenadas centro o polígono
ALTER TABLE alertas.cat_zonas_geograficas
  DROP CONSTRAINT IF EXISTS ck_cat_zonas_coordenadas;
ALTER TABLE alertas.cat_zonas_geograficas
  ADD CONSTRAINT ck_cat_zonas_coordenadas CHECK (
    (centro_latitud IS NOT NULL AND centro_longitud IS NOT NULL)
    OR poligono IS NOT NULL
  );

-- Categorías: color hex válido
ALTER TABLE alertas.cat_categorias_alerta
  DROP CONSTRAINT IF EXISTS ck_cat_color_hex;
ALTER TABLE alertas.cat_categorias_alerta
  ADD CONSTRAINT ck_cat_color_hex CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$');

-- Alertas: fecha_fin debe ser posterior a fecha_inicio
ALTER TABLE alertas.alt_alertas
  DROP CONSTRAINT IF EXISTS ck_alt_alertas_fecha;
ALTER TABLE alertas.alt_alertas
  ADD CONSTRAINT ck_alt_alertas_fecha CHECK (fecha_fin IS NULL OR fecha_fin > fecha_inicio);

-- Alertas: debe tener zona del catálogo o zona ad-hoc
ALTER TABLE alertas.alt_alertas
  DROP CONSTRAINT IF EXISTS ck_alt_alertas_zona;
ALTER TABLE alertas.alt_alertas
  ADD CONSTRAINT ck_alt_alertas_zona CHECK (
    zona_id IS NOT NULL
    OR (centro_latitud IS NOT NULL AND centro_longitud IS NOT NULL)
    OR poligono_zona IS NOT NULL
  );

-- Usuarios: horario silencioso completo o ninguno
ALTER TABLE alertas.alt_usuarios
  DROP CONSTRAINT IF EXISTS ck_alt_usuarios_silencio;
ALTER TABLE alertas.alt_usuarios
  ADD CONSTRAINT ck_alt_usuarios_silencio CHECK (
    (silencio_inicio IS NULL AND silencio_fin IS NULL)
    OR (silencio_inicio IS NOT NULL AND silencio_fin IS NOT NULL)
  );

-- Notificaciones: máximo 10 reintentos
ALTER TABLE alertas.alt_notificaciones_enviadas
  DROP CONSTRAINT IF EXISTS ck_alt_notif_intento;
ALTER TABLE alertas.alt_notificaciones_enviadas
  ADD CONSTRAINT ck_alt_notif_intento CHECK (intento_numero BETWEEN 1 AND 10);

-- Auditoría cambios: operación válida
ALTER TABLE auditoria.aud_auditoria_cambios
  DROP CONSTRAINT IF EXISTS ck_aud_auditoria_operacion;
ALTER TABLE auditoria.aud_auditoria_cambios
  ADD CONSTRAINT ck_aud_auditoria_operacion CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE'));


-- =============================================================================
-- ÍNDICES PARCIALES Y GIN
-- =============================================================================

-- cat_zonas_geograficas
CREATE INDEX IF NOT EXISTS idx_cat_zonas_tipo            ON alertas.cat_zonas_geograficas(tipo)            WHERE eliminado_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_cat_zonas_clave_estado    ON alertas.cat_zonas_geograficas(clave_estado)    WHERE eliminado_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_cat_zonas_clave_municipio ON alertas.cat_zonas_geograficas(clave_municipio) WHERE eliminado_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_cat_zonas_codigo_postal   ON alertas.cat_zonas_geograficas(codigo_postal)   WHERE eliminado_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_cat_zonas_poligono        ON alertas.cat_zonas_geograficas USING GIN (poligono);

-- alt_alertas
CREATE INDEX IF NOT EXISTS idx_alt_alertas_categoria    ON alertas.alt_alertas(categoria_id)      WHERE eliminado_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_alt_alertas_estatus      ON alertas.alt_alertas(estatus)           WHERE eliminado_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_alt_alertas_severidad    ON alertas.alt_alertas(nivel_severidad)   WHERE eliminado_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_alt_alertas_fecha_inicio ON alertas.alt_alertas(fecha_inicio DESC) WHERE eliminado_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_alt_alertas_zona_id      ON alertas.alt_alertas(zona_id)           WHERE eliminado_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_alt_alertas_acciones     ON alertas.alt_alertas USING GIN (acciones);

-- alt_alertas_zonas
CREATE INDEX IF NOT EXISTS idx_alt_alertas_zonas_alerta ON alertas.alt_alertas_zonas(alerta_id) WHERE eliminado_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_alt_alertas_zonas_zona   ON alertas.alt_alertas_zonas(zona_id)   WHERE eliminado_en IS NULL;

-- alt_actualizaciones_alerta
CREATE INDEX IF NOT EXISTS idx_alt_actualizaciones_alerta
    ON alertas.alt_actualizaciones_alerta(alerta_id, creado_en DESC)
    WHERE eliminado_en IS NULL;

-- alt_usuarios
CREATE INDEX IF NOT EXISTS idx_alt_usuarios_token_push ON alertas.alt_usuarios(token_push)       WHERE eliminado_en IS NULL AND token_push IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alt_usuarios_ubicacion  ON alertas.alt_usuarios(latitud, longitud) WHERE eliminado_en IS NULL AND gps_activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_alt_usuarios_cp         ON alertas.alt_usuarios(codigo_postal)     WHERE eliminado_en IS NULL AND codigo_postal IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alt_usuarios_plataforma ON alertas.alt_usuarios(plataforma)        WHERE eliminado_en IS NULL;

-- alt_usuarios_zonas
CREATE INDEX IF NOT EXISTS idx_alt_usuarios_zonas_usuario ON alertas.alt_usuarios_zonas(usuario_id) WHERE eliminado_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_alt_usuarios_zonas_zona    ON alertas.alt_usuarios_zonas(zona_id)    WHERE eliminado_en IS NULL;

-- alt_notificaciones_enviadas
CREATE INDEX IF NOT EXISTS idx_alt_notif_alerta    ON alertas.alt_notificaciones_enviadas(alerta_id,  creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_alt_notif_usuario   ON alertas.alt_notificaciones_enviadas(usuario_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_alt_notif_estatus   ON alertas.alt_notificaciones_enviadas(estatus_envio)
    WHERE estatus_envio IN ('pendiente', 'fallida');
CREATE INDEX IF NOT EXISTS idx_alt_notif_no_leidas ON alertas.alt_notificaciones_enviadas(usuario_id)
    WHERE leida_en IS NULL AND enviada_en IS NOT NULL;

-- aud_bitacora_errores
CREATE INDEX IF NOT EXISTS idx_aud_bitacora_nivel   ON auditoria.aud_bitacora_errores(nivel,   creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_aud_bitacora_modulo  ON auditoria.aud_bitacora_errores(modulo,  creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_aud_bitacora_entidad ON auditoria.aud_bitacora_errores(entidad, entidad_id) WHERE entidad IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aud_bitacora_creado  ON auditoria.aud_bitacora_errores(creado_en DESC);

-- aud_auditoria_cambios
CREATE INDEX IF NOT EXISTS idx_aud_auditoria_tabla     ON auditoria.aud_auditoria_cambios(tabla, registro_id);
CREATE INDEX IF NOT EXISTS idx_aud_auditoria_creado    ON auditoria.aud_auditoria_cambios(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_aud_auditoria_admin     ON auditoria.aud_auditoria_cambios(administrador_id) WHERE administrador_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aud_auditoria_operacion ON auditoria.aud_auditoria_cambios(operacion, tabla);


-- =============================================================================
-- FUNCIONES Y TRIGGERS
-- =============================================================================

-- fn_actualizar_timestamp: mantiene actualizado_en en cada UPDATE
CREATE OR REPLACE FUNCTION alertas.fn_actualizar_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_actualizar_ts_alt_administradores ON alertas.alt_administradores;
CREATE TRIGGER trg_actualizar_ts_alt_administradores
    BEFORE UPDATE ON alertas.alt_administradores
    FOR EACH ROW EXECUTE FUNCTION alertas.fn_actualizar_timestamp();

DROP TRIGGER IF EXISTS trg_actualizar_ts_cat_zonas ON alertas.cat_zonas_geograficas;
CREATE TRIGGER trg_actualizar_ts_cat_zonas
    BEFORE UPDATE ON alertas.cat_zonas_geograficas
    FOR EACH ROW EXECUTE FUNCTION alertas.fn_actualizar_timestamp();

DROP TRIGGER IF EXISTS trg_actualizar_ts_cat_categorias ON alertas.cat_categorias_alerta;
CREATE TRIGGER trg_actualizar_ts_cat_categorias
    BEFORE UPDATE ON alertas.cat_categorias_alerta
    FOR EACH ROW EXECUTE FUNCTION alertas.fn_actualizar_timestamp();

DROP TRIGGER IF EXISTS trg_actualizar_ts_alt_alertas ON alertas.alt_alertas;
CREATE TRIGGER trg_actualizar_ts_alt_alertas
    BEFORE UPDATE ON alertas.alt_alertas
    FOR EACH ROW EXECUTE FUNCTION alertas.fn_actualizar_timestamp();

DROP TRIGGER IF EXISTS trg_actualizar_ts_alt_usuarios ON alertas.alt_usuarios;
CREATE TRIGGER trg_actualizar_ts_alt_usuarios
    BEFORE UPDATE ON alertas.alt_usuarios
    FOR EACH ROW EXECUTE FUNCTION alertas.fn_actualizar_timestamp();

DROP TRIGGER IF EXISTS trg_actualizar_ts_alt_usuarios_zonas ON alertas.alt_usuarios_zonas;
CREATE TRIGGER trg_actualizar_ts_alt_usuarios_zonas
    BEFORE UPDATE ON alertas.alt_usuarios_zonas
    FOR EACH ROW EXECUTE FUNCTION alertas.fn_actualizar_timestamp();

-- fn_auditoria_alertas: graba INSERT/UPDATE en aud_auditoria_cambios
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

DROP TRIGGER IF EXISTS trg_auditoria_alt_alertas ON alertas.alt_alertas;
CREATE TRIGGER trg_auditoria_alt_alertas
    AFTER INSERT OR UPDATE ON alertas.alt_alertas
    FOR EACH ROW EXECUTE FUNCTION alertas.fn_auditoria_alertas();

-- fn_contar_notificacion_enviada: incrementa total_enviadas
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

DROP TRIGGER IF EXISTS trg_contar_alt_notificacion ON alertas.alt_notificaciones_enviadas;
CREATE TRIGGER trg_contar_alt_notificacion
    AFTER INSERT OR UPDATE OF estatus_envio ON alertas.alt_notificaciones_enviadas
    FOR EACH ROW EXECUTE FUNCTION alertas.fn_contar_notificacion_enviada();


-- =============================================================================
-- DATOS SEMILLA (SEED)
-- =============================================================================

INSERT INTO alertas.cat_categorias_alerta (nombre, slug, color_hex, descripcion)
VALUES
    ('Alertas meteorológicas',  'meteorologica', '#E24B4A', 'Fenómenos meteorológicos: tormentas, inundaciones, huracanes.'),
    ('Noticias de última hora', 'ultima-hora',   '#E24B4A', 'Eventos o situaciones importantes que impactan la localidad.'),
    ('Vialidad',                'vialidad',       '#BA7517', 'Cierres viales, accidentes, desvíos.'),
    ('Servicios públicos',      'servicios',      '#185FA5', 'Cortes de agua, luz, gas u otros servicios.')
ON CONFLICT (slug) DO NOTHING;


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
