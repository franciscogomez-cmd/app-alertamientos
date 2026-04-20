import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, ilike, inArray, isNull, or, SQL } from 'drizzle-orm';
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
}
