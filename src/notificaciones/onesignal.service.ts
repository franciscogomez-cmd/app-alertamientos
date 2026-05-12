import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OneSignalFilter,
  OneSignalNotificationPayload,
  OneSignalNotificationResponse,
} from './interfaces';

/**
 * Servicio wrapper para la API REST de OneSignal (User Model / SDK v5+).
 * Usa fetch nativo (Node 18+) — sin dependencias externas.
 */
@Injectable()
export class OnesignalService {
  private readonly logger = new Logger(OnesignalService.name);
  private readonly appId: string;
  private readonly restApiKey: string;
  private readonly baseUrl = 'https://api.onesignal.com';

  constructor(private readonly config: ConfigService) {
    this.appId = this.config.getOrThrow<string>('ONESIGNAL_APP_ID');
    this.restApiKey = this.config.getOrThrow<string>('ONESIGNAL_REST_API_KEY');
  }

  private get authHeader(): string {
    return `Key ${this.restApiKey}`;
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
          Authorization: this.authHeader,
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
        headers: { Authorization: this.authHeader },
      },
    );

    return response.json();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GESTIÓN DE DISPOSITIVOS / TAGS  (User Model API)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Actualiza los tags de un usuario en OneSignal usando el User Model API.
   * Compatible con SDK v5+ (react-native-onesignal v5.x).
   *
   * @param subscriptionId El subscription ID (UUID) del dispositivo
   * @param tags Objeto clave-valor. Enviar valor "" (vacío) para eliminar un tag.
   */
  async updateDeviceTags(
    subscriptionId: string,
    tags: Record<string, string | number | boolean>,
  ): Promise<{ success: boolean }> {
    this.logger.log(
      `Actualizando tags de ${subscriptionId}: ${JSON.stringify(tags)}`,
    );

    const response = await fetch(
      `${this.baseUrl}/apps/${this.appId}/users/by/subscriptions/${subscriptionId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: this.authHeader,
        },
        body: JSON.stringify({
          properties: { tags },
        }),
      },
    );

    const data = await response.json();
    this.logger.debug(`[updateDeviceTags] HTTP ${response.status} | Response: ${JSON.stringify(data)}`);

    if (response.ok) {
      this.logger.log(`Tags actualizados OK para ${subscriptionId}`);
      return { success: true };
    }

    // 404 = suscripción eliminada / token muerto → marcar como inválido
    if (response.status === 404) {
      this.logger.warn(`Suscripción ${subscriptionId} no encontrada en OneSignal (404).`);
      return { success: false };
    }

    // Cualquier otro error (5xx, red, etc.) → lanzar para que syncTagsToOneSignal
    // lo maneje en su .catch() sin tocar tokenPushValido en BD
    throw new Error(`OneSignal updateDeviceTags error ${response.status}: ${JSON.stringify(data)}`);
  }

  /**
   * Obtiene info de una suscripción de OneSignal (User Model API).
   */
  async getDevice(subscriptionId: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/apps/${this.appId}/subscriptions/${subscriptionId}`,
        {
          headers: { Authorization: this.authHeader },
        },
      );

      if (!response.ok) {
        this.logger.warn(`Suscripción ${subscriptionId} no encontrada en OneSignal.`);
        return null;
      }

      return response.json();
    } catch (error) {
      this.logger.error(`Error consultando suscripción: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Verifica si un subscription ID es válido en OneSignal.
   */
  async isValidSubscription(subscriptionId: string): Promise<boolean> {
    const data = await this.getDevice(subscriptionId);
    return data !== null && data.subscription?.id === subscriptionId;
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
