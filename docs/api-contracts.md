# Contratos de API — app-alertamientos

> **Base URL:** `http://localhost:5000/api`  
> **Autenticación:** Bearer Token JWT en header `Authorization`  
> **Formato:** JSON  
> **Paginación:** Parámetros `page` (default: 1) y `limit` (default: 20) en todos los endpoints de listado

## Clientes Consumidores

Esta API sirve a **dos clientes diferenciados**:

| Leyenda | Descripción |
|---|---|
| `[USUARIO]` | Consumido por la **app de usuario final** (móvil). **Sin autenticación** por diseño. |
| `[ADMIN]` | Consumido por el **proyecto administrador**. **Requiere JWT**. |

> Los endpoints públicos no son un error de seguridad — la app de usuario final no tiene login y accede directamente a los recursos que necesita.

---

## Autenticación (`/auth`)
> Exclusivo del **proyecto administrador**.

### `[ADMIN]` POST `/auth/login`
Login de administrador.

**Request Body:**
```json
{
  "email": "admin@ejemplo.com",
  "password": "contraseña"
}
```

**Response 200:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": { "id": 1, "email": "admin@ejemplo.com", "nombre": "..." }
}
```

---

### `[ADMIN]` GET `/auth/profile` — JWT
Devuelve el perfil del administrador autenticado.

**Response 200:**
```json
{
  "id": 1,
  "email": "admin@ejemplo.com",
  "nombre": "...",
  "rol": "superadmin"
}
```

---

## Alertas (`/alertas`)

### `[ADMIN]` POST `/alertas` — JWT
Crea una nueva alerta.

Restricción geográfica: debe incluir al menos uno de: `zonaId`, (`centroLatitud` + `centroLongitud`), o `poligonoZona`.

**Request Body:**
```json
{
  "titulo": "string (requerido)",
  "descripcion": "string (opcional)",
  "nivelSeveridad": "bajo | medio | alto | critico",
  "categoriaId": "number (requerido)",
  "zonaId": "number (opcional)",
  "centroLatitud": "number (opcional)",
  "centroLongitud": "number (opcional)",
  "poligonoZona": "GeoJSON object (opcional)",
  "fechaExpiracion": "ISO8601 (opcional)"
}
```

**Response 201:** Objeto alerta creada.

---

### `[USUARIO]` `[ADMIN]` GET `/alertas`
Lista alertas con filtros y paginación. **Sin autenticación** — consumido principalmente por la app de usuario.

**Query Params:**
| Parámetro | Tipo | Descripción |
|---|---|---|
| `page` | number | Página (default: 1) |
| `limit` | number | Ítems por página (default: 20) |
| `estatus` | string | Filtrar por estatus |
| `nivelSeveridad` | string | Filtrar por severidad |
| `categoriaId` | number | Filtrar por categoría |
| `busqueda` | string | Búsqueda de texto |

**Response 200:**
```json
{
  "data": [...],
  "meta": { "total": 100, "page": 1, "limit": 20, "totalPages": 5 }
}
```

---

### `[USUARIO]` `[ADMIN]` GET `/alertas/:id`
Obtiene una alerta por ID. **Sin autenticación.**

**Response 200:** Objeto alerta con relaciones (zonas, actualizaciones).

---

### `[ADMIN]` PATCH `/alertas/:id` — JWT
Actualiza una alerta.

**Request Body:** Campos opcionales del CreateAlertaDto.

---

### `[ADMIN]` DELETE `/alertas/:id` — JWT
Soft-delete de una alerta.

**Response 200:** Confirmación de eliminación.

---

### `[ADMIN]` PATCH `/alertas/:id/estatus` — JWT
Cambia el estatus de una alerta siguiendo la máquina de estados.

**Transiciones válidas:**
- `borrador` → `activa`, `cancelada`
- `activa` → `desactivada`, `expirada`, `cancelada`
- `desactivada` → `activa`, `cancelada`
- `expirada` → (estado terminal)
- `cancelada` → (estado terminal)

**Request Body:**
```json
{ "estatus": "activa | desactivada | cancelada | expirada" }
```

---

### `[ADMIN]` POST `/alertas/:id/actualizaciones` — JWT
Agrega una actualización de seguimiento a una alerta.

**Request Body:**
```json
{
  "contenido": "string (requerido)",
  "tipo": "string (opcional)"
}
```

---

### `[USUARIO]` GET `/alertas/:id/actualizaciones`
Lista el historial de actualizaciones de una alerta. **Sin autenticación** — consumido por la app de usuario.

**Response 200:** Array de actualizaciones ordenadas por fecha.

---

### `[ADMIN]` POST `/alertas/:id/zonas` — JWT
Asocia una zona geográfica a una alerta.

**Request Body:**
```json
{ "zonaId": 1 }
```

---

### `[ADMIN]` DELETE `/alertas/:id/zonas/:zonaId` — JWT
Desasocia una zona de una alerta (soft-delete).

---

## Categorías (`/categorias`)

### `[ADMIN]` POST `/categorias` — JWT
Crea una nueva categoría.

**Request Body:**
```json
{
  "nombre": "string (requerido)",
  "descripcion": "string (opcional)",
  "color": "string hex (opcional)",
  "icono": "string (opcional)"
}
```

---

### `[USUARIO]` `[ADMIN]` GET `/categorias`
Lista categorías con paginación y filtros. **Sin autenticación.**

**Query Params:** `page`, `limit`, `busqueda`, `activo`.

**Response 200:** Lista paginada de categorías.

---

### `[USUARIO]` `[ADMIN]` GET `/categorias/:id`
Obtiene una categoría por ID. **Sin autenticación.**

---

### `[ADMIN]` PATCH `/categorias/:id` — JWT
Actualiza una categoría.

---

### `[ADMIN]` DELETE `/categorias/:id` — JWT
Soft-delete de una categoría.

---

### `[ADMIN]` PATCH `/categorias/:id/toggle-activo` — JWT
Activa o desactiva una categoría.

---

## Zonas Geográficas (`/zonas`)

### `[ADMIN]` POST `/zonas` — JWT
Crea una nueva zona geográfica.

**Request Body:**
```json
{
  "nombre": "string (requerido)",
  "descripcion": "string (opcional)",
  "nivelCobertura": "municipio | estado | region | pais",
  "poligono": "GeoJSON object (opcional)",
  "centroLatitud": "number (opcional)",
  "centroLongitud": "number (opcional)"
}
```

---

### `[USUARIO]` `[ADMIN]` GET `/zonas`
Lista zonas con paginación. **Sin autenticación** — la app de usuario lo usa para mostrar zonas disponibles.

**Query Params:** `page`, `limit`, `busqueda`, `activo`, `nivelCobertura`.

---

### `[USUARIO]` `[ADMIN]` GET `/zonas/:id`
Obtiene una zona por ID. **Sin autenticación.**

---

### `[ADMIN]` PATCH `/zonas/:id` — JWT
Actualiza una zona.

---

### `[ADMIN]` DELETE `/zonas/:id` — JWT
Soft-delete de una zona.

---

### `[ADMIN]` PATCH `/zonas/:id/toggle-activo` — JWT
Activa o desactiva una zona.

---

## Usuarios (`/usuarios`)

### `[USUARIO]` POST `/usuarios`
Registra un usuario final (dispositivo móvil). **Sin autenticación** — llamado por la app al primer inicio.

**Request Body:**
```json
{
  "deviceId": "string (requerido)",
  "nombre": "string (opcional)",
  "subscriptionId": "string OneSignal (opcional)",
  "latitud": "number (opcional)",
  "longitud": "number (opcional)"
}
```

---

### `[ADMIN]` GET `/usuarios` — JWT
Lista usuarios (panel administrador).

**Query Params:** `page`, `limit`, `busqueda`.

---

### `[USUARIO]` GET `/usuarios/by-device/:deviceId`
Busca un usuario por su ID de dispositivo. **Sin autenticación** — la app lo usa para recuperar su perfil al iniciar.

---

### `[USUARIO]` GET `/usuarios/:id`
Obtiene un usuario por ID. **Sin autenticación.**

---

### `[USUARIO]` PATCH `/usuarios/:id`
Actualiza datos del usuario. **Sin autenticación** — la app gestiona sus propios datos.

---

### `[ADMIN]` DELETE `/usuarios/:id` — JWT
Soft-delete de un usuario.

---

### `[USUARIO]` GET `/usuarios/:id/alertas`
Lista alertas relevantes para el usuario con paginación. **Sin autenticación** — núcleo del flujo de la app de usuario.

**Query Params:** `page` (default: 1), `limit` (default: 20).

---

### `[USUARIO]` GET `/usuarios/:id/alertas/recientes`
Lista alertas recientes para el usuario. **Sin autenticación.**

**Query Params:** `limit` (default: 10), `horas` (default: 0 = sin límite temporal).

---

### `[USUARIO]` GET `/usuarios/:id/alertas/ultimo`
Devuelve la última alerta relevante para el usuario. **Sin autenticación.**

---

### `[USUARIO]` PATCH `/usuarios/:id/ubicacion`
Actualiza la ubicación geográfica del usuario. **Sin autenticación** — llamado por la app para mantener la ubicación actualizada.

**Request Body:**
```json
{ "latitud": 19.4326, "longitud": -99.1332 }
```

---

### `[USUARIO]` PATCH `/usuarios/:id/preferencias`
Actualiza las preferencias de notificación del usuario. **Sin autenticación.**

**Request Body:**
```json
{
  "recibirNotificaciones": true,
  "categoriasInteres": [1, 2, 3]
}
```

---

### `[USUARIO]` GET `/usuarios/:id/zonas`
Lista zonas a las que está suscrito el usuario. **Sin autenticación.**

---

### `[USUARIO]` POST `/usuarios/:id/zonas`
Suscribe al usuario a una zona. **Sin autenticación** — la app gestiona las suscripciones del usuario.

**Request Body:**
```json
{ "zonaId": 1 }
```

---

### `[USUARIO]` PATCH `/usuarios/:id/zonas/:zonaId/toggle`
Activa o desactiva la suscripción de un usuario a una zona. **Sin autenticación.**

---

### `[USUARIO]` DELETE `/usuarios/:id/zonas/:zonaId`
Elimina la suscripción de un usuario a una zona. **Sin autenticación.**

---

### `[USUARIO]` GET `/usuarios/:id/notificaciones`
Lista el historial de notificaciones recibidas por el usuario. **Sin autenticación** — la app muestra el historial al usuario.

**Query Params:** `page`, `limit`, `leida`.

---

### `[USUARIO]` PATCH `/usuarios/:id/notificaciones/:notifId/marcar-leida`
Marca una notificación como leída. **Sin autenticación.**

---

## Notificaciones (`/notificaciones`)

### `[ADMIN]` POST `/notificaciones/test/broadcast` — JWT
Envía una notificación de prueba a todos los dispositivos.

**Request Body:**
```json
{
  "titulo": "string (opcional)",
  "mensaje": "string (opcional)"
}
```

---

### `[ADMIN]` POST `/notificaciones/test/device` — JWT
Envía una notificación de prueba a un dispositivo específico.

**Request Body:**
```json
{
  "subscriptionId": "string (requerido)",
  "titulo": "string (opcional)",
  "mensaje": "string (opcional)"
}
```

---

### `[ADMIN]` POST `/notificaciones/test/alerta/:id` — JWT
Envía la notificación de una alerta específica de prueba.

---

### `[ADMIN]` GET `/notificaciones/alerta/:id/historial` — JWT
Historial de notificaciones enviadas para una alerta (panel administrador).

**Response 200:** Array de notificaciones con timestamps y estados.

---

### `[ADMIN]` GET `/notificaciones/alerta/:id/estadisticas` — JWT
Estadísticas de envío de notificaciones para una alerta (panel administrador).

**Response 200:**
```json
{
  "total": 150,
  "enviadas": 148,
  "fallidas": 2,
  "tasaEntrega": 0.987
}
```

---

## Códigos de Error

| Código | Significado |
|---|---|
| 400 | Bad Request — Datos de entrada inválidos |
| 401 | Unauthorized — JWT ausente o inválido |
| 403 | Forbidden — Sin permisos para esta operación |
| 404 | Not Found — Recurso no encontrado |
| 409 | Conflict — Conflicto de estado (ej. transición inválida) |
| 500 | Internal Server Error |
