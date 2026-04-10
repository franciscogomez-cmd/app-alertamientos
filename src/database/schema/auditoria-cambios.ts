/**
 * Schema: auditoria.aud_auditoria_cambios
 * Registro inmutable de INSERT/UPDATE/DELETE lógico en tablas clave.
 */
import {
  bigint,
  char,
  inet,
  integer,
  jsonb,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { auditoriaSchema } from "./schemas";

export const audAuditoriaCambios = auditoriaSchema.table("aud_auditoria_cambios", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  tabla: varchar("tabla", { length: 100 }).notNull(),
  operacion: char("operacion", { length: 6 }).notNull(), // INSERT | UPDATE | DELETE
  registroId: bigint("registro_id", { mode: "number" }).notNull(),
  datosAnteriores: jsonb("datos_anteriores"),
  datosNuevos: jsonb("datos_nuevos"),
  camposModificados: text("campos_modificados").array(),

  // Sin FK: el log debe sobrevivir aunque se elimine el admin o usuario
  administradorId: integer("administrador_id"),
  usuarioId: bigint("usuario_id", { mode: "number" }),

  ipOrigen: inet("ip_origen"),
  requestId: varchar("request_id", { length: 100 }),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditoriaCambio = typeof audAuditoriaCambios.$inferSelect;
export type NuevaAuditoriaCambio = typeof audAuditoriaCambios.$inferInsert;
