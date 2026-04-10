/**
 * Relaciones de Drizzle ORM para habilitar el query API relacional.
 *
 * Estas relaciones NO afectan la BD; son metadatos que usa Drizzle
 * para generar JOIN automáticos con `db.query.tabla.findMany({ with: ... })`.
 */
import { relations } from "drizzle-orm";

import { altActualizacionesAlerta } from "./actualizaciones-alerta";
import { altAdministradores } from "./administradores";
import { altAlertas } from "./alertas";
import { altAlertasZonas } from "./alertas-zonas";
import { catCategoriasAlerta } from "./categorias-alerta";
import { altNotificacionesEnviadas } from "./notificaciones-enviadas";
import { altUsuarios } from "./usuarios";
import { altUsuariosZonas } from "./usuarios-zonas";
import { catZonasGeograficas } from "./zonas-geograficas";

// ─── Administradores ────────────────────────────────────────────────────────

export const administradoresRelations = relations(altAdministradores, ({ many }) => ({
  alertasCreadas: many(altAlertas),
}));

// ─── Categorías de alerta ───────────────────────────────────────────────────

export const categoriasAlertaRelations = relations(catCategoriasAlerta, ({ many }) => ({
  alertas: many(altAlertas),
}));

// ─── Zonas geográficas ─────────────────────────────────────────────────────

export const zonasGeograficasRelations = relations(catZonasGeograficas, ({ many }) => ({
  alertasZonas: many(altAlertasZonas),
  usuariosZonas: many(altUsuariosZonas),
}));

// ─── Alertas ────────────────────────────────────────────────────────────────

export const alertasRelations = relations(altAlertas, ({ one, many }) => ({
  categoria: one(catCategoriasAlerta, {
    fields: [altAlertas.categoriaId],
    references: [catCategoriasAlerta.id],
  }),
  zona: one(catZonasGeograficas, {
    fields: [altAlertas.zonaId],
    references: [catZonasGeograficas.id],
  }),
  creadoPorAdmin: one(altAdministradores, {
    fields: [altAlertas.creadoPor],
    references: [altAdministradores.id],
  }),
  alertasZonas: many(altAlertasZonas),
  actualizaciones: many(altActualizacionesAlerta),
  notificaciones: many(altNotificacionesEnviadas),
}));

// ─── Alertas ↔ Zonas (N:M) ─────────────────────────────────────────────────

export const alertasZonasRelations = relations(altAlertasZonas, ({ one }) => ({
  alerta: one(altAlertas, {
    fields: [altAlertasZonas.alertaId],
    references: [altAlertas.id],
  }),
  zona: one(catZonasGeograficas, {
    fields: [altAlertasZonas.zonaId],
    references: [catZonasGeograficas.id],
  }),
}));

// ─── Actualizaciones de alerta ──────────────────────────────────────────────

export const actualizacionesAlertaRelations = relations(altActualizacionesAlerta, ({ one }) => ({
  alerta: one(altAlertas, {
    fields: [altActualizacionesAlerta.alertaId],
    references: [altAlertas.id],
  }),
  creadoPorAdmin: one(altAdministradores, {
    fields: [altActualizacionesAlerta.creadoPor],
    references: [altAdministradores.id],
  }),
}));

// ─── Usuarios ───────────────────────────────────────────────────────────────

export const usuariosRelations = relations(altUsuarios, ({ many }) => ({
  zonaSuscripciones: many(altUsuariosZonas),
  notificaciones: many(altNotificacionesEnviadas),
}));

// ─── Usuarios ↔ Zonas (N:M) ────────────────────────────────────────────────

export const usuariosZonasRelations = relations(altUsuariosZonas, ({ one }) => ({
  usuario: one(altUsuarios, {
    fields: [altUsuariosZonas.usuarioId],
    references: [altUsuarios.id],
  }),
  zona: one(catZonasGeograficas, {
    fields: [altUsuariosZonas.zonaId],
    references: [catZonasGeograficas.id],
  }),
}));

// ─── Notificaciones enviadas ────────────────────────────────────────────────

export const notificacionesEnviadasRelations = relations(altNotificacionesEnviadas, ({ one }) => ({
  alerta: one(altAlertas, {
    fields: [altNotificacionesEnviadas.alertaId],
    references: [altAlertas.id],
  }),
  actualizacion: one(altActualizacionesAlerta, {
    fields: [altNotificacionesEnviadas.actualizacionId],
    references: [altActualizacionesAlerta.id],
  }),
  usuario: one(altUsuarios, {
    fields: [altNotificacionesEnviadas.usuarioId],
    references: [altUsuarios.id],
  }),
}));
