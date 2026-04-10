/**
 * Schema: alertas.alt_alertas
 * Registro principal de cada alerta emitida.
 */
import {
  bigint,
  boolean,
  decimal,
  integer,
  jsonb,
  timestamp,
  text,
  varchar,
} from "drizzle-orm/pg-core";

import { altAdministradores } from "./administradores";
import { catCategoriasAlerta } from "./categorias-alerta";
import { estatusAlertaTipo, nivelCoberturaTipo, nivelSeveridadTipo } from "./enums";
import { alertasSchema } from "./schemas";
import { catZonasGeograficas } from "./zonas-geograficas";

export const altAlertas = alertasSchema.table("alt_alertas", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  categoriaId: integer("categoria_id")
    .notNull()
    .references(() => catCategoriasAlerta.id, { onDelete: "restrict" }),

  titulo: varchar("titulo", { length: 200 }).notNull(),
  descripcion: text("descripcion").notNull(),
  nivelSeveridad: nivelSeveridadTipo("nivel_severidad").notNull(),
  estatus: estatusAlertaTipo("estatus").notNull().default("borrador"),

  // Vigencia
  fechaInicio: timestamp("fecha_inicio", { withTimezone: true }).notNull().defaultNow(),
  fechaFin: timestamp("fecha_fin", { withTimezone: true }),

  // Cobertura geográfica
  nivelCobertura: nivelCoberturaTipo("nivel_cobertura").notNull(),
  zonaId: integer("zona_id").references(() => catZonasGeograficas.id, { onDelete: "restrict" }),

  // Zona ad-hoc
  centroLatitud: decimal("centro_latitud", { precision: 10, scale: 7 }),
  centroLongitud: decimal("centro_longitud", { precision: 10, scale: 7 }),
  radioKm: decimal("radio_km", { precision: 8, scale: 3 }),
  poligonoZona: jsonb("poligono_zona"),

  // Acciones sugeridas al usuario
  acciones: jsonb("acciones"),

  // Metadata
  imagenUrl: varchar("imagen_url", { length: 500 }),
  mapaVisible: boolean("mapa_visible").notNull().default(true),
  totalEnviadas: integer("total_enviadas").notNull().default(0),

  // Auditoría
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  creadoPor: integer("creado_por")
    .notNull()
    .references(() => altAdministradores.id, { onDelete: "restrict" }),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
  actualizadoPor: integer("actualizado_por").references(() => altAdministradores.id, { onDelete: "restrict" }),
  eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  eliminadoPor: integer("eliminado_por").references(() => altAdministradores.id, { onDelete: "restrict" }),
});

export type Alerta = typeof altAlertas.$inferSelect;
export type NuevaAlerta = typeof altAlertas.$inferInsert;
