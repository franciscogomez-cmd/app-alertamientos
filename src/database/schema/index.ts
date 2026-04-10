/**
 * Barrel export de todos los schemas, enums y relaciones.
 *
 * Importar desde `src/database/schema` para acceder a cualquier tabla, tipo o relación.
 */

// Schemas de PostgreSQL
export { alertasSchema, auditoriaSchema } from "./schemas";

// Enums
export {
  estatusAlertaTipo,
  estatusEnvioTipo,
  nivelCoberturaTipo,
  nivelLogTipo,
  nivelSeveridadTipo,
  plataformaTipo,
  tipoZonaTipo,
} from "./enums";

// Tablas — schema alertas
export { altAdministradores } from "./administradores";
export type { Administrador, NuevoAdministrador } from "./administradores";

export { catZonasGeograficas } from "./zonas-geograficas";
export type { NuevaZonaGeografica, ZonaGeografica } from "./zonas-geograficas";

export { catCategoriasAlerta } from "./categorias-alerta";
export type { CategoriaAlerta, NuevaCategoriaAlerta } from "./categorias-alerta";

export { altAlertas } from "./alertas";
export type { Alerta, NuevaAlerta } from "./alertas";

export { altAlertasZonas } from "./alertas-zonas";
export type { AlertaZona, NuevaAlertaZona } from "./alertas-zonas";

export { altActualizacionesAlerta } from "./actualizaciones-alerta";
export type { ActualizacionAlerta, NuevaActualizacionAlerta } from "./actualizaciones-alerta";

export { altUsuarios } from "./usuarios";
export type { NuevoUsuario, Usuario } from "./usuarios";

export { altUsuariosZonas } from "./usuarios-zonas";
export type { NuevaUsuarioZona, UsuarioZona } from "./usuarios-zonas";

export { altNotificacionesEnviadas } from "./notificaciones-enviadas";
export type { NotificacionEnviada, NuevaNotificacionEnviada } from "./notificaciones-enviadas";

// Tablas — schema auditoria
export { audBitacoraErrores } from "./bitacora-errores";
export type { BitacoraError, NuevaBitacoraError } from "./bitacora-errores";

export { audAuditoriaCambios } from "./auditoria-cambios";
export type { AuditoriaCambio, NuevaAuditoriaCambio } from "./auditoria-cambios";

// Relaciones (Drizzle Relational Query API)
export {
  actualizacionesAlertaRelations,
  administradoresRelations,
  alertasRelations,
  alertasZonasRelations,
  categoriasAlertaRelations,
  notificacionesEnviadasRelations,
  usuariosRelations,
  usuariosZonasRelations,
  zonasGeograficasRelations,
} from "./relations";
