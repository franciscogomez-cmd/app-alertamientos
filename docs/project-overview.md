# Visión General del Proyecto — app-alertamientos

## Nombre y Propósito

**app-alertamientos** es una API REST backend para la gestión de alertas geográficas con cobertura multinivel. Es consumida por **dos proyectos cliente**:

- **App de usuario final (móvil):** Consulta alertas, historial, zonas suscritas y notificaciones. **No requiere autenticación** — acceso público por diseño.
- **Proyecto administrador:** Crea y gestiona alertas, categorías, zonas y administradores. **Requiere autenticación JWT.**

Los endpoints públicos no son una omisión de seguridad; son intencionales para el flujo de la app de usuario.

---

## Resumen Ejecutivo

El sistema provee:

- **Gestión de alertas** con ciclo de vida controlado por máquina de estados
- **Geo-referenciación multinivel** (municipio, estado, región, país)
- **Notificaciones push** automáticas vía OneSignal con geolocalización
- **API REST** con prefijo `/api` consumida por apps móviles y paneles administrativos
- **Autenticación JWT** con control de acceso basado en roles

---

## Stack Tecnológico

| Categoría | Tecnología |
|---|---|
| Framework | NestJS 11.x (TypeScript) |
| Base de datos | PostgreSQL + Drizzle ORM 0.45 |
| Autenticación | JWT + Passport.js + bcryptjs |
| Push Notifications | OneSignal API |
| Validación | class-validator + class-transformer |
| Testing | Jest + Supertest |

---

## Tipo de Arquitectura

- **Monolito modular** — Una sola aplicación NestJS
- **Backend / API REST** — Sin frontend incluido
- **Prefijo de API:** `/api` en puerto `5000`

---

## Módulos Principales

| Módulo | Descripción |
|---|---|
| `AlertasModule` | Dominio central: CRUD, máquina de estados, asociación con zonas |
| `CategoriasModule` | Catálogo de categorías de alerta |
| `ZonasModule` | Zonas geográficas con cobertura multinivel |
| `UsuariosModule` | Usuarios finales, suscripciones y preferencias |
| `NotificacionesModule` | Envío de push notifications via OneSignal |
| `AuthModule` | Autenticación JWT, guards y decoradores |
| `DatabaseModule` | Conexión global a PostgreSQL con Drizzle ORM |

---

## Estructura del Repositorio

```
app-alertamientos/   ← Monolito NestJS
├── src/             ← Código fuente
├── test/            ← Pruebas e2e
├── postman/         ← Colección de API
├── docs/            ← Documentación del proyecto (este directorio)
└── dist/            ← Build de producción
```

---

## Primeros Pasos

1. Instalar dependencias: `npm install`
2. Configurar variables de entorno: copiar `.env.example` a `.env`
3. Aplicar el schema de BD: `npm run db:migrate`
4. Crear super administrador: `npm run db:create-superadmin`
5. Iniciar en desarrollo: `npm run start:dev`

Ver [Guía de Desarrollo](./development-guide.md) para instrucciones completas.

---

## Documentación Disponible

| Documento | Descripción |
|---|---|
| [Arquitectura](./architecture.md) | Diseño técnico, patrones y flujos |
| [Contratos de API](./api-contracts.md) | Todos los endpoints con request/response |
| [Modelos de Datos](./data-models.md) | Schema de BD, tablas y relaciones |
| [Árbol de Fuentes](./source-tree-analysis.md) | Estructura de directorios anotada |
| [Guía de Desarrollo](./development-guide.md) | Setup local, comandos y convenciones |
