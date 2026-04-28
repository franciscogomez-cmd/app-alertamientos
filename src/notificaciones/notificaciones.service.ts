import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import { OnesignalService } from './onesignal.service';

type DrizzleDB = PostgresJsDatabase<typeof schema>;

type UsuarioAfectado = {
  id: number;
  tokenPush: string | null;
  latitud: string | null;
  longitud: string | null;
};

// Sólo los campos necesarios para el filtrado geográfico — evita SELECT * en enviarPushActualizacion
type AlertaParaNotificacion = Pick<
  schema.Alerta,
  'id' | 'nivelCobertura' | 'zonaId' | 'centroLatitud' | 'centroLongitud' | 'radioKm' | 'poligonoZona'
>;

// ─── GeoJSON helpers ─────────────────────────────────────────────────────────

type GeoRing = [number, number][];

function puntoDentroDeAnillo(lat: number, lon: number, anillo: GeoRing): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i]; // GeoJSON: [lon, lat]
    const [xj, yj] = anillo[j];
    const cruza = (yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

// Ray-casting — soporta Polygon y MultiPolygon
function puntoDentroDePoligono(lat: number, lon: number, geojson: unknown): boolean {
  if (!geojson || typeof geojson !== 'object') return false;
  const g = geojson as { type?: unknown; coordinates?: unknown };

  if (g.type === 'Polygon') {
    const anillo = (g.coordinates as GeoRing[] | undefined)?.[0];
    if (!anillo?.length) return false;
    return puntoDentroDeAnillo(lat, lon, anillo);
  }

  if (g.type === 'MultiPolygon') {
    const polygons = g.coordinates as GeoRing[][] | undefined;
    if (!polygons?.length) return false;
    return polygons.some((polygon) => {
      const anillo = polygon[0];
      return !!anillo?.length && puntoDentroDeAnillo(lat, lon, anillo);
    });
  }

  return false;
}

// Calcula el bounding box sobre todos los anillos exteriores del GeoJSON
function calcularBboxGeojson(
  geojson: unknown,
): { minLat: number; maxLat: number; minLon: number; maxLon: number } | null {
  if (!geojson || typeof geojson !== 'object') return null;
  const g = geojson as { type?: unknown; coordinates?: unknown };

  let anillos: GeoRing[] = [];

  if (g.type === 'Polygon') {
    const coords = g.coordinates as GeoRing[] | undefined;
    if (coords?.[0]) anillos = [coords[0]];
  } else if (g.type === 'MultiPolygon') {
    const coords = g.coordinates as GeoRing[][] | undefined;
    if (coords) anillos = coords.map((p) => p[0]).filter(Boolean);
  }

  if (anillos.length === 0) return null;

  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const anillo of anillos) {
    for (const [lon, lat] of anillo) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
  }

  return { minLat, maxLat, minLon, maxLon };
}

