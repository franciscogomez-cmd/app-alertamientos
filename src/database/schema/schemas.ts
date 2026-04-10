/**
 * Definición de los schemas de PostgreSQL usados en la aplicación.
 *
 * Drizzle ORM requiere declarar schemas personalizados explícitamente
 * para tablas que no viven en el schema "public".
 */
import { pgSchema } from "drizzle-orm/pg-core";

export const alertasSchema = pgSchema("alertas");
export const auditoriaSchema = pgSchema("auditoria");
