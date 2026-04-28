# Análisis de Árbol de Fuentes — app-alertamientos

```
app-alertamientos/                   # Raíz del proyecto NestJS
├── src/                             # Código fuente principal
│   ├── main.ts                      # [PUNTO DE ENTRADA] Bootstrap de la app (puerto 5000, prefijo /api, CORS)
│   ├── app.module.ts                # Módulo raíz — registra todos los módulos de dominio
│   ├── app.controller.ts            # Controlador raíz (healthcheck)
│   ├── app.service.ts               # Servicio raíz
│   │
│   ├── alertas/                     # [DOMINIO CENTRAL] Gestión de alertas geográficas
│   │   ├── alertas.module.ts        # Módulo de alertas
│   │   ├── alertas.controller.ts    # Endpoints REST /alertas
│   │   ├── alertas.service.ts       # Lógica de negocio: CRUD, máquina de estados, geo-restricción
│   │   └── dto/
│   │       ├── create-alerta.dto.ts       # DTO de creación con validación
│   │       ├── update-alerta.dto.ts       # DTO de actualización (PartialType)
│   │       ├── query-alertas.dto.ts       # DTO de filtros + paginación
│   │       ├── create-actualizacion.dto.ts # DTO para actualizaciones de seguimiento
│   │       └── index.ts                   # Re-exportaciones
│   │
│   ├── categorias/                  # [CATÁLOGO] Categorías de alertas
│   │   ├── categorias.module.ts
│   │   ├── categorias.controller.ts # Endpoints REST /categorias
│   │   ├── categorias.service.ts
│   │   └── dto/
│   │       ├── create-categoria.dto.ts
│   │       ├── update-categoria.dto.ts
│   │       ├── query-categorias.dto.ts
│   │       └── index.ts
│   │
│   ├── zonas/                       # [CATÁLOGO] Zonas geográficas
│   │   ├── zonas.module.ts
│   │   ├── zonas.controller.ts      # Endpoints REST /zonas
│   │   ├── zonas.service.ts
│   │   └── dto/
│   │       ├── create-zona.dto.ts
│   │       ├── update-zona.dto.ts
│   │       ├── query-zonas.dto.ts
│   │       └── index.ts
│   │
│   ├── usuarios/                    # [DOMINIO] Usuarios finales (dispositivos móviles)
│   │   ├── usuarios.module.ts
│   │   ├── usuarios.controller.ts   # Endpoints REST /usuarios (alertas, zonas, notificaciones)
│   │   ├── usuarios.service.ts      # Lógica de geo-matching para alertas de usuario
│   │   └── dto/
│   │       ├── create-usuario.dto.ts
│   │       ├── update-usuario.dto.ts
│   │       ├── update-ubicacion.dto.ts       # Actualización de ubicación GPS
│   │       ├── update-preferencias.dto.ts    # Preferencias de notificación
│   │       ├── query-usuarios.dto.ts
│   │       ├── query-notificaciones-usuario.dto.ts
│   │       └── index.ts
│   │
│   ├── notificaciones/              # [INFRAESTRUCTURA] Notificaciones push vía OneSignal
│   │   ├── notificaciones.module.ts
│   │   ├── notificaciones.controller.ts # Endpoints REST /notificaciones (prueba e historial)
│   │   ├── notificaciones.service.ts    # Orquestación: envío, historial, estadísticas
│   │   ├── onesignal.service.ts         # Cliente HTTP de OneSignal API
│   │   └── interfaces/
│   │       ├── onesignal.interfaces.ts  # Tipos de request/response de OneSignal
│   │       └── index.ts
│   │
│   ├── auth/                        # [SEGURIDAD] Autenticación y autorización JWT
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts       # Endpoints REST /auth (login, profile)
│   │   ├── auth.service.ts          # Validación de credenciales, generación de JWT
│   │   ├── index.ts                 # Re-exportaciones públicas
│   │   ├── decorators/
│   │   │   ├── current-admin.decorator.ts  # @CurrentAdmin() — extrae admin del JWT
│   │   │   └── roles.decorator.ts          # @Roles() — declara roles requeridos
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts    # Guard de autenticación JWT
│   │   │   └── roles.guard.ts       # Guard de autorización por roles
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts      # Estrategia Passport JWT
│   │   ├── interfaces/
│   │   │   └── jwt-payload.interface.ts  # Tipado del payload JWT
│   │   └── dto/
│   │       ├── login.dto.ts
│   │       └── login-response.dto.ts
│   │
│   ├── database/                    # [INFRAESTRUCTURA] Capa de acceso a datos
│   │   ├── database.module.ts       # Módulo global de BD (inyecta token DRIZZLE)
│   │   ├── database.constants.ts    # Constante DRIZZLE para inyección de dependencias
│   │   ├── index.ts
│   │   ├── schema/                  # Definiciones de schema Drizzle ORM
│   │   │   ├── schemas.ts           # Definición de schemas PG (alertas, auditoria)
│   │   │   ├── enums.ts             # Enums de PostgreSQL
│   │   │   ├── alertas.ts           # Tabla alt_alertas
│   │   │   ├── administradores.ts   # Tabla alt_administradores
│   │   │   ├── usuarios.ts          # Tabla alt_usuarios
│   │   │   ├── categorias-alerta.ts # Tabla cat_categorias_alerta
│   │   │   ├── zonas-geograficas.ts # Tabla cat_zonas_geograficas
│   │   │   ├── alertas-zonas.ts     # Tabla alt_alertas_zonas (N:M)
│   │   │   ├── actualizaciones-alerta.ts  # Tabla alt_actualizaciones_alerta
│   │   │   ├── usuarios-zonas.ts    # Tabla alt_usuarios_zonas
│   │   │   ├── notificaciones-enviadas.ts # Tabla alt_notificaciones_enviadas
│   │   │   ├── auditoria-cambios.ts # Tabla aud_auditoria_cambios
│   │   │   ├── bitacora-errores.ts  # Tabla aud_bitacora_errores
│   │   │   ├── relations.ts         # Definición de relaciones Drizzle
│   │   │   └── index.ts             # Re-exportaciones del schema
│   │   └── seed/
│   │       ├── run-sql.ts           # Ejecutor de archivos SQL semilla
│   │       └── create-superadmin.ts # Script de creación del primer superadmin
│   │
│   └── config/                      # [CONFIGURACIÓN] Variables de entorno
│       ├── env.validation.ts        # Validación de variables de entorno al inicio
│       └── index.ts
│
├── test/                            # Pruebas end-to-end
│   ├── app.e2e-spec.ts              # Spec e2e principal
│   └── jest-e2e.json                # Configuración Jest para e2e
│
├── postman/                         # Colección de API para pruebas manuales
│   └── Alertamientos-API.postman_collection.json
│
├── dist/                            # Build de producción (generado)
├── node_modules/                    # Dependencias (generado)
│
├── AlertamientosBD.sql              # Script SQL de la base de datos
├── drizzle.config.ts                # Configuración de Drizzle Kit (migraciones)
├── nest-cli.json                    # Configuración del CLI de NestJS
├── tsconfig.json                    # Configuración base de TypeScript
├── tsconfig.build.json              # Configuración de TypeScript para build
├── eslint.config.mjs                # Configuración de ESLint
├── package.json                     # Dependencias y scripts
├── .env                             # Variables de entorno locales (no en git)
├── .env.example                     # Plantilla de variables de entorno
├── CLAUDE.md                        # Instrucciones para Claude Code
└── README.md                        # README de NestJS (genérico)
```

---

## Directorios Críticos

| Directorio | Propósito |
|---|---|
| `src/alertas/` | Núcleo del dominio — lógica de alertas, máquina de estados, geo-restricción |
| `src/database/schema/` | Fuente de verdad del esquema de BD — todas las tablas y relaciones |
| `src/auth/` | Seguridad — JWT, guards, decoradores de roles |
| `src/notificaciones/` | Integración con OneSignal — push notifications |
| `src/usuarios/` | Gestión de dispositivos móviles y suscripciones geográficas |

## Puntos de Entrada

| Archivo | Descripción |
|---|---|
| `src/main.ts` | Bootstrap de la aplicación NestJS |
| `src/app.module.ts` | Módulo raíz que registra todos los módulos de dominio |
| `drizzle.config.ts` | Punto de entrada para migraciones de base de datos |
