/**
 * Schema: alertas.alt_usuarios
 * Dispositivos móviles registrados en la app.
 */
import {
  bigint,
  boolean,
  decimal,
  index,
  time,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { nivelSeveridadTipo, plataformaTipo } from "./enums";
import { alertasSchema } from "./schemas";

export const altUsuarios = alertasSchema.table("alt_usuarios", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),

  // Identificadores del dispositivo
  imei: varchar("imei", { length: 20 }),
  deviceId: varchar("device_id", { length: 200 }).notNull().unique("uq_alt_usuarios_device_id"),
  tokenPush: varchar("token_push", { length: 500 }),
  plataforma: plataformaTipo("plataforma").notNull(),
  versionApp: varchar("version_app", { length: 20 }),
  modeloDispositivo: varchar("modelo_dispositivo", { length: 100 }),
  sistemaOperativo: varchar("sistema_operativo", { length: 60 }),

  // Ubicación actual del dispositivo
  latitud: decimal("latitud", { precision: 10, scale: 7 }),
  longitud: decimal("longitud", { precision: 10, scale: 7 }),
  precisionMetros: decimal("precision_metros", { precision: 8, scale: 2 }),
  ubicacionActualizadaEn: timestamp("ubicacion_actualizada_en", { withTimezone: true }),

  // Preferencia de zona cuando GPS está desactivado
  codigoPostal: varchar("codigo_postal", { length: 10 }),

  // Preferencias de notificación
  notifActivas: boolean("notif_activas").notNull().default(false),
  gpsActivo: boolean("gps_activo").notNull().default(false),
  notifMeteorologicas: boolean("notif_meteorologicas").notNull().default(true),
  notifUltimaHora: boolean("notif_ultima_hora").notNull().default(true),
  notifVialidad: boolean("notif_vialidad").notNull().default(true),
  notifServicios: boolean("notif_servicios").notNull().default(true),

  // Horario silencioso
  silencioInicio: time("silencio_inicio"),
  silencioFin: time("silencio_fin"),

  // Severidad mínima
  severidadMinima: nivelSeveridadTipo("severidad_minima").notNull().default("informativa"),

  // Auditoría
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
  eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
}, (t) => [
  index("idx_alt_usuarios_codigo_postal").on(t.codigoPostal),
]);

export type Usuario = typeof altUsuarios.$inferSelect;
export type NuevoUsuario = typeof altUsuarios.$inferInsert;
