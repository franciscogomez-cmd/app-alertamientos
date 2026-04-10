/**
 * Enums de PostgreSQL definidos en el schema "alertas".
 *
 * Cada enum mapea directamente al tipo creado en AlertamientosBD.sql.
 */
import { alertasSchema } from "./schemas";

/** Nivel de severidad de una alerta */
export const nivelSeveridadTipo = alertasSchema.enum("nivel_severidad_tipo", [
  "preventiva",
  "emergencia",
  "informativa",
]);

/** Estatus del ciclo de vida de una alerta */
export const estatusAlertaTipo = alertasSchema.enum("estatus_alerta_tipo", [
  "borrador",
  "activa",
  "desactivada",
  "expirada",
  "cancelada",
]);

/** Granularidad de cobertura geográfica */
export const nivelCoberturaTipo = alertasSchema.enum("nivel_cobertura_tipo", [
  "pais",
  "estado",
  "municipio",
  "colonia",
  "codigo_postal",
  "zona_personalizada",
]);

/** Tipo de zona geográfica */
export const tipoZonaTipo = alertasSchema.enum("tipo_zona_tipo", [
  "pais",
  "estado",
  "municipio",
  "colonia",
  "codigo_postal",
  "poligono_custom",
]);

/** Plataforma del dispositivo móvil */
export const plataformaTipo = alertasSchema.enum("plataforma_tipo", [
  "android",
  "ios",
  "huawei",
]);

/** Estatus de envío de una notificación push */
export const estatusEnvioTipo = alertasSchema.enum("estatus_envio_tipo", [
  "pendiente",
  "enviada",
  "fallida",
  "rebotada",
]);

/** Nivel de severidad para logs del sistema */
export const nivelLogTipo = alertasSchema.enum("nivel_log_tipo", [
  "debug",
  "info",
  "warning",
  "error",
  "critical",
]);
