# Guía de Desarrollo — app-alertamientos

## Requisitos Previos

| Herramienta | Versión Mínima | Notas |
|---|---|---|
| Node.js | 18.x+ | Recomendado: 20.x LTS |
| npm | 9.x+ | Incluido con Node.js |
| PostgreSQL | 14+ | Base de datos principal |

---

## Configuración del Entorno

### 1. Clonar e instalar dependencias

```bash
git clone <repo-url>
cd app-alertamientos
npm install
```

### 2. Configurar variables de entorno

Copiar la plantilla y completar los valores:

```bash
cp .env.example .env
```

Variables requeridas en `.env`:

```env
# Base de datos
DATABASE_URL=postgresql://usuario:password@localhost:5432/alertamientos

# JWT
JWT_SECRET=tu_secreto_jwt_muy_seguro
JWT_EXPIRES_IN=86400          # Segundos (default: 86400 = 24h)

# Servidor
PORT=5000                     # Puerto de la API (default: 5000)

# OneSignal (para notificaciones push)
ONESIGNAL_APP_ID=tu_app_id
ONESIGNAL_API_KEY=tu_api_key
```

> La app carga `.env.local` primero y luego recurre a `.env`.

### 3. Configurar la base de datos

```bash
# Crear las tablas (aplicar migraciones)
npm run db:migrate

# O empujar el schema directamente (desarrollo)
npm run db:push

# Poblar con datos iniciales (opcional)
npm run db:seed

# Crear el primer super administrador
npm run db:create-superadmin
```

---

## Comandos de Desarrollo

```bash
# Iniciar en modo watch (recarga automática)
npm run start:dev

# Iniciar con debugger
npm run start:debug

# Compilar para producción
npm run build

# Ejecutar build de producción
npm run start:prod
```

La API estará disponible en: `http://localhost:5000/api`

---

## Comandos de Base de Datos

```bash
# Generar migraciones desde cambios en el schema
npm run db:generate

# Aplicar migraciones pendientes
npm run db:migrate

# Empujar schema (sin migraciones, solo desarrollo)
npm run db:push

# Abrir interfaz visual de Drizzle Studio
npm run db:studio

# Verificar consistencia del schema
npm run db:check

# Ejecutar scripts SQL de semilla
npm run db:seed

# Crear super administrador inicial
npm run db:create-superadmin
```

---

## Pruebas

```bash
# Pruebas unitarias
npm run test

# Pruebas unitarias en modo watch
npm run test:watch

# Pruebas end-to-end
npm run test:e2e

# Cobertura de pruebas
npm run test:cov
```

Los archivos de prueba siguen el patrón `*.spec.ts` y están ubicados junto al código que prueban.

---

## Calidad de Código

```bash
# Ejecutar ESLint con auto-fix
npm run lint

# Formatear con Prettier
npm run format
```

---

## Flujo de Trabajo con el Schema de BD

Al modificar tablas o agregar nuevas:

1. Editar o crear el archivo de schema en `src/database/schema/`
2. Si se agregan relaciones, actualizar `src/database/schema/relations.ts`
3. Asegurarse de exportar desde `src/database/schema/index.ts`
4. Generar la migración: `npm run db:generate`
5. Aplicar la migración: `npm run db:migrate`

---

## Pruebas con Postman

La colección de Postman está en:
```
postman/Alertamientos-API.postman_collection.json
```

Importarla en Postman y configurar la variable de entorno `base_url` apuntando a `http://localhost:5000/api`.

---

## Convenciones de Código

### Organización de Módulos

Cada módulo de dominio sigue la estructura:
```
modulo/
├── modulo.module.ts         # Definición del módulo
├── modulo.controller.ts     # Endpoints HTTP
├── modulo.service.ts        # Lógica de negocio
└── dto/
    ├── create-modulo.dto.ts  # DTO de creación
    ├── update-modulo.dto.ts  # DTO de actualización (PartialType)
    ├── query-modulo.dto.ts   # DTO de filtros con paginación
    └── index.ts              # Re-exportaciones
```

### Acceso a la Base de Datos

```typescript
// Inyectar la base de datos en servicios
constructor(
  @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>
) {}
```

### Soft Delete

```typescript
// NUNCA usar DELETE físico
// SIEMPRE usar soft-delete:
await this.db
  .update(tabla)
  .set({ eliminadoEn: new Date(), eliminadoPor: adminId })
  .where(eq(tabla.id, id));

// SIEMPRE filtrar eliminados en las consultas:
.where(and(...condiciones, isNull(tabla.eliminadoEn)))
```

### Respuesta de Paginación

```typescript
return {
  data: resultados,
  meta: {
    total: conteoTotal,
    page: pagina,
    limit: limite,
    totalPages: Math.ceil(conteoTotal / limite)
  }
};
```

---

## Variables de Entorno Validadas al Inicio

La aplicación valida las variables de entorno al arrancar (`src/config/env.validation.ts`). Si falta `DATABASE_URL` o `JWT_SECRET`, la app **no inicia**.

| Variable | Requerida | Default |
|---|---|---|
| `DATABASE_URL` | Sí | — |
| `JWT_SECRET` | Sí | — |
| `JWT_EXPIRES_IN` | No | `86400` |
| `PORT` | No | `5000` |
