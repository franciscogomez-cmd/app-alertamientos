# CLAUDE.md

Este archivo proporciona orientación a Claude Code (claude.ai/code) cuando trabaja con código en este repositorio.

## Descripción del Proyecto

Este es un sistema de gestión de alertas basado en NestJS ("app-alertamientos") para administrar alertas geográficas con cobertura multinivel, categorías, zonas y notificaciones push. La aplicación utiliza PostgreSQL con Drizzle ORM y autenticación JWT.

## Comandos

### Desarrollo
```bash
npm run start:dev          # Ejecutar en modo watch
npm run start:debug        # Ejecutar con debugger
npm run build              # Compilar para producción
npm run start:prod         # Ejecutar build de producción
```

### Base de Datos
```bash
npm run db:generate        # Generar migraciones desde el schema
npm run db:migrate         # Ejecutar migraciones
npm run db:push            # Empujar schema a la base de datos
npm run db:studio          # Abrir interfaz gráfica de Drizzle Studio
npm run db:check           # Verificar consistencia del schema
npm run db:seed            # Ejecutar archivos de semilla SQL
npm run db:create-superadmin  # Crear usuario super administrador
```

### Pruebas y Calidad
```bash
npm run test               # Ejecutar pruebas unitarias
npm run test:watch         # Ejecutar pruebas en modo watch
npm run test:e2e           # Ejecutar pruebas end-to-end
npm run test:cov           # Generar cobertura de pruebas
npm run lint               # Ejecutar ESLint con auto-fix
npm run format             # Formatear código con Prettier
```

## Arquitectura

### Organización del Schema de Base de Datos

La base de datos utiliza **dos schemas de PostgreSQL** (no tablas, sino schemas reales de PG):

1. **Schema `alertas`**: Contiene todas las tablas de lógica de negocio central
   - `alt_alertas` - Tabla principal de alertas
   - `alt_administradores` - Usuarios administradores
   - `alt_usuarios` - Usuarios finales
   - `cat_categorias_alerta` - Catálogo de categorías de alerta
   - `cat_zonas_geograficas` - Catálogo de zonas geográficas
   - `alt_alertas_zonas` - Relación N:M entre alertas y zonas
   - `alt_actualizaciones_alerta` - Historial de actualizaciones de alertas
   - `alt_usuarios_zonas` - Suscripciones de usuarios a zonas
   - `alt_notificaciones_enviadas` - Registro de notificaciones push

2. **Schema `auditoria`**: Contiene tablas de auditoría/logging
   - `aud_bitacora_errores` - Registro de errores
   - `aud_auditoria_cambios` - Rastro de auditoría de cambios

**Importante**: Todas las definiciones de schema están en `src/database/schema/`. Al trabajar con Drizzle, importar desde `src/database/schema` para acceder a tablas, enums y relaciones.

### Patrones Arquitectónicos Clave

#### Patrón de Acceso a Base de Datos
- **Inyección de base de datos**: Todos los servicios usan `@Inject(DRIZZLE)` para acceder a la base de datos
- **Consultas type-safe**: Drizzle proporciona tipos completos de TypeScript para todas las consultas
- **Schema-aware**: Las tablas se definen con prefijos de schema explícitos (ej., `alertasSchema.table()`)
- **Soft deletes**: Todas las tablas usan el patrón `eliminadoEn` / `eliminadoPor` para eliminación suave

Ejemplo:
```typescript
constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}
```

#### Restricción de Referencia Geográfica
Las alertas DEBEN tener al menos una referencia geográfica:
- `zonaId` (referencia a una zona predefinida), O
- `centroLatitud` + `centroLongitud` (basado en coordenadas), O
- `poligonoZona` (polígono GeoJSON personalizado)

Esta restricción se valida en `alertas.service.ts:33-41`.

#### Máquina de Estados de Alertas
Las alertas siguen una máquina de estados estricta definida en `alertas.service.ts:360-373`:
- `borrador` → `activa`, `cancelada`
- `activa` → `desactivada`, `expirada`, `cancelada`
- `desactivada` → `activa`, `cancelada`
- `expirada` → (estado terminal)
- `cancelada` → (estado terminal)

