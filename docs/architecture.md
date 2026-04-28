# Arquitectura — app-alertamientos

## Resumen Ejecutivo

`app-alertamientos` es una API REST backend construida con **NestJS** para la gestión de alertas geográficas con cobertura multinivel. La API es consumida por **dos clientes diferenciados**:

1. **App de usuario final (móvil)** — No requiere autenticación. Consulta alertas, historial, datos de usuario y zonas suscritas.
2. **Proyecto administrador** — Requiere autenticación JWT. Gestiona alertas, categorías, zonas y administradores.

Los endpoints públicos (sin auth) son una **decisión de diseño intencional**: la app de usuario final no implementa login.

---

## Stack Tecnológico

| Categoría | Tecnología | Versión |
|---|---|---|
| **Framework** | NestJS | 11.x |
| **Lenguaje** | TypeScript | 5.7 |
| **Runtime** | Node.js | 18+ |
| **Base de datos** | PostgreSQL | 14+ |
| **ORM** | Drizzle ORM | 0.45 |
| **Autenticación** | JWT + Passport.js | — |
| **Hashing** | bcryptjs | 3.x |
| **Validación** | class-validator + class-transformer | — |
| **Push Notifications** | OneSignal API | — |
| **Testing** | Jest + Supertest | — |
| **Linting** | ESLint + Prettier | — |

---

## Clientes Consumidores

```
┌─────────────────────────┐         ┌─────────────────────────┐
│    App Usuario Final    │         │   Proyecto Administrador│
│     (móvil, sin auth)   │         │    (con auth JWT)       │
└──────────┬──────────────┘         └──────────┬──────────────┘
           │                                   │
           │  GET /alertas                     │  POST /alertas
           │  GET /alertas/:id                 │  PATCH /alertas/:id/estatus
           │  GET /alertas/:id/actualizaciones │  DELETE /alertas/:id
           │  POST /usuarios                   │  POST /categorias
           │  GET /usuarios/by-device/:id      │  POST /zonas
           │  PATCH /usuarios/:id/ubicacion    │  GET /usuarios (listado admin)
           │  GET /usuarios/:id/alertas        │  GET /auth/profile
           │  GET /usuarios/:id/zonas          │  ...
           │  POST /usuarios/:id/zonas         │
           │  GET /usuarios/:id/notificaciones │
           └──────────────┬────────────────────┘
                          │
                          ▼
               ┌─────────────────────┐
               │   app-alertamientos │
               │    (este proyecto)  │
               └─────────────────────┘
```

> Los endpoints **sin autenticación** son intencionales. La app de usuario final no tiene login; accede directamente a los recursos que necesita.

---

## Patrón Arquitectónico

**Arquitectura Monolítica Modular** siguiendo el patrón de NestJS:

```
HTTP Request
     │
     ▼
┌─────────────┐
│   Guards    │  JwtAuthGuard → RolesGuard (solo endpoints de admin)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Controllers │  Validación de DTOs (Pipes globales)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Services   │  Lógica de negocio + Drizzle ORM
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ PostgreSQL  │  2 schemas: alertas + auditoria
└─────────────┘
```

---

## Módulos de la Aplicación

```
AppModule (raíz)
├── ConfigModule (global)       — Variables de entorno
├── DatabaseModule (global)     — Conexión PostgreSQL + Drizzle
├── AuthModule                  — JWT, guards, estrategias
├── AlertasModule               — Dominio central
├── CategoriasModule            — Catálogo de categorías
├── ZonasModule                 — Zonas geográficas
├── UsuariosModule              — Usuarios finales
└── NotificacionesModule        — Push notifications
```

---

## Dominio de Alertas

### Máquina de Estados

```
                  ┌──────────┐
         ┌──────►│ borrador │
         │        └────┬─────┘
         │             │ activar
         │             ▼
         │        ┌──────────┐ ◄────── reactivar
         │        │  activa  │──────►  desactivada
         │        └────┬─────┘              │
         │             │                    │ cancelar
         │             │ expirar            │
         │             ▼                    ▼
         │        ┌──────────┐        ┌──────────┐
         └────────│ expirada │        │cancelada │
    (terminal)    └──────────┘        └──────────┘
                  (terminal)          (terminal)
```

### Restricción Geográfica

Una alerta **debe** tener al menos una referencia geográfica:

| Opción | Campos |
|---|---|
| Zona predefinida | `zonaId` |
| Coordenadas | `centroLatitud` + `centroLongitud` |
| Polígono personalizado | `poligonoZona` (GeoJSON) |

---

## Arquitectura de Base de Datos

### Schemas de PostgreSQL

