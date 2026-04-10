/**
 * Schema: alertas.alt_usuarios_zonas
 * Suscripciones manuales del usuario a zonas adicionales (fuera de su GPS).
 */
import { bigint, boolean, integer, timestamp, unique } from "drizzle-orm/pg-core";

import { alertasSchema } from "./schemas";
import { altUsuarios } from "./usuarios";
import { catZonasGeograficas } from "./zonas-geograficas";

export const altUsuariosZonas = alertasSchema.table(
  "alt_usuarios_zonas",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    usuarioId: bigint("usuario_id", { mode: "number" })
      .notNull()
      .references(() => altUsuarios.id, { onDelete: "cascade" }),
    zonaId: integer("zona_id")
      .notNull()
      .references(() => catZonasGeograficas.id, { onDelete: "restrict" }),
    activo: boolean("activo").notNull().default(true),

    // Auditoría
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (t) => [unique("uq_alt_usuario_zona").on(t.usuarioId, t.zonaId)]
);

export type UsuarioZona = typeof altUsuariosZonas.$inferSelect;
export type NuevaUsuarioZona = typeof altUsuariosZonas.$inferInsert;
