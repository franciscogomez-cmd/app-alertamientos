import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, ilike, isNull, SQL } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import { CreateZonaDto, UpdateZonaDto, QueryZonasDto } from './dto';

type DrizzleDB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class ZonasService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(dto: CreateZonaDto, adminId: number) {
    const [zona] = await this.db
      .insert(schema.catZonasGeograficas)
      .values({
        nombre: dto.nombre,
        tipo: dto.tipo as any,
        clavePais: dto.clavePais,
        claveEstado: dto.claveEstado,
        claveMunicipio: dto.claveMunicipio,
        codigoPostal: dto.codigoPostal,
        centroLatitud: dto.centroLatitud?.toString(),
        centroLongitud: dto.centroLongitud?.toString(),
        radioKm: dto.radioKm?.toString(),
        poligono: dto.poligono,
        activo: dto.activo,
        creadoPor: adminId,
      })
      .returning();

    return zona;
  }

  async findAll(query: QueryZonasDto) {
    const { page = 1, limit = 20, busqueda, tipo, claveEstado, activo } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [isNull(schema.catZonasGeograficas.eliminadoEn)];

    if (busqueda) {
      conditions.push(ilike(schema.catZonasGeograficas.nombre, `%${busqueda}%`));
    }
    if (tipo) {
      conditions.push(eq(schema.catZonasGeograficas.tipo, tipo as any));
    }
    if (claveEstado) {
      conditions.push(eq(schema.catZonasGeograficas.claveEstado, claveEstado));
    }
    if (activo !== undefined) {
      conditions.push(eq(schema.catZonasGeograficas.activo, activo));
    }

    const where = and(...conditions);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(schema.catZonasGeograficas)
      .where(where);

    const data = await this.db
      .select()
      .from(schema.catZonasGeograficas)
      .where(where)
      .orderBy(desc(schema.catZonasGeograficas.creadoEn))
      .limit(limit)
      .offset(offset);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const [zona] = await this.db
      .select()
      .from(schema.catZonasGeograficas)
      .where(
        and(
          eq(schema.catZonasGeograficas.id, id),
          isNull(schema.catZonasGeograficas.eliminadoEn),
        ),
      );

    if (!zona) {
      throw new NotFoundException(`Zona geográfica con id ${id} no encontrada.`);
    }

    return zona;
  }

  async update(id: number, dto: UpdateZonaDto, adminId: number) {
    await this.findOne(id);

    const data = dto as Partial<CreateZonaDto>;
    const updateValues: Record<string, any> = { actualizadoPor: adminId };

    if (data.nombre !== undefined) updateValues.nombre = data.nombre;
    if (data.tipo !== undefined) updateValues.tipo = data.tipo;
    if (data.clavePais !== undefined) updateValues.clavePais = data.clavePais;
    if (data.claveEstado !== undefined) updateValues.claveEstado = data.claveEstado;
    if (data.claveMunicipio !== undefined) updateValues.claveMunicipio = data.claveMunicipio;
    if (data.codigoPostal !== undefined) updateValues.codigoPostal = data.codigoPostal;
    if (data.centroLatitud !== undefined) updateValues.centroLatitud = data.centroLatitud?.toString();
    if (data.centroLongitud !== undefined) updateValues.centroLongitud = data.centroLongitud?.toString();
    if (data.radioKm !== undefined) updateValues.radioKm = data.radioKm?.toString();
    if (data.poligono !== undefined) updateValues.poligono = data.poligono;
    if (data.activo !== undefined) updateValues.activo = data.activo;

    const [updated] = await this.db
      .update(schema.catZonasGeograficas)
      .set(updateValues)
      .where(eq(schema.catZonasGeograficas.id, id))
      .returning();

    return updated;
  }

  async remove(id: number, adminId: number) {
    await this.findOne(id);

    await this.db
      .update(schema.catZonasGeograficas)
      .set({
        eliminadoEn: new Date(),
        eliminadoPor: adminId,
      })
      .where(eq(schema.catZonasGeograficas.id, id));

    return { message: `Zona geográfica ${id} eliminada exitosamente.` };
  }

  /** Alternar estado activo/inactivo */
  async toggleActivo(id: number, adminId: number) {
    const zona = await this.findOne(id);

    const [updated] = await this.db
      .update(schema.catZonasGeograficas)
      .set({
        activo: !zona.activo,
        actualizadoPor: adminId,
      })
      .where(eq(schema.catZonasGeograficas.id, id))
      .returning();

    return updated;
  }
}