```
┌─────────────────────────────────────────┐
│           Schema: alertas               │
├─────────────────────────────────────────┤
│ alt_administradores                     │
│ alt_usuarios                            │
│ cat_categorias_alerta                   │
│ cat_zonas_geograficas                   │
│ alt_alertas                             │
│ alt_alertas_zonas (N:M)                 │
│ alt_actualizaciones_alerta              │
│ alt_usuarios_zonas                      │
│ alt_notificaciones_enviadas             │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│           Schema: auditoria             │
├─────────────────────────────────────────┤
│ aud_bitacora_errores                    │
│ aud_auditoria_cambios                   │
└─────────────────────────────────────────┘
```

### Patrón Soft Delete

**Todos** los registros usan soft-delete. Nunca se borran físicamente.

```typescript
// Eliminación
{ eliminadoEn: new Date(), eliminadoPor: adminId }

// Filtro en consultas
WHERE eliminadoEn IS NULL
```

---

## Autenticación y Autorización

### Flujo de Autenticación

```
Cliente                    API                       BD
  │                         │                         │
  │  POST /auth/login        │                         │
  │  { email, password }    │                         │
  │─────────────────────────►                         │
  │                         │  SELECT admin WHERE     │
  │                         │  email = ?              │
  │                         │─────────────────────────►
  │                         │◄─────────────────────────
  │                         │  bcrypt.compare()       │
  │                         │  jwt.sign({ id, rol })  │
  │◄────────────────────────│                         │
  │  { accessToken }        │                         │
```

### Guards y Decoradores

| Elemento | Archivo | Propósito |
|---|---|---|
| `JwtAuthGuard` | `auth/guards/jwt-auth.guard.ts` | Verifica Bearer token JWT |
| `RolesGuard` | `auth/guards/roles.guard.ts` | Verifica rol del admin |
| `@CurrentAdmin()` | `auth/decorators/current-admin.decorator.ts` | Extrae admin del JWT |
| `@Roles()` | `auth/decorators/roles.decorator.ts` | Declara roles requeridos |

---

## Integración con OneSignal

### Flujo de Notificación Push

```
AlertasService.cambiarEstatus('activa')
        │
        ▼
NotificacionesService.enviarNotificacionAlerta(alertaId)
        │
        ├── Consulta usuarios en el área geográfica de la alerta
        ├── Filtra usuarios con notificaciones activas
        ├── Obtiene subscriptionIds de OneSignal
        │
        ▼
OneSignalService.enviarNotificacion(subscriptionIds, titulo, mensaje)
        │
        ├── POST https://onesignal.com/api/v1/notifications
        │
        ▼
NotificacionesService.registrarEnvio(alertaId, usuarioId, estatus)
        │
        ▼
alt_notificaciones_enviadas (registro del envío)
```

---

## Configuración Global de la API

Configurado en `src/main.ts`:

| Configuración | Valor |
|---|---|
| **Prefijo de rutas** | `/api` |
| **Puerto** | `5000` (configurable via `PORT`) |
| **CORS** | Habilitado para todos los orígenes |
| **Validación global** | class-validator con whitelist + transform |
| **Transformación de tipos** | `enableImplicitConversion: true` |

---

## Patrón de Paginación

Todos los endpoints de listado devuelven:

```typescript
{
  data: T[],           // Resultados de la página actual
  meta: {
    total: number,     // Total de registros
    page: number,      // Página actual
    limit: number,     // Ítems por página
    totalPages: number // Total de páginas
  }
}
```

---

## Configuración de Entorno

La validación de variables de entorno ocurre al iniciar (`src/config/env.validation.ts`). La app falla rápido si faltan variables críticas.

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | **Sí** | Cadena de conexión PostgreSQL |
| `JWT_SECRET` | **Sí** | Secreto para firmar JWT |
| `JWT_EXPIRES_IN` | No | Expiración JWT en segundos (default: 86400) |
| `PORT` | No | Puerto del servidor (default: 5000) |

---

## Estructura de Directorios Críticos

Ver [Análisis de Árbol de Fuentes](./source-tree-analysis.md) para el árbol completo anotado.

| Directorio | Propósito |
|---|---|
| `src/alertas/` | Dominio central — máquina de estados, geo-restricción |
| `src/database/schema/` | Fuente de verdad del schema de BD |
| `src/auth/` | Seguridad — JWT, guards, decoradores |
| `src/notificaciones/` | Integración OneSignal |
| `src/usuarios/` | Dispositivos móviles y suscripciones geográficas |

---

## Pruebas

| Tipo | Herramienta | Patrón de archivos |
|---|---|---|
| Unitarias | Jest + ts-jest | `src/**/*.spec.ts` |
| E2E | Jest + Supertest | `test/**/*.e2e-spec.ts` |

Configuración de Jest en `package.json` (unitarias) y `test/jest-e2e.json` (e2e).
