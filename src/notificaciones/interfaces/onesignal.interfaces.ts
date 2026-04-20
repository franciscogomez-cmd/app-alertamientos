/**
 * Interfaces para la API REST de OneSignal v1.
 */

export interface OneSignalNotificationPayload {
  /** Segmentos de audiencia (e.g. 'Subscribed Users') */
  included_segments?: string[];
  /** IDs de suscripción específicos */
  include_subscription_ids?: string[];
  /** Filtros avanzados */
  filters?: OneSignalFilter[];

  /** Contenido del push — objeto { "es": "...", "en": "..." } */
  contents: Record<string, string>;
  /** Título (headings) */
  headings?: Record<string, string>;
  /** Subtítulo (iOS) */
  subtitle?: Record<string, string>;

  /** URL a abrir al tocar */
  url?: string;
  /** Imagen grande (Android/iOS) */
  big_picture?: string;
  ios_attachments?: Record<string, string>;

  /** Datos adicionales que recibe la app */
  data?: Record<string, any>;

  /** Sonido personalizado */
  android_channel_id?: string;
  ios_sound?: string;
  android_sound?: string;

  /** Prioridad */
  priority?: number;

  /** TTL en segundos */
  ttl?: number;
}

export interface OneSignalFilter {
  field: string;
  key?: string;
  relation: string;
  value: string;
  operator?: 'AND' | 'OR';
}

export interface OneSignalNotificationResponse {
  id: string;
  recipients: number;
  external_id?: string;
  errors?: any;
}
