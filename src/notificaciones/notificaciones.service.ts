import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import { OnesignalService } from './onesignal.service';

type DrizzleDB = PostgresJsDatabase<typeof schema>;

/**
 * Servicio de notificaciones push para alertas.
 *
 * Flujo:
 * 1. Recibe una alerta (o actualización)
 * 2. Obtiene los usuarios con push activo y tokenPush registrado
 * 3. Envía el push via OneSignal
 * 4. Registra cada envío en alt_notificaciones_enviadas
 */
@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly onesignal: OnesignalService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // ENVIAR PUSH DE ALERTA NUEVA / ACTIVADA
  // ═══════════════════════════════════════════════════════════════════════════

  async enviarPushAlerta(alertaId: number, actualizacionId?: number) {
    // Obtener la alerta
    const [alerta] = await this.db
      .select()
      .from(schema.altAlertas)
      .where(eq(schema.altAlertas.id, alertaId));

    if (!alerta) {
      this.logger.warn(`Alerta ${alertaId} no encontrada para push.`);
      return;
    }

    // Obtener categoría para el título enriquecido
    const [categoria] = await this.db
      .select({ nombre: schema.catCategoriasAlerta.nombre })
      .from(schema.catCategoriasAlerta)
      .where(eq(schema.catCategoriasAlerta.id, alerta.categoriaId));

    // Obtener usuarios con push activo y tokenPush
    const usuarios = await this.db
      .select({
        id: schema.altUsuarios.id,
        tokenPush: schema.altUsuarios.tokenPush,
        latitud: schema.altUsuarios.latitud,
        longitud: schema.altUsuarios.longitud,
      })
      .from(schema.altUsuarios)
      .where(
        and(
          eq(schema.altUsuarios.notifActivas, true),
          isNull(schema.altUsuarios.eliminadoEn),
        ),
      );

    // Filtrar solo los que tienen tokenPush (subscription ID de OneSignal)
    const usuariosConToken = usuarios.filter((u) => u.tokenPush);

    if (usuariosConToken.length === 0) {
      this.logger.warn(`No hay usuarios con push activo para la alerta ${alertaId}.`);
      return { enviadas: 0, mensaje: 'No hay usuarios con push activo.' };
    }

    const subscriptionIds = usuariosConToken.map((u) => u.tokenPush!);

    // Construir el contenido
    const severidadEmoji: Record<string, string> = {
      emergencia: '🚨',
      preventiva: '⚠️',
      informativa: 'ℹ️',
    };
    const emoji = severidadEmoji[alerta.nivelSeveridad] ?? '📢';
    const categoriaNombre = categoria?.nombre ?? 'Alerta';

    const headings = {
      en: `${emoji} ${categoriaNombre}`,
      es: `${emoji} ${categoriaNombre}`
    };
    const contents = {
      en: alerta.titulo,
      es: alerta.titulo
    };
    const data = {
      alertaId: alerta.id,
      nivelSeveridad: alerta.nivelSeveridad,
      estatus: alerta.estatus,
      actualizacionId: actualizacionId ?? null,
    };

    // Enviar via OneSignal
    let onesignalResponse: { id: string; recipients: number };
    try {
      onesignalResponse = await this.onesignal.sendToSubscriptionIds(
        subscriptionIds,
        headings,
        contents,
        data,
        alerta.imagenUrl ?? undefined,
      );
    } catch (error) {
      this.logger.error(`Fallo al enviar push para alerta ${alertaId}: ${(error as Error).message}`);

      // Registrar fallo para cada usuario
      await this.registrarEnvios(
        alertaId,
        actualizacionId ?? null,
        usuariosConToken,
        'fallida',
        null,
        (error as Error).message,
      );

      return { enviadas: 0, error: (error as Error).message };
    }

    // Registrar éxito para cada usuario
    await this.registrarEnvios(
      alertaId,
      actualizacionId ?? null,
      usuariosConToken,
      'enviada',
      onesignalResponse.id,
      null,
    );

    // Actualizar contador de la alerta
    const recipients = onesignalResponse.recipients ?? usuariosConToken.length;
    await this.db
      .update(schema.altAlertas)
      .set({
        totalEnviadas: (alerta.totalEnviadas ?? 0) + recipients,
      })
      .where(eq(schema.altAlertas.id, alertaId));

    this.logger.log(
      `Push enviado para alerta ${alertaId}: ${recipients} destinatarios`,
    );

    return {
      enviadas: recipients,
      onesignalId: onesignalResponse.id,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENVIAR PUSH DE ACTUALIZACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async enviarPushActualizacion(alertaId: number, actualizacionId: number, mensaje: string) {
    const [alerta] = await this.db
      .select({ id: schema.altAlertas.id, titulo: schema.altAlertas.titulo })
      .from(schema.altAlertas)
      .where(eq(schema.altAlertas.id, alertaId));

    if (!alerta) return;

    // Obtener usuarios con push activo
    const usuarios = await this.db
      .select({
        id: schema.altUsuarios.id,
        tokenPush: schema.altUsuarios.tokenPush,
        latitud: schema.altUsuarios.latitud,
        longitud: schema.altUsuarios.longitud,
      })
      .from(schema.altUsuarios)
      .where(
        and(
          eq(schema.altUsuarios.notifActivas, true),
          isNull(schema.altUsuarios.eliminadoEn),
        ),
      );

    const usuariosConToken = usuarios.filter((u) => u.tokenPush);
    if (usuariosConToken.length === 0) return { enviadas: 0 };

    const subscriptionIds = usuariosConToken.map((u) => u.tokenPush!);

    try {
      const response = await this.onesignal.sendToSubscriptionIds(
        subscriptionIds,
        {
          en: `📢 Update: ${alerta.titulo}`,
          es: `📢 Actualización: ${alerta.titulo}`
        },
        {
          en: mensaje,
          es: mensaje
        },
        { alertaId, actualizacionId },
      );

      await this.registrarEnvios(
        alertaId,
        actualizacionId,
        usuariosConToken,
        'enviada',
        response.id,
        null,
      );

      const recipients = response.recipients ?? usuariosConToken.length;
      return { enviadas: recipients, onesignalId: response.id };
    } catch (error) {
      await this.registrarEnvios(
        alertaId,
        actualizacionId,
        usuariosConToken,
        'fallida',
        null,
        (error as Error).message,
      );
      return { enviadas: 0, error: (error as Error).message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REGISTRAR ENVÍOS EN BD
  // ═══════════════════════════════════════════════════════════════════════════

  private async registrarEnvios(
    alertaId: number,
    actualizacionId: number | null,
    usuarios: { id: number; tokenPush: string | null; latitud: string | null; longitud: string | null }[],
    estatus: 'pendiente' | 'enviada' | 'fallida' | 'rebotada',
    providerMessageId: string | null,
    mensajeError: string | null,
  ) {
    // Insertar en lotes de 100 para evitar queries enormes
    const batchSize = 100;
    const now = estatus === 'enviada' ? new Date() : undefined;

    for (let i = 0; i < usuarios.length; i += batchSize) {
      const batch = usuarios.slice(i, i + batchSize);

      await this.db.insert(schema.altNotificacionesEnviadas).values(
        batch.map((u) => ({
          alertaId,
          actualizacionId,
          usuarioId: u.id,
          estatusEnvio: estatus,
          providerMessageId,
          mensajeError,
          latitudEnvio: u.latitud,
          longitudEnvio: u.longitud,
          enviadaEn: now,
        })),
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSULTAR HISTORIAL DE NOTIFICACIONES DE UNA ALERTA
  // ═══════════════════════════════════════════════════════════════════════════

  async obtenerHistorialAlerta(alertaId: number) {
    return this.db
      .select()
      .from(schema.altNotificacionesEnviadas)
      .where(eq(schema.altNotificacionesEnviadas.alertaId, alertaId))
      .orderBy(schema.altNotificacionesEnviadas.creadoEn);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADÍSTICAS DE ENVÍO
  // ═══════════════════════════════════════════════════════════════════════════

  async obtenerEstadisticas(alertaId: number) {
    const registros = await this.db
      .select()
      .from(schema.altNotificacionesEnviadas)
      .where(eq(schema.altNotificacionesEnviadas.alertaId, alertaId));

    return {
      total: registros.length,
      enviadas: registros.filter((r) => r.estatusEnvio === 'enviada').length,
      fallidas: registros.filter((r) => r.estatusEnvio === 'fallida').length,
      pendientes: registros.filter((r) => r.estatusEnvio === 'pendiente').length,
      rebotadas: registros.filter((r) => r.estatusEnvio === 'rebotada').length,
      leidas: registros.filter((r) => r.leidaEn !== null).length,
    };
  }
}
