import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OneSignalFilter,
  OneSignalNotificationPayload,
  OneSignalNotificationResponse,
} from './interfaces';

/**
 * Servicio wrapper para la API REST de OneSignal.
 * Usa fetch nativo (Node 18+) — sin dependencias externas.
 */
@Injectable()
export class OnesignalService {
  private readonly logger = new Logger(OnesignalService.name);
  private readonly appId: string;
  private readonly restApiKey: string;
  private readonly baseUrl = 'https://onesignal.com/api/v1';

  constructor(private readonly config: ConfigService) {
    this.appId = this.config.getOrThrow<string>('ONESIGNAL_APP_ID');
    this.restApiKey = this.config.getOrThrow<string>('ONESIGNAL_REST_API_KEY');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENVIAR NOTIFICACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async sendNotification(
    payload: OneSignalNotificationPayload,
  ): Promise<OneSignalNotificationResponse> {
    const body = {
      app_id: this.appId,
      ...payload,
    };

    this.logger.log(
      `Enviando push: "${payload.headings?.es ?? payload.headings?.en ?? 'Sin título'}" → ${
        payload.include_subscription_ids?.length ?? payload.included_segments?.join(', ') ?? 'filtros'
      }`,
    );

    try {
      const response = await fetch(`${this.baseUrl}/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Basic ${this.restApiKey}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        this.logger.error(`OneSignal error ${response.status}: ${JSON.stringify(data)}`);
        throw new Error(`OneSignal API error: ${JSON.stringify(data.errors ?? data)}`);
      }

      this.logger.log(`Push enviado OK — id: ${data.id}, recipients: ${data.recipients}`);
      return data as OneSignalNotificationResponse;
    } catch (error) {
      this.logger.error(`Error al enviar push: ${(error as Error).message}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENVIAR A TODOS LOS SUSCRIPTORES
  // ═══════════════════════════════════════════════════════════════════════════

  async sendToAll(
    headings: Record<string, string>,
    contents: Record<string, string>,
    data?: Record<string, any>,
    bigPicture?: string,
  ): Promise<OneSignalNotificationResponse> {
    return this.sendNotification({
      included_segments: ['Subscribed Users'],
      headings,
      contents,
      data,
      big_picture: bigPicture,
      ...(bigPicture ? { ios_attachments: { image: bigPicture } } : {}),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENVIAR A SUBSCRIPTION IDS ESPECÍFICOS
  // ═══════════════════════════════════════════════════════════════════════════

  async sendToSubscriptionIds(
    subscriptionIds: string[],
    headings: Record<string, string>,
    contents: Record<string, string>,
    data?: Record<string, any>,
    bigPicture?: string,
  ): Promise<OneSignalNotificationResponse> {
    if (subscriptionIds.length === 0) {
      this.logger.warn('No hay subscription IDs para enviar push.');
      return { id: '', recipients: 0 };
    }

    return this.sendNotification({
      include_subscription_ids: subscriptionIds,
      headings,
      contents,
      data,
      big_picture: bigPicture,
      ...(bigPicture ? { ios_attachments: { image: bigPicture } } : {}),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSULTAR ESTADO DE UNA NOTIFICACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async getNotificationStatus(notificationId: string): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/notifications/${notificationId}?app_id=${this.appId}`,
      {
        headers: { Authorization: `Basic ${this.restApiKey}` },
      },
    );

    return response.json();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GESTIÓN DE DISPOSITIVOS / TAGS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Actualiza los tags de un dispositivo (player/subscription) en OneSignal.
   * Los tags permiten segmentar usuarios para envíos dirigidos.
   *
   * @param subscriptionId El subscription ID (tokenPush) del dispositivo
   * @param tags Objeto clave-valor. Enviar valor "" (vacío) para eliminar un tag.
   */
  async updateDeviceTags(
    subscriptionId: string,
    tags: Record<string, string | number | boolean>,
  ): Promise<{ success: boolean }> {
    this.logger.log(
      `Actualizando tags de ${subscriptionId}: ${JSON.stringify(tags)}`,
    );

    try {
      const response = await fetch(
        `${this.baseUrl}/players/${subscriptionId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: `Basic ${this.restApiKey}`,
          },
          body: JSON.stringify({
            app_id: this.appId,
            tags,
          }),
        },
      );

      const data = await response.json();

      this.logger.debug(`[updateDeviceTags] HTTP ${response.status} | Response: ${JSON.stringify(data)}`);

      if (!response.ok) {
        this.logger.error(
          `Error actualizando tags: ${response.status} — ${JSON.stringify(data)}`,
        );
        return { success: false };
      }

      this.logger.log(`Tags actualizados OK para ${subscriptionId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Error actualizando tags: ${(error as Error).message}`,
      );
      return { success: false };
    }
  }

  /**
   * Obtiene info de un dispositivo de OneSignal (player).
   */
  async getDevice(subscriptionId: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/players/${subscriptionId}?app_id=${this.appId}`,
        {
          headers: { Authorization: `Basic ${this.restApiKey}` },
        },
      );

      if (!response.ok) {
        this.logger.warn(`Dispositivo ${subscriptionId} no encontrado en OneSignal.`);
        return null;
      }

      return response.json();
    } catch (error) {
      this.logger.error(`Error consultando dispositivo: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Verifica si un subscription ID es válido en OneSignal.
   */
  async isValidSubscription(subscriptionId: string): Promise<boolean> {
    const device = await this.getDevice(subscriptionId);
    return device !== null && device.id === subscriptionId;
  }

  /**
   * Envía notificación usando filtros por tags de OneSignal.
   * Permite targeting sin necesidad de listar subscription IDs.
   */
  async sendWithTagFilters(
    filters: OneSignalFilter[],
    headings: Record<string, string>,
    contents: Record<string, string>,
    data?: Record<string, any>,
    bigPicture?: string,
  ): Promise<OneSignalNotificationResponse> {
    return this.sendNotification({
      filters,
      headings,
      contents,
      data,
      big_picture: bigPicture,
      ...(bigPicture ? { ios_attachments: { image: bigPicture } } : {}),
    });
  }
}
