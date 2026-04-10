/**
 * Schema: alertas.alt_actualizaciones_alerta
 * Historial de cambios de estado y mensajes adicionales por alerta.
 */
import { bigint, boolean, integer, text, timestamp } from "drizzle-orm/pg-core";

import { altAdministradores } from "./administradores";
import { altAlertas } from "./alertas";
import { estatusAlertaTipo } from "./enums";
import { alertasSchema } from "./schemas";

export const altActualizacionesAlerta = alertasSchema.table("alt_actualizaciones_alerta", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  alertaId: bigint("alerta_id", { mode: "number" })
    .notNull()
    .references(() => altAlertas.id, { onDelete: "cascade" }),
  mensaje: text("mensaje").notNull(),
  estatusAnterior: estatusAlertaTipo("estatus_anterior"),
  estatusNuevo: estatusAlertaTipo("estatus_nuevo").notNull(),
  enviarPush: boolean("enviar_push").notNull().default(false),

  // Auditoría
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  creadoPor: integer("creado_por")
    .notNull()
    .references(() => altAdministradores.id, { onDelete: "restrict" }),
  eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  eliminadoPor: integer("eliminado_por").references(() => altAdministradores.id, { onDelete: "restrict" }),
});

export type ActualizacionAlerta = typeof altActualizacionesAlerta.$inferSelect;
export type NuevaActualizacionAlerta = typeof altActualizacionesAlerta.$inferInsert;
