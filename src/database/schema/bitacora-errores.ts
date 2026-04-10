/**
 * Schema: auditoria.aud_bitacora_errores
 * Log centralizado de errores y eventos del sistema.
 */
import {
  bigint,
  inet,
  integer,
  jsonb,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { nivelLogTipo } from "./enums";
import { auditoriaSchema } from "./schemas";

export const audBitacoraErrores = auditoriaSchema.table("aud_bitacora_errores", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  nivel: nivelLogTipo("nivel").notNull().default("error"),
  modulo: varchar("modulo", { length: 100 }).notNull(),
  operacion: varchar("operacion", { length: 100 }),
  mensaje: text("mensaje").notNull(),
  detalle: jsonb("detalle"),
  codigoError: varchar("codigo_error", { length: 60 }),

  // Sin FK intencional: los logs deben persistir aunque se elimine el registro referenciado
  usuarioId: bigint("usuario_id", { mode: "number" }),
  administradorId: integer("administrador_id"),
  entidad: varchar("entidad", { length: 100 }),
  entidadId: bigint("entidad_id", { mode: "number" }),

  ipOrigen: inet("ip_origen"),
  requestId: varchar("request_id", { length: 100 }),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export type BitacoraError = typeof audBitacoraErrores.$inferSelect;
export type NuevaBitacoraError = typeof audBitacoraErrores.$inferInsert;
