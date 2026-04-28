# Modelos de Datos — app-alertamientos

> **ORM:** Drizzle ORM v0.45  
> **Base de datos:** PostgreSQL  
> **Patrón de eliminación:** Soft-delete (`eliminadoEn` / `eliminadoPor`)

---

## Schemas de PostgreSQL

El proyecto utiliza **dos schemas reales de PostgreSQL** (no solo tablas):

| Schema | Propósito |
|---|---|
| `alertas` | Tablas de lógica de negocio central |
| `auditoria` | Tablas de auditoría y registro de errores |

---

## Schema `alertas`

### `alt_administradores`
Usuarios administradores del sistema.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | serial PK | Identificador único |
| `nombre` | varchar | Nombre completo |
| `email` | varchar (único) | Correo electrónico |
| `password` | varchar | Hash bcrypt de la contraseña |
| `rol` | enum | Rol: `superadmin`, `admin`, `operador` |
| `activo` | boolean | Estado activo/inactivo |
| `creadoEn` | timestamp | Fecha de creación |
| `actualizadoEn` | timestamp | Fecha de última actualización |
| `eliminadoEn` | timestamp | Soft-delete: fecha de eliminación |
| `eliminadoPor` | integer FK | Soft-delete: quién eliminó |

---

### `alt_usuarios`
Usuarios finales (dispositivos móviles).

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | serial PK | Identificador único |
| `deviceId` | varchar (único) | ID único del dispositivo |
| `nombre` | varchar | Nombre opcional del usuario |
| `subscriptionId` | varchar | ID de suscripción OneSignal |
| `latitud` | decimal | Última latitud conocida |
| `longitud` | decimal | Última longitud conocida |
| `recibirNotificaciones` | boolean | Preferencia de notificaciones |
| `creadoEn` | timestamp | Fecha de registro |
| `actualizadoEn` | timestamp | Fecha de última actualización |
| `eliminadoEn` | timestamp | Soft-delete |
| `eliminadoPor` | integer | Soft-delete |

---

### `cat_categorias_alerta`
Catálogo de categorías de alertas.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | serial PK | Identificador único |
| `nombre` | varchar | Nombre de la categoría |
| `descripcion` | text | Descripción (opcional) |
| `color` | varchar | Color hex (opcional) |
| `icono` | varchar | Icono (opcional) |
| `activo` | boolean | Estado activo/inactivo |
| `creadoEn` | timestamp | Fecha de creación |
| `actualizadoEn` | timestamp | Fecha de última actualización |
| `eliminadoEn` | timestamp | Soft-delete |
| `eliminadoPor` | integer | Soft-delete |

---

### `cat_zonas_geograficas`
Catálogo de zonas geográficas con cobertura multinivel.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | serial PK | Identificador único |
| `nombre` | varchar | Nombre de la zona |
| `descripcion` | text | Descripción (opcional) |
| `nivelCobertura` | enum | Nivel: `municipio`, `estado`, `region`, `pais` |
| `poligono` | jsonb | Polígono GeoJSON de la zona |
| `centroLatitud` | decimal | Latitud del centro |
| `centroLongitud` | decimal | Longitud del centro |
| `activo` | boolean | Estado activo/inactivo |
| `creadoEn` | timestamp | Fecha de creación |
| `actualizadoEn` | timestamp | Fecha de última actualización |
| `eliminadoEn` | timestamp | Soft-delete |
| `eliminadoPor` | integer | Soft-delete |

---

### `alt_alertas`
Tabla principal de alertas geográficas.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | serial PK | Identificador único |
| `titulo` | varchar | Título de la alerta |
| `descripcion` | text | Descripción detallada |
| `nivelSeveridad` | enum | Severidad: `bajo`, `medio`, `alto`, `critico` |
| `estatus` | enum | Estatus: `borrador`, `activa`, `desactivada`, `expirada`, `cancelada` |
| `categoriaId` | integer FK | Referencia a `cat_categorias_alerta` |
| `zonaId` | integer FK | Zona predefinida (opcional) |
| `centroLatitud` | decimal | Latitud del epicentro (opcional) |
| `centroLongitud` | decimal | Longitud del epicentro (opcional) |
| `poligonoZona` | jsonb | Polígono GeoJSON personalizado (opcional) |
| `fechaExpiracion` | timestamp | Fecha de expiración (opcional) |
| `creadoPor` | integer FK | Admin que creó la alerta |
| `creadoEn` | timestamp | Fecha de creación |
| `actualizadoEn` | timestamp | Fecha de última actualización |
| `eliminadoEn` | timestamp | Soft-delete |
| `eliminadoPor` | integer | Soft-delete |

> **Restricción geográfica:** Debe tener al menos uno de: `zonaId`, (`centroLatitud` + `centroLongitud`), o `poligonoZona`.

---