#### Autenticación y Autorización
- Autenticación basada en JWT usando estrategias de Passport
- Control de acceso basado en roles mediante decoradores personalizados:
  - `@CurrentAdmin()` - Extrae el admin del payload JWT
  - `@Roles()` - Declara los roles requeridos para endpoints
- Guards: `JwtAuthGuard` (autenticación), `RolesGuard` (autorización)

### Organización de Módulos

Cada módulo de dominio sigue las convenciones de NestJS:
- `*.module.ts` - Definición del módulo
- `*.controller.ts` - Endpoints HTTP
- `*.service.ts` - Lógica de negocio
- `dto/` - Objetos de transferencia de datos con validación
  - `create-*.dto.ts` - DTOs de creación
  - `update-*.dto.ts` - DTOs de actualización (usa PartialType)
  - `query-*.dto.ts` - DTOs de consulta/filtros con paginación

Módulos de dominio: `AlertasModule`, `CategoriasModule`, `ZonasModule`, `AuthModule`

### Configuración de Entorno

Variables de entorno requeridas (validadas al iniciar en `src/config/env.validation.ts`):
- `DATABASE_URL` (requerida) - Cadena de conexión PostgreSQL
- `JWT_SECRET` (requerida) - Secreto para firmar JWT
- `JWT_EXPIRES_IN` (opcional, default: 86400) - Expiración JWT en segundos
- `PORT` (opcional, default: 5000) - Puerto del servidor

La aplicación carga `.env.local` primero, luego recurre a `.env`.

### Configuración Global

Configurado en `src/main.ts`:
- **Prefijo API**: Todas las rutas tienen prefijo `/api`
- **Pipe de validación global**: Habilita class-validator con whitelist, transformación y conversión implícita
- **CORS**: Habilitado para todos los orígenes (configuración de desarrollo)

### Patrón de Paginación y Filtrado

Todos los endpoints de listado siguen este patrón (ver `alertas.service.ts:134-198`):
```typescript
{
  data: Array<T>,           // Resultados para la página actual
  meta: {
    total: number,          // Conteo total
    page: number,           // Página actual
    limit: number,          // Items por página
    totalPages: number      // Total de páginas calculado
  }
}
```

Los DTOs de consulta soportan:
- `page` (default: 1)
- `limit` (default: 20)
- Filtros específicos del dominio (estatus, nivelSeveridad, categoriaId, busqueda, etc.)

### Patrones Comunes

#### Gestión de Relaciones N:M
Al actualizar relaciones N:M (ej., zonas de alerta):
1. Soft-delete de todas las asociaciones existentes
2. Insertar nuevas asociaciones
Ver `alertas.service.ts:307-329` para implementación de referencia.

#### Patrón de Soft Delete
Nunca usar `DELETE`. En su lugar:
```typescript
.update(table)
.set({ eliminadoEn: new Date(), eliminadoPor: adminId })
.where(eq(table.id, id))
```

Siempre filtrar registros eliminados:
```typescript
.where(and(...conditions, isNull(table.eliminadoEn)))
```

#### Carga Relacional con Drizzle
El schema define relaciones en `src/database/schema/relations.ts`. Al cargar datos relacionados, ya sea:
- Usar joins manuales en las consultas (patrón actual)
- O usar la API de consultas relacionales de Drizzle con las relaciones exportadas

## Pruebas

- Las pruebas unitarias usan Jest con transformador `ts-jest`
- Las pruebas E2E usan Supertest
- Los archivos de prueba siguen la convención de nomenclatura `*.spec.ts`
- Configuración de pruebas en `package.json` y `test/jest-e2e.json`

## Colección de API

Una colección de Postman está disponible en `postman/Alertamientos-API.postman_collection.json` para pruebas de API.

## Semilla de Base de Datos

Dos scripts de semilla están disponibles:
- `src/database/seed/run-sql.ts` - Ejecutor genérico de SQL
- `src/database/seed/create-superadmin.ts` - Crea el usuario super administrador inicial
