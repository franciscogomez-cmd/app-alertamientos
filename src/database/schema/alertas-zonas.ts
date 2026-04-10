/**
 * Schema: alertas.alt_alertas_zonas
 * Relación N:M entre alertas y zonas geográficas afectadas.
 */
import { bigint, integer, timestamp, unique } from "drizzle-orm/pg-core";

import { altAdministradores } from "./administradores";
import { altAlertas } from "./alertas";
import { alertasSchema } from "./schemas";
import { catZonasGeograficas } from "./zonas-geograficas";

export const altAlertasZonas = alertasSchema.table(
  "alt_alertas_zonas",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    alertaId: bigint("alerta_id", { mode: "number" })
      .notNull()
      .references(() => altAlertas.id, { onDelete: "cascade" }),
    zonaId: integer("zona_id")
      .notNull()
      .references(() => catZonasGeograficas.id, { onDelete: "restrict" }),

    // Auditoría
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    creadoPor: integer("creado_por").references(() => altAdministradores.id, { onDelete: "restrict" }),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
    eliminadoPor: integer("eliminado_por").references(() => altAdministradores.id, { onDelete: "restrict" }),
  },
  (t) => [unique("uq_alt_alerta_zona").on(t.alertaId, t.zonaId)]
);

export type AlertaZona = typeof altAlertasZonas.$inferSelect;
export type NuevaAlertaZona = typeof altAlertasZonas.$inferInsert;