### `alt_alertas_zonas`
Relación N:M entre alertas y zonas geográficas.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | serial PK | Identificador único |
| `alertaId` | integer FK | Referencia a `alt_alertas` |
| `zonaId` | integer FK | Referencia a `cat_zonas_geograficas` |
| `creadoEn` | timestamp | Fecha de asociación |
| `eliminadoEn` | timestamp | Soft-delete |
| `eliminadoPor` | integer | Soft-delete |

---

### `alt_actualizaciones_alerta`
Historial de actualizaciones/seguimiento de alertas.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | serial PK | Identificador único |
| `alertaId` | integer FK | Referencia a `alt_alertas` |
| `contenido` | text | Contenido de la actualización |
| `tipo` | varchar | Tipo de actualización (opcional) |
| `creadoPor` | integer FK | Admin que creó la actualización |
| `creadoEn` | timestamp | Fecha de creación |
| `eliminadoEn` | timestamp | Soft-delete |
| `eliminadoPor` | integer | Soft-delete |

---

### `alt_usuarios_zonas`
Suscripciones de usuarios finales a zonas geográficas.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | serial PK | Identificador único |
| `usuarioId` | integer FK | Referencia a `alt_usuarios` |
| `zonaId` | integer FK | Referencia a `cat_zonas_geograficas` |
| `activo` | boolean | Estado de la suscripción |
| `creadoEn` | timestamp | Fecha de suscripción |
| `actualizadoEn` | timestamp | Fecha de última actualización |
| `eliminadoEn` | timestamp | Soft-delete |
| `eliminadoPor` | integer | Soft-delete |

---

### `alt_notificaciones_enviadas`
Registro de notificaciones push enviadas.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | serial PK | Identificador único |
| `alertaId` | integer FK | Alerta relacionada |
| `usuarioId` | integer FK | Usuario destinatario |
| `subscriptionId` | varchar | ID OneSignal del destinatario |
| `estatus` | enum | Estado: `enviada`, `fallida`, `leida` |
| `leida` | boolean | Si fue leída por el usuario |
| `enviadoEn` | timestamp | Fecha de envío |
| `leidaEn` | timestamp | Fecha de lectura (opcional) |

---

## Schema `auditoria`

### `aud_bitacora_errores`
Registro centralizado de errores de la aplicación.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | serial PK | Identificador único |
| `nivel` | varchar | Nivel: `error`, `warn`, `info` |
| `mensaje` | text | Mensaje del error |
| `stack` | text | Stack trace (opcional) |
| `contexto` | jsonb | Datos de contexto adicional |
| `creadoEn` | timestamp | Fecha y hora del error |

---

### `aud_auditoria_cambios`
Rastro de auditoría de cambios en entidades del sistema.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | serial PK | Identificador único |
| `tabla` | varchar | Nombre de la tabla afectada |
| `registroId` | integer | ID del registro modificado |
| `accion` | enum | Acción: `INSERT`, `UPDATE`, `DELETE` |
| `datosAnteriores` | jsonb | Estado previo del registro |
| `datosNuevos` | jsonb | Estado nuevo del registro |
| `realizadoPor` | integer FK | Admin que realizó el cambio |
| `creadoEn` | timestamp | Fecha y hora del cambio |

---

## Relaciones

```
alt_administradores ─┐
                      ├──> alt_alertas (creadoPor)
                      └──> alt_actualizaciones_alerta (creadoPor)

cat_categorias_alerta ──> alt_alertas (categoriaId)

cat_zonas_geograficas ──> alt_alertas (zonaId)
cat_zonas_geograficas ──> alt_alertas_zonas (zonaId)
cat_zonas_geograficas ──> alt_usuarios_zonas (zonaId)

alt_alertas ──> alt_alertas_zonas (alertaId)
alt_alertas ──> alt_actualizaciones_alerta (alertaId)
alt_alertas ──> alt_notificaciones_enviadas (alertaId)

alt_usuarios ──> alt_usuarios_zonas (usuarioId)
alt_usuarios ──> alt_notificaciones_enviadas (usuarioId)
```

---

## Enums Definidos

| Enum | Valores |
|---|---|
| `estatusAlerta` | `borrador`, `activa`, `desactivada`, `expirada`, `cancelada` |
| `nivelSeveridad` | `bajo`, `medio`, `alto`, `critico` |
| `nivelCobertura` | `municipio`, `estado`, `region`, `pais` |
| `rolAdministrador` | `superadmin`, `admin`, `operador` |
| `estatusNotificacion` | `enviada`, `fallida`, `leida` |

---

## Convenciones

- **Soft-delete:** Nunca se eliminan registros físicamente. Se usa `eliminadoEn` (timestamp) y `eliminadoPor` (FK al admin).
- **Siempre filtrar:** Todas las consultas deben incluir `WHERE eliminadoEn IS NULL`.
- **Relaciones N:M:** Al actualizar, se hace soft-delete de las existentes y se insertan las nuevas.
- **Definiciones:** Todas las tablas están definidas en `src/database/schema/` con Drizzle ORM.
