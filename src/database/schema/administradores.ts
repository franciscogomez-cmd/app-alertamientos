/**
 * Schema: alertas.alt_administradores
 * Usuarios del backoffice que crean y gestionan alertas.
 */
import { boolean, integer, timestamp, varchar } from "drizzle-orm/pg-core";

import { alertasSchema } from "./schemas";

export const altAdministradores = alertasSchema.table("alt_administradores", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  nombre: varchar("nombre", { length: 120 }).notNull(),
  apellidos: varchar("apellidos", { length: 120 }).notNull(),
  email: varchar("email", { length: 254 }).notNull().unique("uq_alt_administradores_email"),
  hashPassword: varchar("hash_password", { length: 255 }).notNull(),
  rol: varchar("rol", { length: 60 }).notNull().default("editor"),
  activo: boolean("activo").notNull().default(true),

  // Auditoría
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  creadoPor: integer("creado_por").references((): any => altAdministradores.id, { onDelete: "restrict" }),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
  actualizadoPor: integer("actualizado_por").references((): any => altAdministradores.id, { onDelete: "restrict" }),
  eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  eliminadoPor: integer("eliminado_por").references((): any => altAdministradores.id, { onDelete: "restrict" }),
});

export type Administrador = typeof altAdministradores.$inferSelect;
export type NuevoAdministrador = typeof altAdministradores.$inferInsert;
