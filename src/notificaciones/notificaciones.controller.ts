import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificacionesService } from './notificaciones.service';
import { OnesignalService } from './onesignal.service';

@UseGuards(JwtAuthGuard)
@Controller('notificaciones')
export class NotificacionesController {
  constructor(
    private readonly notificaciones: NotificacionesService,
    private readonly onesignal: OnesignalService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // PRUEBA: Enviar push a TODOS los suscriptores de la app
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/notificaciones/test/broadcast
   * Envía un push de prueba a todos los dispositivos suscritos en OneSignal.
   *
   * Body opcional:
   *  { "titulo": "...", "mensaje": "..." }
   */
  @Post('test/broadcast')
  async testBroadcast(
    @Body() body: { titulo?: string; mensaje?: string },
  ) {
    const titulo = body.titulo ?? '🔔 Prueba de Alertamientos';
    const mensaje = body.mensaje ?? 'Esta es una notificación de prueba enviada desde el backend.';

    const result = await this.onesignal.sendToAll(
      { es: titulo, en: titulo },
      { es: mensaje, en: mensaje },
      { test: true, timestamp: new Date().toISOString() },
    );

    return {
      ok: true,
      onesignalId: result.id,
      destinatarios: result.recipients,
      mensaje: `Push de prueba enviado a ${result.recipients} dispositivo(s).`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRUEBA: Enviar push a un subscription ID específico
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/notificaciones/test/device
   * Envía un push a un dispositivo específico usando su subscription ID de OneSignal.
   *
   * Body:
   *  { "subscriptionId": "xxxxxxxx-xxxx-...", "titulo": "...", "mensaje": "..." }
   */
  @Post('test/device')
  async testDevice(
    @Body() body: { subscriptionId: string; titulo?: string; mensaje?: string },
  ) {
    if (!body.subscriptionId) {
      return { ok: false, error: 'Se requiere subscriptionId en el body.' };
    }

    const titulo = body.titulo ?? '🔔 Prueba directa';
    const mensaje = body.mensaje ?? 'Push de prueba enviado a tu dispositivo.';

    const result = await this.onesignal.sendToSubscriptionIds(
      [body.subscriptionId],
      { es: titulo, en: titulo },
      { es: mensaje, en: mensaje },
      { test: true, timestamp: new Date().toISOString() },
    );

    return {
      ok: true,
      onesignalId: result.id,
      destinatarios: result.recipients,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRUEBA: Simular envío de push de una alerta existente
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/notificaciones/test/alerta/:id
   * Dispara el flujo completo de push para una alerta (busca usuarios, envía, registra en BD).
   */
  @Post('test/alerta/:id')
  async testPushAlerta(@Param('id', ParseIntPipe) alertaId: number) {
    const result = await this.notificaciones.enviarPushAlerta(alertaId);
    return { ok: true, ...result };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HISTORIAL Y ESTADÍSTICAS
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /api/notificaciones/alerta/:id/historial */
  @Get('alerta/:id/historial')
  async historial(@Param('id', ParseIntPipe) alertaId: number) {
    return this.notificaciones.obtenerHistorialAlerta(alertaId);
  }

  /** GET /api/notificaciones/alerta/:id/estadisticas */
  @Get('alerta/:id/estadisticas')
  async estadisticas(@Param('id', ParseIntPipe) alertaId: number) {
    return this.notificaciones.obtenerEstadisticas(alertaId);
  }
}