// ─────────────────────────────────────────────────────────────────────────────

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
    const [alerta] = await this.db
      .select()
      .from(schema.altAlertas)
      .where(eq(schema.altAlertas.id, alertaId));

    if (!alerta) {
      this.logger.warn(`Alerta ${alertaId} no encontrada para push.`);
      return;
    }

    const [categoria] = await this.db
      .select({ nombre: schema.catCategoriasAlerta.nombre })
      .from(schema.catCategoriasAlerta)
      .where(eq(schema.catCategoriasAlerta.id, alerta.categoriaId));

    const usuarios = await this.obtenerUsuariosAfectados(alerta);
    const usuariosConToken = usuarios.filter((u) => u.tokenPush);

    if (usuariosConToken.length === 0) {
      this.logger.warn(`No hay usuarios en el área de la alerta ${alertaId}.`);
      return { enviadas: 0, mensaje: 'No hay usuarios en el área afectada.' };
    }

    const subscriptionIds = usuariosConToken.map((u) => u.tokenPush!);

    const severidadEmoji: Record<string, string> = {
      emergencia: '🚨',
      preventiva: '⚠️',
      informativa: 'ℹ️',
    };
    const emoji = severidadEmoji[alerta.nivelSeveridad] ?? '📢';
    const categoriaNombre = categoria?.nombre ?? 'Alerta';

    const headings = {
      en: `${emoji} ${categoriaNombre}`,
      es: `${emoji} ${categoriaNombre}`,
    };
    const contents = {
      en: alerta.titulo,
      es: alerta.titulo,
    };
    const data = {
      alertaId: alerta.id,
      nivelSeveridad: alerta.nivelSeveridad,
      estatus: alerta.estatus,
      actualizacionId: actualizacionId ?? null,
    };

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
      await this.registrarEnvios(alertaId, actualizacionId ?? null, usuariosConToken, 'fallida', null, (error as Error).message);
      return { enviadas: 0, error: (error as Error).message };
    }

    await this.registrarEnvios(alertaId, actualizacionId ?? null, usuariosConToken, 'enviada', onesignalResponse.id, null);

    // Incremento atómico — evita race condition con envíos concurrentes
    await this.db
      .update(schema.altAlertas)
      .set({ totalEnviadas: sql`${schema.altAlertas.totalEnviadas} + ${onesignalResponse.recipients}` })
      .where(eq(schema.altAlertas.id, alertaId));

    this.logger.log(`Push enviado para alerta ${alertaId}: ${onesignalResponse.recipients} destinatarios`);

    return { enviadas: onesignalResponse.recipients, onesignalId: onesignalResponse.id };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENVIAR PUSH DE ACTUALIZACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async enviarPushActualizacion(alertaId: number, actualizacionId: number, mensaje: string) {
    const [alerta] = await this.db
      .select({
        id: schema.altAlertas.id,
        titulo: schema.altAlertas.titulo,
        nivelCobertura: schema.altAlertas.nivelCobertura,
        zonaId: schema.altAlertas.zonaId,
        centroLatitud: schema.altAlertas.centroLatitud,
        centroLongitud: schema.altAlertas.centroLongitud,
        radioKm: schema.altAlertas.radioKm,
        poligonoZona: schema.altAlertas.poligonoZona,
      })
      .from(schema.altAlertas)
      .where(eq(schema.altAlertas.id, alertaId));

    if (!alerta) return;

    const usuarios = await this.obtenerUsuariosAfectados(alerta);
    const usuariosConToken = usuarios.filter((u) => u.tokenPush);
    if (usuariosConToken.length === 0) return { enviadas: 0 };

    const subscriptionIds = usuariosConToken.map((u) => u.tokenPush!);

    try {
      const response = await this.onesignal.sendToSubscriptionIds(
        subscriptionIds,
        {
          en: `📢 Update: ${alerta.titulo}`,
          es: `📢 Actualización: ${alerta.titulo}`,
        },
        {
          en: mensaje,
          es: mensaje,
        },
        { alertaId, actualizacionId },
      );

      await this.registrarEnvios(alertaId, actualizacionId, usuariosConToken, 'enviada', response.id, null);
      return { enviadas: response.recipients, onesignalId: response.id };
    } catch (error) {
      await this.registrarEnvios(alertaId, actualizacionId, usuariosConToken, 'fallida', null, (error as Error).message);
      return { enviadas: 0, error: (error as Error).message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTRADO GEOGRÁFICO
  // ═══════════════════════════════════════════════════════════════════════════

  private async obtenerUsuariosAfectados(alerta: AlertaParaNotificacion): Promise<UsuarioAfectado[]> {
    const camposUsuario = {
      id: schema.altUsuarios.id,
      tokenPush: schema.altUsuarios.tokenPush,
      latitud: schema.altUsuarios.latitud,
      longitud: schema.altUsuarios.longitud,
    };

    const condicionBase = and(
      eq(schema.altUsuarios.notifActivas, true),
      isNull(schema.altUsuarios.eliminadoEn),
    );

    // Cobertura nacional: todos los usuarios
    if (alerta.nivelCobertura === 'pais') {
      return this.db.select(camposUsuario).from(schema.altUsuarios).where(condicionBase);
    }

    // Usamos Map para deduplicar por ID sin una segunda consulta con inArray
    const mapaAfectados = new Map<number, UsuarioAfectado>();

    // Criterio 1: usuarios suscritos a las zonas de la alerta
    const zonaIds = await this.obtenerZonasAlerta(alerta);
    if (zonaIds.length > 0) {
      const usuariosZona = await this.db
        .select(camposUsuario)
        .from(schema.altUsuariosZonas)
        .innerJoin(schema.altUsuarios, eq(schema.altUsuariosZonas.usuarioId, schema.altUsuarios.id))
        .where(
          and(
            inArray(schema.altUsuariosZonas.zonaId, zonaIds),
            eq(schema.altUsuariosZonas.activo, true),
            isNull(schema.altUsuariosZonas.eliminadoEn),
            condicionBase,
          ),
        );
      usuariosZona.forEach((u) => mapaAfectados.set(u.id, u));
    }

    // Criterio 2: usuarios dentro del radio (Haversine en SQL)
    if (alerta.centroLatitud && alerta.centroLongitud && alerta.radioKm) {
      const lat = parseFloat(alerta.centroLatitud);
      const lon = parseFloat(alerta.centroLongitud);
      const radio = parseFloat(alerta.radioKm);

      if (isNaN(lat) || isNaN(lon) || isNaN(radio)) {
        this.logger.warn(`Alerta ${alerta.id}: coordenadas de centro inválidas, se omite criterio de radio.`);
      } else {
        const usuariosRadio = await this.db
          .select(camposUsuario)
          .from(schema.altUsuarios)
          .where(
            and(
              condicionBase,
              isNotNull(schema.altUsuarios.latitud),
              isNotNull(schema.altUsuarios.longitud),
              sql`
                6371 * acos(
                  GREATEST(-1, LEAST(1,
                    cos(radians(${lat})) * cos(radians(${schema.altUsuarios.latitud}::numeric))
                    * cos(radians(${schema.altUsuarios.longitud}::numeric) - radians(${lon}))
                    + sin(radians(${lat})) * sin(radians(${schema.altUsuarios.latitud}::numeric))
                  ))
                ) <= ${radio}
              `,
            ),
          );
        usuariosRadio.forEach((u) => mapaAfectados.set(u.id, u));
      }
    }

    // Criterio 3: usuarios dentro del polígono personalizado
    // Pre-filtro SQL con bounding box → ray-casting exacto en TS sobre candidatos reducidos
    if (alerta.poligonoZona) {
      const bbox = calcularBboxGeojson(alerta.poligonoZona);
      if (!bbox) {
        this.logger.warn(`Alerta ${alerta.id}: poligonoZona con formato GeoJSON inválido (tipo no soportado), se omite.`);
      } else {
        const { minLat, maxLat, minLon, maxLon } = bbox;
        const candidatos = await this.db
          .select(camposUsuario)
          .from(schema.altUsuarios)
          .where(
            and(
              condicionBase,
              isNotNull(schema.altUsuarios.latitud),
              isNotNull(schema.altUsuarios.longitud),
              sql`${schema.altUsuarios.latitud}::numeric BETWEEN ${minLat} AND ${maxLat}`,
              sql`${schema.altUsuarios.longitud}::numeric BETWEEN ${minLon} AND ${maxLon}`,
            ),
          );

        candidatos
          .filter((u) => {
            const uLat = parseFloat(u.latitud!);
            const uLon = parseFloat(u.longitud!);
            return !isNaN(uLat) && !isNaN(uLon) && puntoDentroDePoligono(uLat, uLon, alerta.poligonoZona);
          })
          .forEach((u) => mapaAfectados.set(u.id, u));
      }
    }

    return Array.from(mapaAfectados.values());
  }

  private async obtenerZonasAlerta(alerta: Pick<schema.Alerta, 'id' | 'zonaId'>): Promise<number[]> {
    const zonaIds = new Set<number>();

    if (alerta.zonaId) {
      zonaIds.add(alerta.zonaId);
    }

    const zonasNM = await this.db
      .select({ zonaId: schema.altAlertasZonas.zonaId })
      .from(schema.altAlertasZonas)
      .where(
        and(
          eq(schema.altAlertasZonas.alertaId, alerta.id),
          isNull(schema.altAlertasZonas.eliminadoEn),
        ),
      );

    zonasNM.forEach((z) => zonaIds.add(z.zonaId));

    return Array.from(zonaIds);
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
    const batchSize = 100;
    const now = estatus === 'enviada' ? new Date() : undefined;

    // Transacción: si un lote falla, se revierten todos los inserts del envío
    await this.db.transaction(async (tx) => {
      for (let i = 0; i < usuarios.length; i += batchSize) {
        const batch = usuarios.slice(i, i + batchSize);
        await tx.insert(schema.altNotificacionesEnviadas).values(
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
    });
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
