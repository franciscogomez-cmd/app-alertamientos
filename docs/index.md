# Índice de Documentación — app-alertamientos

> Generado el: 2026-04-28  
> Tipo de escaneo: Rápido (Quick Scan)  
> Modo: initial_scan

---

## Visión General del Proyecto

- **Tipo:** Monolito backend
- **Lenguaje principal:** TypeScript
- **Arquitectura:** API REST modular (NestJS)
- **Punto de entrada:** `src/main.ts` → `http://localhost:5000/api`

---

## Referencia Rápida

| Atributo | Valor |
|---|---|
| Framework | NestJS 11.x |
| Base de datos | PostgreSQL + Drizzle ORM 0.45 |
| Autenticación | JWT (Passport.js) |
| Push Notifications | OneSignal |
| Puerto | 5000 |
| Prefijo API | `/api` |

---

## Documentación Generada

- [Visión General del Proyecto](./project-overview.md)
- [Arquitectura](./architecture.md)
- [Árbol de Fuentes](./source-tree-analysis.md)
- [Contratos de API](./api-contracts.md)
- [Modelos de Datos](./data-models.md)
- [Guía de Desarrollo](./development-guide.md)

---

## Documentación Existente

- [README.md](../README.md) — README por defecto de NestJS
- [CLAUDE.md](../CLAUDE.md) — Instrucciones y contexto para Claude Code
- [Colección Postman](../postman/Alertamientos-API.postman_collection.json) — Pruebas de API

---

## Primeros Pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar entorno
cp .env.example .env
# Editar .env con DATABASE_URL y JWT_SECRET

# 3. Aplicar schema de BD
npm run db:migrate

# 4. Crear super administrador inicial
npm run db:create-superadmin

# 5. Iniciar en desarrollo
npm run start:dev
```

La API estará disponible en: `http://localhost:5000/api`

---

## Módulos Principales

| Módulo | Ruta API | Descripción |
|---|---|---|
| Auth | `/api/auth` | Login y perfil de administradores |
| Alertas | `/api/alertas` | CRUD y máquina de estados de alertas |
| Categorías | `/api/categorias` | Catálogo de categorías |
| Zonas | `/api/zonas` | Zonas geográficas multinivel |
| Usuarios | `/api/usuarios` | Usuarios finales y suscripciones |
| Notificaciones | `/api/notificaciones` | Historial y estadísticas push |
