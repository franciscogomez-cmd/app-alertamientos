/**
 * Schema: alertas.cat_zonas_geograficas
 * Catálogo de zonas reutilizables (estados, municipios, colonias, polígonos).
 */
import {
  boolean,
  char,
  decimal,
  integer,
  jsonb,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { altAdministradores } from "./administradores";
import { tipoZonaTipo } from "./enums";
import { alertasSchema } from "./schemas";

export const catZonasGeograficas = alertasSchema.table("cat_zonas_geograficas", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  nombre: varchar("nombre", { length: 200 }).notNull(),
  tipo: tipoZonaTipo("tipo").notNull(),

  // Claves geopolíticas (INEGI)
  clavePais: char("clave_pais", { length: 2 }).notNull().default("MX"),
  claveEstado: char("clave_estado", { length: 2 }),
  claveMunicipio: varchar("clave_municipio", { length: 3 }),
  codigoPostal: varchar("codigo_postal", { length: 10 }),

  // Representación geográfica — círculo centrado
  centroLatitud: decimal("centro_latitud", { precision: 10, scale: 7 }),
  centroLongitud: decimal("centro_longitud", { precision: 10, scale: 7 }),
  radioKm: decimal("radio_km", { precision: 8, scale: 3 }),

  // Polígono arbitrario en GeoJSON
  poligono: jsonb("poligono"),

  // Metadatos
  activo: boolean("activo").notNull().default(true),

  // Auditoría
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  creadoPor: integer("creado_por").references(() => altAdministradores.id, { onDelete: "restrict" }),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
  actualizadoPor: integer("actualizado_por").references(() => altAdministradores.id, { onDelete: "restrict" }),
  eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  eliminadoPor: integer("eliminado_por").references(() => altAdministradores.id, { onDelete: "restrict" }),
});

export type ZonaGeografica = typeof catZonasGeograficas.$inferSelect;
export type NuevaZonaGeografica = typeof catZonasGeograficas.$inferInsert;
