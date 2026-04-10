/**
 * Schema: alertas.alt_notificaciones_enviadas
 * Registro de cada push notification enviada a cada usuario.
 * Log inmutable: no tiene eliminado_en.
 */
import {
  bigint,
  decimal,
  smallint,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { altActualizacionesAlerta } from "./actualizaciones-alerta";
import { altAlertas } from "./alertas";
import { estatusEnvioTipo } from "./enums";
import { alertasSchema } from "./schemas";
import { altUsuarios } from "./usuarios";

export const altNotificacionesEnviadas = alertasSchema.table("alt_notificaciones_enviadas", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  alertaId: bigint("alerta_id", { mode: "number" })
    .notNull()
    .references(() => altAlertas.id, { onDelete: "cascade" }),
  actualizacionId: bigint("actualizacion_id", { mode: "number" }).references(
    () => altActualizacionesAlerta.id,
    { onDelete: "set null" }
  ),
  usuarioId: bigint("usuario_id", { mode: "number" })
    .notNull()
    .references(() => altUsuarios.id, { onDelete: "cascade" }),

  estatusEnvio: estatusEnvioTipo("estatus_envio").notNull().default("pendiente"),
  intentoNumero: smallint("intento_numero").notNull().default(1),
  mensajeError: text("mensaje_error"),
  providerMessageId: varchar("provider_message_id", { length: 300 }),

  // Snapshot de coordenadas al momento del envío
  latitudEnvio: decimal("latitud_envio", { precision: 10, scale: 7 }),
  longitudEnvio: decimal("longitud_envio", { precision: 10, scale: 7 }),

  enviadaEn: timestamp("enviada_en", { withTimezone: true }),
  leidaEn: timestamp("leida_en", { withTimezone: true }),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export type NotificacionEnviada = typeof altNotificacionesEnviadas.$inferSelect;
export type NuevaNotificacionEnviada = typeof altNotificacionesEnviadas.$inferInsert;
