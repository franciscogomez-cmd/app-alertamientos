/**
 * Schema: alertas.cat_categorias_alerta
 * Tipos de alerta: meteorológica, noticias de última hora, vialidad, etc.
 */
import {
  boolean,
  char,
  integer,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { altAdministradores } from "./administradores";
import { alertasSchema } from "./schemas";

export const catCategoriasAlerta = alertasSchema.table("cat_categorias_alerta", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  nombre: varchar("nombre", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull().unique("uq_cat_categorias_slug"),
  icono: varchar("icono", { length: 120 }),
  colorHex: char("color_hex", { length: 7 }).notNull().default("#E24B4A"),
  descripcion: text("descripcion"),
  activo: boolean("activo").notNull().default(true),

  // Auditoría
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  creadoPor: integer("creado_por").references(() => altAdministradores.id, { onDelete: "restrict" }),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
  actualizadoPor: integer("actualizado_por").references(() => altAdministradores.id, { onDelete: "restrict" }),
  eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  eliminadoPor: integer("eliminado_por").references(() => altAdministradores.id, { onDelete: "restrict" }),
});

export type CategoriaAlerta = typeof catCategoriasAlerta.$inferSelect;
export type NuevaCategoriaAlerta = typeof catCategoriasAlerta.$inferInsert;
