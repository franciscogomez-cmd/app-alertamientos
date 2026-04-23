import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, gte, ilike, inArray, isNull, or, SQL } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import {
  CreateAlertaDto,
  UpdateAlertaDto,
  CreateActualizacionDto,
  QueryAlertasDto,
} from './dto';

type DrizzleDB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class AlertasService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly notificaciones: NotificacionesService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CREAR ALERTA
  // ═══════════════════════════════════════════════════════════════════════════

  async create(dto: CreateAlertaDto, adminId: number) {
    const { zonas, ...alertaData } = dto;

    // Validar constraint: al menos una referencia geográfica
    const tieneZona = alertaData.zonaId != null;
    const tieneCoordenadas = alertaData.centroLatitud != null && alertaData.centroLongitud != null;
    const tienePoligono = alertaData.poligonoZona != null;

    if (!tieneZona && !tieneCoordenadas && !tienePoligono) {
      throw new BadRequestException(
        'Debe proporcionar al menos una referencia geográfica: zonaId, centroLatitud+centroLongitud, o poligonoZona.',
      );
    }

    // Validar que la categoría existe
    const [categoria] = await this.db
      .select({ id: schema.catCategoriasAlerta.id })
      .from(schema.catCategoriasAlerta)
      .where(
        and(
          eq(schema.catCategoriasAlerta.id, alertaData.categoriaId),
          isNull(schema.catCategoriasAlerta.eliminadoEn),
        ),
      );
    if (!categoria) {
      throw new BadRequestException(`La categoría con id ${alertaData.categoriaId} no existe.`);
    }

    // Validar que la zona principal existe (si se envió)
    if (alertaData.zonaId) {
      const [zona] = await this.db
        .select({ id: schema.catZonasGeograficas.id })
        .from(schema.catZonasGeograficas)
        .where(
          and(
            eq(schema.catZonasGeograficas.id, alertaData.zonaId),
            isNull(schema.catZonasGeograficas.eliminadoEn),
          ),
        );
      if (!zona) {
        throw new BadRequestException(`La zona con id ${alertaData.zonaId} no existe.`);
      }
    }

    // Validar que todas las zonas N:M existen (si se enviaron)
    if (zonas?.length) {
      const zonaIds = zonas.map((z) => z.zonaId);
      const zonasExistentes = await this.db
        .select({ id: schema.catZonasGeograficas.id })
        .from(schema.catZonasGeograficas)
        .where(
          and(
            inArray(schema.catZonasGeograficas.id, zonaIds),
            isNull(schema.catZonasGeograficas.eliminadoEn),
          ),
        );
      const idsExistentes = new Set(zonasExistentes.map((z) => z.id));
      const noExisten = zonaIds.filter((id) => !idsExistentes.has(id));
      if (noExisten.length) {
        throw new BadRequestException(`Las siguientes zonas no existen: ${noExisten.join(', ')}.`);
      }
    }

    // Insertar la alerta principal
    const [alerta] = await this.db
      .insert(schema.altAlertas)
      .values({
        categoriaId: alertaData.categoriaId,
        titulo: alertaData.titulo,
        descripcion: alertaData.descripcion,
        nivelSeveridad: alertaData.nivelSeveridad,
        estatus: alertaData.estatus ?? 'borrador',
        nivelCobertura: alertaData.nivelCobertura,
        fechaInicio: alertaData.fechaInicio ? new Date(alertaData.fechaInicio) : undefined,
        fechaFin: alertaData.fechaFin ? new Date(alertaData.fechaFin) : undefined,
        zonaId: alertaData.zonaId,
        centroLatitud: alertaData.centroLatitud?.toString(),
        centroLongitud: alertaData.centroLongitud?.toString(),
        radioKm: alertaData.radioKm?.toString(),
        poligonoZona: alertaData.poligonoZona,
        acciones: alertaData.acciones,
        imagenUrl: alertaData.imagenUrl,
        mapaVisible: alertaData.mapaVisible,
        creadoPor: adminId,
      })
      .returning();

    // Asociar zonas múltiples si se proporcionaron
    if (zonas?.length) {
      await this.db.insert(schema.altAlertasZonas).values(
        zonas.map((z) => ({
          alertaId: alerta.id,
          zonaId: z.zonaId,
          creadoPor: adminId,
        })),
      );
    }

    return this.findOne(alerta.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LISTAR ALERTAS (con paginación y filtros)
  // ═══════════════════════════════════════════════════════════════════════════

  async findAll(query: QueryAlertasDto) {
    const { page = 1, limit = 20, estatus, nivelSeveridad, categoriaId, busqueda } = query;
    const offset = (page - 1) * limit;

    // Construir condiciones dinámicamente
    const conditions: SQL[] = [isNull(schema.altAlertas.eliminadoEn)];

    if (estatus) {
      conditions.push(eq(schema.altAlertas.estatus, estatus));
    }
    if (nivelSeveridad) {
      conditions.push(eq(schema.altAlertas.nivelSeveridad, nivelSeveridad));
    }
    if (categoriaId) {
      conditions.push(eq(schema.altAlertas.categoriaId, categoriaId));
    }
    if (busqueda) {
      conditions.push(
        or(
          ilike(schema.altAlertas.titulo, `%${busqueda}%`),
          ilike(schema.altAlertas.descripcion, `%${busqueda}%`),
        )!,
      );
    }

    const where = and(...conditions);

    // Contar total
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(schema.altAlertas)
      .where(where);

    // Obtener datos con relaciones
    const data = await this.db
      .select()
      .from(schema.altAlertas)
      .where(where)
      .orderBy(desc(schema.altAlertas.creadoEn))
      .limit(limit)
      .offset(offset);

    // Cargar categorías para cada alerta
    const alertasConCategoria = await Promise.all(
      data.map(async (alerta) => {
        const [categoria] = await this.db
          .select({ id: schema.catCategoriasAlerta.id, nombre: schema.catCategoriasAlerta.nombre, slug: schema.catCategoriasAlerta.slug, colorHex: schema.catCategoriasAlerta.colorHex, icono: schema.catCategoriasAlerta.icono })
          .from(schema.catCategoriasAlerta)
          .where(eq(schema.catCategoriasAlerta.id, alerta.categoriaId))
          .limit(1);

        return { ...alerta, categoria };
      }),
    );

    return {
      data: alertasConCategoria,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER UNA ALERTA (con relaciones completas)
  // ═══════════════════════════════════════════════════════════════════════════

  async findOne(id: number) {
    const [alerta] = await this.db
      .select()
      .from(schema.altAlertas)
      .where(and(eq(schema.altAlertas.id, id), isNull(schema.altAlertas.eliminadoEn)));

    if (!alerta) {
      throw new NotFoundException(`Alerta con id ${id} no encontrada.`);
    }

    // Cargar categoría
    const [categoria] = await this.db
      .select()
      .from(schema.catCategoriasAlerta)
      .where(eq(schema.catCategoriasAlerta.id, alerta.categoriaId));

    // Cargar zona principal
    let zona = null;
    if (alerta.zonaId) {
      const [z] = await this.db
        .select()
        .from(schema.catZonasGeograficas)
        .where(eq(schema.catZonasGeograficas.id, alerta.zonaId));
      zona = z ?? null;
    }

    // Cargar zonas asociadas (N:M)
    const alertasZonas = await this.db
      .select({
        id: schema.altAlertasZonas.id,
        zonaId: schema.altAlertasZonas.zonaId,
        zonaNombre: schema.catZonasGeograficas.nombre,
        zonaTipo: schema.catZonasGeograficas.tipo,
      })
      .from(schema.altAlertasZonas)
      .innerJoin(
        schema.catZonasGeograficas,
        eq(schema.altAlertasZonas.zonaId, schema.catZonasGeograficas.id),
      )
      .where(
        and(
          eq(schema.altAlertasZonas.alertaId, id),
          isNull(schema.altAlertasZonas.eliminadoEn),
        ),
      );

    // Cargar actualizaciones recientes
    const actualizaciones = await this.db
      .select()
      .from(schema.altActualizacionesAlerta)
      .where(
        and(
          eq(schema.altActualizacionesAlerta.alertaId, id),
          isNull(schema.altActualizacionesAlerta.eliminadoEn),
        ),
      )
      .orderBy(desc(schema.altActualizacionesAlerta.creadoEn));

    return {
      ...alerta,
      categoria,
      zona,
      zonas: alertasZonas,
      actualizaciones,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTUALIZAR ALERTA
  // ═══════════════════════════════════════════════════════════════════════════

  async update(id: number, dto: UpdateAlertaDto, adminId: number) {
    // Verificar existencia
    await this.findOne(id);

    const { zonas, ...alertaData } = dto as CreateAlertaDto & { zonas?: CreateAlertaDto['zonas'] };

    // Preparar valores para update (solo los campos proporcionados)
    const updateValues: Record<string, any> = { actualizadoPor: adminId };

    if (alertaData.categoriaId !== undefined) updateValues.categoriaId = alertaData.categoriaId;
    if (alertaData.titulo !== undefined) updateValues.titulo = alertaData.titulo;
    if (alertaData.descripcion !== undefined) updateValues.descripcion = alertaData.descripcion;
    if (alertaData.nivelSeveridad !== undefined) updateValues.nivelSeveridad = alertaData.nivelSeveridad;
    if (alertaData.estatus !== undefined) updateValues.estatus = alertaData.estatus;
    if (alertaData.nivelCobertura !== undefined) updateValues.nivelCobertura = alertaData.nivelCobertura;
    if (alertaData.fechaInicio !== undefined) updateValues.fechaInicio = new Date(alertaData.fechaInicio);
    if (alertaData.fechaFin !== undefined) updateValues.fechaFin = alertaData.fechaFin ? new Date(alertaData.fechaFin) : null;
    if (alertaData.zonaId !== undefined) updateValues.zonaId = alertaData.zonaId;
    if (alertaData.centroLatitud !== undefined) updateValues.centroLatitud = alertaData.centroLatitud?.toString();
    if (alertaData.centroLongitud !== undefined) updateValues.centroLongitud = alertaData.centroLongitud?.toString();
    if (alertaData.radioKm !== undefined) updateValues.radioKm = alertaData.radioKm?.toString();
    if (alertaData.poligonoZona !== undefined) updateValues.poligonoZona = alertaData.poligonoZona;
    if (alertaData.acciones !== undefined) updateValues.acciones = alertaData.acciones;
    if (alertaData.imagenUrl !== undefined) updateValues.imagenUrl = alertaData.imagenUrl;
    if (alertaData.mapaVisible !== undefined) updateValues.mapaVisible = alertaData.mapaVisible;

    await this.db
      .update(schema.altAlertas)
      .set(updateValues)
      .where(eq(schema.altAlertas.id, id));

    // Reemplazar zonas si se proporcionaron
    if (zonas !== undefined) {
      // Soft-delete zonas existentes
      await this.db
        .update(schema.altAlertasZonas)
        .set({ eliminadoEn: new Date(), eliminadoPor: adminId })
        .where(
          and(
            eq(schema.altAlertasZonas.alertaId, id),
            isNull(schema.altAlertasZonas.eliminadoEn),
          ),
        );

      // Insertar nuevas zonas
      if (zonas && zonas.length > 0) {
        await this.db.insert(schema.altAlertasZonas).values(
          zonas.map((z: { zonaId: number }) => ({
            alertaId: id,
            zonaId: z.zonaId,
            creadoPor: adminId,
          })),
        );
      }
    }

    return this.findOne(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ELIMINAR ALERTA (soft-delete)
  // ═══════════════════════════════════════════════════════════════════════════

  async remove(id: number, adminId: number) {
    await this.findOne(id);

    await this.db
      .update(schema.altAlertas)
      .set({
        eliminadoEn: new Date(),
        eliminadoPor: adminId,
      })
      .where(eq(schema.altAlertas.id, id));

    return { message: `Alerta ${id} eliminada exitosamente.` };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMBIAR ESTATUS
  // ═══════════════════════════════════════════════════════════════════════════

  async cambiarEstatus(id: number, nuevoEstatus: string, adminId: number) {
    const alerta = await this.findOne(id);

    // Validar transiciones de estatus
    const transicionesValidas: Record<string, string[]> = {
      borrador: ['activa', 'cancelada'],
      activa: ['desactivada', 'expirada', 'cancelada'],
      desactivada: ['activa', 'cancelada'],
      expirada: [],
      cancelada: [],
    };

    const permitidas = transicionesValidas[alerta.estatus] ?? [];
    if (!permitidas.includes(nuevoEstatus)) {
      throw new BadRequestException(
        `No se puede cambiar de "${alerta.estatus}" a "${nuevoEstatus}". Transiciones válidas: ${permitidas.join(', ') || 'ninguna'}.`,
      );
    }

    await this.db
      .update(schema.altAlertas)
      .set({ estatus: nuevoEstatus as any, actualizadoPor: adminId })
      .where(eq(schema.altAlertas.id, id));

    // Enviar push cuando la alerta se activa
    if (nuevoEstatus === 'activa') {
      this.notificaciones.enviarPushAlerta(id).catch((err) => {
        // No bloquear la respuesta por error de push
        console.error(`Error enviando push para alerta ${id}:`, err);
      });
    }

    return this.findOne(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTUALIZACIONES DE ALERTA (historial de cambios)
  // ═══════════════════════════════════════════════════════════════════════════

  async crearActualizacion(alertaId: number, dto: CreateActualizacionDto, adminId: number) {
    const alerta = await this.findOne(alertaId);

    const [actualizacion] = await this.db
      .insert(schema.altActualizacionesAlerta)
      .values({
        alertaId,
        mensaje: dto.mensaje,
        estatusAnterior: alerta.estatus,
        estatusNuevo: dto.estatusNuevo,
        enviarPush: dto.enviarPush ?? false,
        creadoPor: adminId,
      })
      .returning();

    // Actualizar estatus de la alerta si cambió
    if (dto.estatusNuevo !== alerta.estatus) {
      await this.cambiarEstatus(alertaId, dto.estatusNuevo, adminId);
    }

    // Enviar push si se solicitó
    if (dto.enviarPush) {
      this.notificaciones
        .enviarPushActualizacion(alertaId, actualizacion.id, dto.mensaje)
        .catch((err) => {
          console.error(`Error enviando push de actualización ${actualizacion.id}:`, err);
        });
    }

    return actualizacion;
  }

  async obtenerActualizaciones(alertaId: number) {
    await this.findOne(alertaId); // Verifica existencia

    return this.db
      .select()
      .from(schema.altActualizacionesAlerta)
      .where(
        and(
          eq(schema.altActualizacionesAlerta.alertaId, alertaId),
          isNull(schema.altActualizacionesAlerta.eliminadoEn),
        ),
      )
      .orderBy(desc(schema.altActualizacionesAlerta.creadoEn));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONAS DE ALERTA (N:M)
  // ═══════════════════════════════════════════════════════════════════════════

  async agregarZona(alertaId: number, zonaId: number, adminId: number) {
    await this.findOne(alertaId);

    // Verificar si ya existe la asociación
    const [existing] = await this.db
      .select()
      .from(schema.altAlertasZonas)
      .where(
        and(
          eq(schema.altAlertasZonas.alertaId, alertaId),
          eq(schema.altAlertasZonas.zonaId, zonaId),
          isNull(schema.altAlertasZonas.eliminadoEn),
        ),
      );

    if (existing) {
      throw new BadRequestException(`La zona ${zonaId} ya está asociada a la alerta ${alertaId}.`);
    }

    const [asociacion] = await this.db
      .insert(schema.altAlertasZonas)
      .values({ alertaId, zonaId, creadoPor: adminId })
      .returning();

    return asociacion;
  }

  async removerZona(alertaId: number, zonaId: number, adminId: number) {
    await this.findOne(alertaId);

    const result = await this.db
      .update(schema.altAlertasZonas)
      .set({ eliminadoEn: new Date(), eliminadoPor: adminId })
      .where(
        and(
          eq(schema.altAlertasZonas.alertaId, alertaId),
          eq(schema.altAlertasZonas.zonaId, zonaId),
          isNull(schema.altAlertasZonas.eliminadoEn),
        ),
      )
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`La zona ${zonaId} no está asociada a la alerta ${alertaId}.`);
    }

    return { message: `Zona ${zonaId} removida de la alerta ${alertaId}.` };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ALERTAS APLICABLES A UN DISPOSITIVO/USUARIO (historial paginado)
  // ═══════════════════════════════════════════════════════════════════════════

  async findAlertasByUsuario(usuarioId: number, page = 1, limit = 20) {
    const filtradas = await this._filtrarParaUsuario(usuarioId);

    const total = filtradas.length;
    const offset = (page - 1) * limit;
    const paginadas = filtradas.slice(offset, offset + limit);

    const data = await this._enriquecerConCategoria(paginadas);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ÚLTIMAS ALERTAS PARA UN DISPOSITIVO/USUARIO
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Retorna las alertas más recientes que aplican al usuario.
   * Aplica los mismos criterios geográficos/severidad que findAlertasByUsuario.
   *
   * @param usuarioId  ID del usuario/dispositivo
   * @param limit      Máximo de alertas a retornar (default 10)
   * @param horas      Si se indica, solo devuelve alertas cuyo fechaInicio
   *                   sea dentro de las últimas N horas (default: sin límite)
   */
  async findUltimasAlertasByUsuario(usuarioId: number, limit = 10, horas?: number) {
    const filtradas = await this._filtrarParaUsuario(usuarioId, horas);
    const recientes = filtradas.slice(0, limit);
    const data = await this._enriquecerConCategoria(recientes);
    return { data, total: filtradas.length };
  }

  /**
   * Retorna la última alerta activa que aplica al usuario.
   * Si no hay alertas aplicables, retorna null.
   *
   * @param usuarioId  ID del usuario/dispositivo
   */
  async findUltimaAlertaByUsuario(usuarioId: number) {
    const filtradas = await this._filtrarParaUsuario(usuarioId);

    if (filtradas.length === 0) {
      return null;
    }

    const [ultima] = filtradas; // Ya viene ordenado por creadoEn desc
    const [enriquecida] = await this._enriquecerConCategoria([ultima]);

    return enriquecida;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER PRIVADO: obtiene y filtra alertas que aplican al usuario
  // ═══════════════════════════════════════════════════════════════════════════

  private async _filtrarParaUsuario(usuarioId: number, horas?: number) {
    // 1. Obtener usuario
    const [usuario] = await this.db
      .select()
      .from(schema.altUsuarios)
      .where(and(eq(schema.altUsuarios.id, usuarioId), isNull(schema.altUsuarios.eliminadoEn)));

    if (!usuario) {
      throw new NotFoundException(`Usuario con id ${usuarioId} no encontrado.`);
    }

    // 2. Zonas suscritas activas del usuario
    const zonasUsuario = await this.db
      .select({ zonaId: schema.altUsuariosZonas.zonaId })
      .from(schema.altUsuariosZonas)
      .where(
        and(
          eq(schema.altUsuariosZonas.usuarioId, usuarioId),
          eq(schema.altUsuariosZonas.activo, true),
          isNull(schema.altUsuariosZonas.eliminadoEn),
        ),
      );
    const zonaIdsUsuario = new Set(zonasUsuario.map((z) => z.zonaId));

    // 3. Severidades permitidas
    const severidadesMap: Record<string, string[]> = {
      informativa: ['informativa', 'preventiva', 'emergencia'],
      preventiva: ['preventiva', 'emergencia'],
      emergencia: ['emergencia'],
    };
    const severidadesPermitidas = severidadesMap[usuario.severidadMinima ?? 'informativa'];

    // 4. Condiciones base de la query
    const conditions: SQL[] = [
      eq(schema.altAlertas.estatus, 'activa' as any),
      isNull(schema.altAlertas.eliminadoEn),
      inArray(schema.altAlertas.nivelSeveridad, severidadesPermitidas as any[]),
    ];

    // 4a. Filtro de ventana de tiempo si se indica
    if (horas != null && horas > 0) {
      const desde = new Date(Date.now() - horas * 60 * 60 * 1000);
      conditions.push(gte(schema.altAlertas.fechaInicio, desde));
    }

    // 5. Alertas activas
    const alertas = await this.db
      .select()
      .from(schema.altAlertas)
      .where(and(...conditions))
      .orderBy(desc(schema.altAlertas.creadoEn));

    if (alertas.length === 0) return [];

    // 6. Zonas N:M de esas alertas
    const alertaIds = alertas.map((a) => a.id);
    const alertasZonas = await this.db
      .select({ alertaId: schema.altAlertasZonas.alertaId, zonaId: schema.altAlertasZonas.zonaId })
      .from(schema.altAlertasZonas)
      .where(
        and(
          inArray(schema.altAlertasZonas.alertaId, alertaIds),
          isNull(schema.altAlertasZonas.eliminadoEn),
        ),
      );

    const zonasDeAlertas = new Map<number, number[]>();
    for (const az of alertasZonas) {
      const lista = zonasDeAlertas.get(az.alertaId) ?? [];
      lista.push(az.zonaId);
      zonasDeAlertas.set(az.alertaId, lista);
    }

    // 7. Zonas que comparten el CP del usuario
    const zonaIdsConCp = new Set<number>();
    if (usuario.codigoPostal) {
      const zonasCp = await this.db
        .select({ id: schema.catZonasGeograficas.id })
        .from(schema.catZonasGeograficas)
        .where(
          and(
            eq(schema.catZonasGeograficas.codigoPostal, usuario.codigoPostal),
            isNull(schema.catZonasGeograficas.eliminadoEn),
          ),
        );
      zonasCp.forEach((z) => zonaIdsConCp.add(z.id));
    }

    // 8. Coordenadas GPS del usuario
    const userLat = usuario.latitud ? parseFloat(usuario.latitud) : null;
    const userLon = usuario.longitud ? parseFloat(usuario.longitud) : null;

    // 9. Filtro geográfico
    return alertas.filter((alerta) => {
      if (alerta.nivelCobertura === 'pais') return true;
      if (alerta.zonaId != null && zonaIdsUsuario.has(alerta.zonaId)) return true;
      if (alerta.zonaId != null && zonaIdsConCp.has(alerta.zonaId)) return true;

      const zonasAlerta = zonasDeAlertas.get(alerta.id) ?? [];
      if (zonasAlerta.some((z) => zonaIdsUsuario.has(z))) return true;
      if (zonasAlerta.some((z) => zonaIdsConCp.has(z))) return true;

      if (
        userLat !== null &&
        userLon !== null &&
        alerta.centroLatitud &&
        alerta.centroLongitud &&
        alerta.radioKm
      ) {
        const dist = this.haversineKm(
          userLat, userLon,
          parseFloat(alerta.centroLatitud),
          parseFloat(alerta.centroLongitud),
        );
        if (dist <= parseFloat(alerta.radioKm)) return true;
      }

      return false;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER PRIVADO: enriquece alertas con su categoría
  // ═══════════════════════════════════════════════════════════════════════════

  private async _enriquecerConCategoria(alertas: (typeof schema.altAlertas.$inferSelect)[]) {
    return Promise.all(
      alertas.map(async (alerta) => {
        const [categoria] = await this.db
          .select({
            id: schema.catCategoriasAlerta.id,
            nombre: schema.catCategoriasAlerta.nombre,
            colorHex: schema.catCategoriasAlerta.colorHex,
            icono: schema.catCategoriasAlerta.icono,
          })
          .from(schema.catCategoriasAlerta)
          .where(eq(schema.catCategoriasAlerta.id, alerta.categoriaId))
          .limit(1);
        return { ...alerta, categoria };
      }),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILIDAD PRIVADA: distancia Haversine entre dos coordenadas (km)
  // ═══════════════════════════════════════════════════════════════════════════

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
