import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, ilike, inArray, isNotNull, isNull, or, SQL } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import { OnesignalService } from '../notificaciones/onesignal.service';
import {
  CreateUsuarioDto,
  UpdateUsuarioDto,
  QueryUsuariosDto,
  UpdateUbicacionDto,
  UpdatePreferenciasDto,
  QueryNotificacionesUsuarioDto,
} from './dto';
import { isWithinNayarit } from './utils/nayarit-bounds.util';

type DrizzleDB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly onesignal: OnesignalService,
  ) { }

  // ═══════════════════════════════════════════════════════════════════════════
  // REGISTRAR USUARIO (dispositivo)
  // ═══════════════════════════════════════════════════════════════════════════

  async create(dto: CreateUsuarioDto) {
    this.logger.debug(`[create] Iniciando registro | DTO: ${JSON.stringify(dto)}`);

    const [existing] = await this.db
      .select({ id: schema.altUsuarios.id })
      .from(schema.altUsuarios)
      .where(
        and(
          eq(schema.altUsuarios.deviceId, dto.deviceId),
          isNull(schema.altUsuarios.eliminadoEn),
        ),
      );

    if (existing) {
      this.logger.warn(`[create] deviceId ya registrado: ${dto.deviceId} → id existente: ${existing.id}`);
      throw new ConflictException(
        `Ya existe un usuario registrado con deviceId "${dto.deviceId}".`,
      );
    }

    this.logger.debug(`[create] deviceId libre, procediendo con inserción`);

    if (dto.latitud !== undefined && dto.longitud !== undefined) {
      this.logger.debug(`[create] Validando coordenadas lat=${dto.latitud} lon=${dto.longitud}`);
      if (!isWithinNayarit(dto.latitud, dto.longitud)) {
        this.logger.warn(`[create] Coordenadas fuera de Nayarit: lat=${dto.latitud} lon=${dto.longitud}`);
        throw new BadRequestException(
          'El usuario se encuentra fuera del estado de Nayarit. No es posible registrar la ubicación.',
        );
      }
    }

    const [usuario] = await this.db
      .insert(schema.altUsuarios)
      .values({
        imei: dto.imei,
        deviceId: dto.deviceId,
        tokenPush: dto.tokenPush,
        plataforma: dto.plataforma as any,
        versionApp: dto.versionApp,
        modeloDispositivo: dto.modeloDispositivo,
        sistemaOperativo: dto.sistemaOperativo,
        latitud: dto.latitud?.toString(),
        longitud: dto.longitud?.toString(),
        precisionMetros: dto.precisionMetros?.toString(),
        codigoPostal: dto.codigoPostal,
        notifActivas: dto.notifActivas,
        gpsActivo: dto.gpsActivo,
        notifMeteorologicas: dto.notifMeteorologicas,
        notifUltimaHora: dto.notifUltimaHora,
        notifVialidad: dto.notifVialidad,
        notifServicios: dto.notifServicios,
        silencioInicio: dto.silencioInicio,
        silencioFin: dto.silencioFin,
        severidadMinima: dto.severidadMinima as any,
      })
      .returning();

    this.logger.debug(`[create] Usuario insertado OK | id: ${usuario.id} | tokenPush: ${usuario.tokenPush ?? 'null'}`);

    // ── Sincronizar tags en OneSignal ──────────────────────────────────────
    if (usuario.tokenPush) {
      const tags = this.buildTagsPayload(usuario);
      this.logger.debug(`[create] Tags a sincronizar con OneSignal: ${JSON.stringify(tags)}`);
      this.syncTagsToOneSignal(usuario.tokenPush, tags);
    } else {
      this.logger.warn(`[create] Usuario ${usuario.id} no tiene tokenPush, se omite sincronización con OneSignal`);
    }

    return usuario;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LISTAR USUARIOS (paginación + filtros)
  // ═══════════════════════════════════════════════════════════════════════════

  async findAll(query: QueryUsuariosDto) {
    const { page = 1, limit = 20, busqueda, plataforma, notifActivas, gpsActivo } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [isNull(schema.altUsuarios.eliminadoEn)];

    if (busqueda) {
      conditions.push(
        or(
          ilike(schema.altUsuarios.deviceId, `%${busqueda}%`),
          ilike(schema.altUsuarios.imei, `%${busqueda}%`),
          ilike(schema.altUsuarios.modeloDispositivo, `%${busqueda}%`),
          ilike(schema.altUsuarios.codigoPostal, `%${busqueda}%`),
        )!,
      );
    }
    if (plataforma) {
      conditions.push(eq(schema.altUsuarios.plataforma, plataforma as any));
    }
    if (notifActivas !== undefined) {
      conditions.push(eq(schema.altUsuarios.notifActivas, notifActivas));
    }
    if (gpsActivo !== undefined) {
      conditions.push(eq(schema.altUsuarios.gpsActivo, gpsActivo));
    }

    const where = and(...conditions);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(schema.altUsuarios)
      .where(where);

    const data = await this.db
      .select()
      .from(schema.altUsuarios)
      .where(where)
      .orderBy(desc(schema.altUsuarios.creadoEn))
      .limit(limit)
      .offset(offset);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER USUARIO POR ID
  // ═══════════════════════════════════════════════════════════════════════════

  async findOne(id: number) {
    const [usuario] = await this.db
      .select()
      .from(schema.altUsuarios)
      .where(and(eq(schema.altUsuarios.id, id), isNull(schema.altUsuarios.eliminadoEn)));

    if (!usuario) {
      throw new NotFoundException(`Usuario con id ${id} no encontrado.`);
    }

    // Cargar zonas suscritas
    const zonasSuscritas = await this.db
      .select({
        id: schema.altUsuariosZonas.id,
        zonaId: schema.altUsuariosZonas.zonaId,
        activo: schema.altUsuariosZonas.activo,
        zonaNombre: schema.catZonasGeograficas.nombre,
        zonaTipo: schema.catZonasGeograficas.tipo,
      })
      .from(schema.altUsuariosZonas)
      .innerJoin(
        schema.catZonasGeograficas,
        eq(schema.altUsuariosZonas.zonaId, schema.catZonasGeograficas.id),
      )
      .where(
        and(
          eq(schema.altUsuariosZonas.usuarioId, id),
          isNull(schema.altUsuariosZonas.eliminadoEn),
        ),
      );

    return { ...usuario, zonasSuscritas };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUSCAR POR deviceId
  // ═══════════════════════════════════════════════════════════════════════════

  async findByDeviceId(deviceId: string) {
    const [usuario] = await this.db
      .select()
      .from(schema.altUsuarios)
      .where(
        and(
          eq(schema.altUsuarios.deviceId, deviceId),
          isNull(schema.altUsuarios.eliminadoEn),
        ),
      );

    if (!usuario) {
      throw new NotFoundException(`Usuario con deviceId "${deviceId}" no encontrado.`);
    }

    return usuario;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTUALIZAR USUARIO
  // ═══════════════════════════════════════════════════════════════════════════

  async update(id: number, dto: UpdateUsuarioDto) {
    this.logger.debug(`[update] Iniciando actualización usuario ${id} | DTO: ${JSON.stringify(dto)}`);
    await this.findOne(id);
    console.log(`[update] Iniciando actualización usuario ${id} | DTO: ${JSON.stringify(dto)}`)
    const data = dto as Partial<CreateUsuarioDto>;
    const updateValues: Record<string, any> = {};

    if (data.imei !== undefined) updateValues.imei = data.imei;
    if (data.deviceId !== undefined) updateValues.deviceId = data.deviceId;
    if (data.tokenPush !== undefined) updateValues.tokenPush = data.tokenPush;
    if (data.plataforma !== undefined) updateValues.plataforma = data.plataforma;
    if (data.versionApp !== undefined) updateValues.versionApp = data.versionApp;
    if (data.modeloDispositivo !== undefined) updateValues.modeloDispositivo = data.modeloDispositivo;
    if (data.sistemaOperativo !== undefined) updateValues.sistemaOperativo = data.sistemaOperativo;
    if (data.latitud !== undefined && data.longitud !== undefined) {
      if (!isWithinNayarit(data.latitud, data.longitud)) {
        throw new BadRequestException(
          'El usuario se encuentra fuera del estado de Nayarit. No se actualizará su ubicación.',
        );
      }
    }

    if (data.latitud !== undefined) updateValues.latitud = data.latitud?.toString();
    if (data.longitud !== undefined) updateValues.longitud = data.longitud?.toString();
    if (data.precisionMetros !== undefined) updateValues.precisionMetros = data.precisionMetros?.toString();
    if (data.codigoPostal !== undefined) updateValues.codigoPostal = data.codigoPostal;
    if (data.notifActivas !== undefined) updateValues.notifActivas = data.notifActivas;
    if (data.gpsActivo !== undefined) updateValues.gpsActivo = data.gpsActivo;
    if (data.notifMeteorologicas !== undefined) updateValues.notifMeteorologicas = data.notifMeteorologicas;
    if (data.notifUltimaHora !== undefined) updateValues.notifUltimaHora = data.notifUltimaHora;
    if (data.notifVialidad !== undefined) updateValues.notifVialidad = data.notifVialidad;
    if (data.notifServicios !== undefined) updateValues.notifServicios = data.notifServicios;
    if (data.silencioInicio !== undefined) updateValues.silencioInicio = data.silencioInicio;
    if (data.silencioFin !== undefined) updateValues.silencioFin = data.silencioFin;
    if (data.severidadMinima !== undefined) updateValues.severidadMinima = data.severidadMinima;

    if (Object.keys(updateValues).length === 0) {
      this.logger.debug(`[update] Sin campos a actualizar para usuario ${id}, retornando estado actual`);
      return this.findOne(id);
    }

    this.logger.debug(`[update] Campos a actualizar para usuario ${id}: ${JSON.stringify(updateValues)}`);

    const [updated] = await this.db
      .update(schema.altUsuarios)
      .set(updateValues)
      .where(eq(schema.altUsuarios.id, id))
      .returning();

    this.logger.debug(`[update] DB actualizado OK para usuario ${id} | tokenPush: ${updated.tokenPush ?? 'null'}`);

    // ── Sincronizar tags en OneSignal si tiene tokenPush ─────────────────
    if (updated.tokenPush) {
      const tags = this.buildTagsPayload(updated);
      this.logger.debug(`[update] Tags a sincronizar con OneSignal: ${JSON.stringify(tags)}`);
      this.syncTagsToOneSignal(updated.tokenPush, tags);
    } else {
      this.logger.warn(`[update] Usuario ${id} no tiene tokenPush, se omite sincronización con OneSignal`);
    }

    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ELIMINAR USUARIO (soft-delete)
  // ═══════════════════════════════════════════════════════════════════════════

  async remove(id: number) {
    await this.findOne(id);

    await this.db
      .update(schema.altUsuarios)
      .set({ eliminadoEn: new Date() })
      .where(eq(schema.altUsuarios.id, id));

    return { message: `Usuario ${id} eliminado exitosamente.` };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTUALIZAR UBICACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async updateUbicacion(id: number, dto: UpdateUbicacionDto) {
    this.logger.debug(`[updateUbicacion] Iniciando | usuario ${id} | DTO: ${JSON.stringify(dto)}`);
    await this.findOne(id);

    this.logger.debug(`[updateUbicacion] Validando coordenadas lat=${dto.latitud} lon=${dto.longitud}`);
    if (!isWithinNayarit(dto.latitud, dto.longitud)) {
      this.logger.warn(`[updateUbicacion] Coordenadas fuera de Nayarit para usuario ${id}: lat=${dto.latitud} lon=${dto.longitud}`);
      throw new BadRequestException(
        'El usuario se encuentra fuera del estado de Nayarit. No se actualizará su ubicación.',
      );
    }

    const [updated] = await this.db
      .update(schema.altUsuarios)
      .set({
        latitud: dto.latitud.toString(),
        longitud: dto.longitud.toString(),
        precisionMetros: dto.precisionMetros?.toString(),
        ubicacionActualizadaEn: new Date(),
      })
      .where(eq(schema.altUsuarios.id, id))
      .returning();

    this.logger.debug(`[updateUbicacion] DB actualizado OK para usuario ${id} | tokenPush: ${updated.tokenPush ?? 'null'}`);

    // ── Sincronizar tags en OneSignal ───────────────────────────────────
    if (updated.tokenPush) {
      const tags = this.buildTagsPayload(updated);
      this.logger.debug(`[updateUbicacion] Tags a sincronizar con OneSignal: ${JSON.stringify(tags)}`);
      this.syncTagsToOneSignal(updated.tokenPush, tags);
    } else {
      this.logger.warn(`[updateUbicacion] Usuario ${id} no tiene tokenPush, se omite sincronización con OneSignal`);
    }

    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTUALIZAR PREFERENCIAS DE NOTIFICACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async updatePreferencias(id: number, dto: UpdatePreferenciasDto) {
    await this.findOne(id);

    const updateValues: Record<string, any> = {};

    if (dto.notifActivas !== undefined) updateValues.notifActivas = dto.notifActivas;
    if (dto.gpsActivo !== undefined) updateValues.gpsActivo = dto.gpsActivo;
    if (dto.notifMeteorologicas !== undefined) updateValues.notifMeteorologicas = dto.notifMeteorologicas;
    if (dto.notifUltimaHora !== undefined) updateValues.notifUltimaHora = dto.notifUltimaHora;
    if (dto.notifVialidad !== undefined) updateValues.notifVialidad = dto.notifVialidad;
    if (dto.notifServicios !== undefined) updateValues.notifServicios = dto.notifServicios;

    if (Object.keys(updateValues).length === 0) {
      return this.findOne(id);
    }

    const [updated] = await this.db
      .update(schema.altUsuarios)
      .set(updateValues)
      .where(eq(schema.altUsuarios.id, id))
      .returning();

    // ── Sincronizar tags en OneSignal ────────────────────────────────────
    if (updated.tokenPush) {
      this.syncTagsToOneSignal(updated.tokenPush, this.buildTagsPayload(updated));
    }

    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUSCRIPCIONES A ZONAS (N:M)
  // ═══════════════════════════════════════════════════════════════════════════

  async suscribirZona(usuarioId: number, zonaId: number) {
    await this.findOne(usuarioId);

    // Validar que la zona existe
    const [zona] = await this.db
      .select({ id: schema.catZonasGeograficas.id })
      .from(schema.catZonasGeograficas)
      .where(
        and(
          eq(schema.catZonasGeograficas.id, zonaId),
          isNull(schema.catZonasGeograficas.eliminadoEn),
        ),
      );
    if (!zona) {
      throw new BadRequestException(`La zona con id ${zonaId} no existe.`);
    }

    // Verificar si ya está suscrito
    const [existing] = await this.db
      .select()
      .from(schema.altUsuariosZonas)
      .where(
        and(
          eq(schema.altUsuariosZonas.usuarioId, usuarioId),
          eq(schema.altUsuariosZonas.zonaId, zonaId),
          isNull(schema.altUsuariosZonas.eliminadoEn),
        ),
      );

    if (existing) {
      throw new ConflictException(
        `El usuario ${usuarioId} ya está suscrito a la zona ${zonaId}.`,
      );
    }

    const [suscripcion] = await this.db
      .insert(schema.altUsuariosZonas)
      .values({ usuarioId, zonaId })
      .returning();

    return suscripcion;
  }

  async desuscribirZona(usuarioId: number, zonaId: number) {
    await this.findOne(usuarioId);

    const result = await this.db
      .update(schema.altUsuariosZonas)
      .set({ eliminadoEn: new Date() })
      .where(
        and(
          eq(schema.altUsuariosZonas.usuarioId, usuarioId),
          eq(schema.altUsuariosZonas.zonaId, zonaId),
          isNull(schema.altUsuariosZonas.eliminadoEn),
        ),
      )
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(
        `El usuario ${usuarioId} no está suscrito a la zona ${zonaId}.`,
      );
    }

    return { message: `Suscripción a zona ${zonaId} eliminada.` };
  }

  async obtenerZonasSuscritas(usuarioId: number) {
    await this.findOne(usuarioId);

    return this.db
      .select({
        id: schema.altUsuariosZonas.id,
        zonaId: schema.altUsuariosZonas.zonaId,
        activo: schema.altUsuariosZonas.activo,
        zonaNombre: schema.catZonasGeograficas.nombre,
        zonaTipo: schema.catZonasGeograficas.tipo,
        creadoEn: schema.altUsuariosZonas.creadoEn,
      })
      .from(schema.altUsuariosZonas)
      .innerJoin(
        schema.catZonasGeograficas,
        eq(schema.altUsuariosZonas.zonaId, schema.catZonasGeograficas.id),
      )
      .where(
        and(
          eq(schema.altUsuariosZonas.usuarioId, usuarioId),
          isNull(schema.altUsuariosZonas.eliminadoEn),
        ),
      );
  }

  async toggleZonaActiva(usuarioId: number, zonaId: number) {
    await this.findOne(usuarioId);

    const [suscripcion] = await this.db
      .select()
      .from(schema.altUsuariosZonas)
      .where(
        and(
          eq(schema.altUsuariosZonas.usuarioId, usuarioId),
          eq(schema.altUsuariosZonas.zonaId, zonaId),
          isNull(schema.altUsuariosZonas.eliminadoEn),
        ),
      );

    if (!suscripcion) {
      throw new NotFoundException(
        `El usuario ${usuarioId} no está suscrito a la zona ${zonaId}.`,
      );
    }

    const [updated] = await this.db
      .update(schema.altUsuariosZonas)
      .set({ activo: !suscripcion.activo })
      .where(eq(schema.altUsuariosZonas.id, suscripcion.id))
      .returning();

    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS: Sincronización con OneSignal
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Sincroniza tags en OneSignal de forma asíncrona (fire-and-forget).
   * No bloquea la respuesta al cliente si falla.
   */
  private syncTagsToOneSignal(
    tokenPush: string,
    tags: Record<string, string | number | boolean>,
  ) {
    this.onesignal
      .updateDeviceTags(tokenPush, tags)
      .then((result) => {
        if (result.success) {
          this.logger.log(`[syncTags] OneSignal tags actualizados OK para ${tokenPush}`);
        } else {
          this.logger.error(`[syncTags] OneSignal rechazó la actualización de tags para ${tokenPush} (success=false)`);
        }
      })
      .catch((err) => {
        this.logger.error(
          `[syncTags] Excepción al sincronizar tags de OneSignal para ${tokenPush}: ${(err as Error).message}`,
        );
      });
  }

  /**
   * Construye el payload de tags para OneSignal.
   * Consolida los 5 flags de notificación en un solo tag "notifPrefs" (bitmask string)
   * para respetar el límite de 3 tags del plan. Los tags viejos se envían con "" para borrarlos.
   */
  private buildTagsPayload(u: {
    id: number;
    severidadMinima?: string | null;
    notifActivas?: boolean | null;
    notifMeteorologicas?: boolean | null;
    notifUltimaHora?: boolean | null;
    notifVialidad?: boolean | null;
    notifServicios?: boolean | null;
  }): Record<string, string> {
    const notifPrefs = [
      u.notifActivas,
      u.notifMeteorologicas,
      u.notifUltimaHora,
      u.notifVialidad,
      u.notifServicios,
    ]
      .map((v) => (v ? '1' : '0'))
      .join('');

    return {
      userId: u.id.toString(),
      severidadMinima: u.severidadMinima ?? 'informativa',
      notifPrefs,
      // Borrar tags obsoletos
      plataforma: '',
      notifActivas: '',
      notifMeteorologicas: '',
      notifUltimaHora: '',
      notifVialidad: '',
      notifServicios: '',
      latitud: '',
      longitud: '',
      codigoPostal: '',
      zonas: '',
      totalZonas: '',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICACIONES DEL USUARIO
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Obtiene las notificaciones recibidas por un usuario con filtros y paginación.
   * Incluye información de la alerta y categoría asociadas.
   */
  async obtenerNotificaciones(usuarioId: number, query: QueryNotificacionesUsuarioDto) {
    await this.findOne(usuarioId);

    const { page = 1, limit = 20, estatus, soloLeidas, soloNoLeidas, alertaId } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(schema.altNotificacionesEnviadas.usuarioId, usuarioId)];

    if (estatus) {
      conditions.push(eq(schema.altNotificacionesEnviadas.estatusEnvio, estatus as any));
    }

    if (soloLeidas) {
      conditions.push(isNotNull(schema.altNotificacionesEnviadas.leidaEn));
    }

    if (soloNoLeidas) {
      conditions.push(isNull(schema.altNotificacionesEnviadas.leidaEn));
    }

    if (alertaId) {
      conditions.push(eq(schema.altNotificacionesEnviadas.alertaId, alertaId));
    }

    const where = and(...conditions);

    // Contar total
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(schema.altNotificacionesEnviadas)
      .where(where);

    // Obtener notificaciones con información de alerta y categoría
    const data = await this.db
      .select({
        // Campos de la notificación
        id: schema.altNotificacionesEnviadas.id,
        alertaId: schema.altNotificacionesEnviadas.alertaId,
        actualizacionId: schema.altNotificacionesEnviadas.actualizacionId,
        estatusEnvio: schema.altNotificacionesEnviadas.estatusEnvio,
        intentoNumero: schema.altNotificacionesEnviadas.intentoNumero,
        mensajeError: schema.altNotificacionesEnviadas.mensajeError,
        enviadaEn: schema.altNotificacionesEnviadas.enviadaEn,
        leidaEn: schema.altNotificacionesEnviadas.leidaEn,
        creadoEn: schema.altNotificacionesEnviadas.creadoEn,
        // Información de la alerta
        alertaTitulo: schema.altAlertas.titulo,
        alertaDescripcion: schema.altAlertas.descripcion,
        alertaNivelSeveridad: schema.altAlertas.nivelSeveridad,
        alertaEstatus: schema.altAlertas.estatus,
        alertaImagenUrl: schema.altAlertas.imagenUrl,
        alertaFechaInicio: schema.altAlertas.fechaInicio,
        alertaFechaFin: schema.altAlertas.fechaFin,
        alertaCentroLatitud: schema.altAlertas.centroLatitud,
        alertaCentroLongitud: schema.altAlertas.centroLongitud,
        alertaRadioKm: schema.altAlertas.radioKm,
        // Información de la categoría
        categoriaNombre: schema.catCategoriasAlerta.nombre,
        categoriaIcono: schema.catCategoriasAlerta.icono,
      })
      .from(schema.altNotificacionesEnviadas)
      .innerJoin(
        schema.altAlertas,
        eq(schema.altNotificacionesEnviadas.alertaId, schema.altAlertas.id),
      )
      .innerJoin(
        schema.catCategoriasAlerta,
        eq(schema.altAlertas.categoriaId, schema.catCategoriasAlerta.id),
      )
      .where(where)
      .orderBy(desc(schema.altNotificacionesEnviadas.creadoEn))
      .limit(limit)
      .offset(offset);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Marca una notificación como leída.
   * Solo puede marcar notificaciones del propio usuario.
   */
  async marcarNotificacionLeida(usuarioId: number, notificacionId: number) {
    await this.findOne(usuarioId);

    // Verificar que la notificación pertenece al usuario
    const [notificacion] = await this.db
      .select()
      .from(schema.altNotificacionesEnviadas)
      .where(eq(schema.altNotificacionesEnviadas.id, notificacionId));

    if (!notificacion) {
      throw new NotFoundException(`Notificación con id ${notificacionId} no encontrada.`);
    }

    if (notificacion.usuarioId !== usuarioId) {
      throw new BadRequestException(
        `La notificación ${notificacionId} no pertenece al usuario ${usuarioId}.`,
      );
    }

    if (notificacion.leidaEn) {
      // Ya estaba leída, retornar sin cambios
      return notificacion;
    }

    // Marcar como leída
    const [updated] = await this.db
      .update(schema.altNotificacionesEnviadas)
      .set({ leidaEn: new Date() })
      .where(eq(schema.altNotificacionesEnviadas.id, notificacionId))
      .returning();

    return updated;
  }
}
