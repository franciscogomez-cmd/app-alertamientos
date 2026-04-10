import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, ilike, isNull, SQL } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import { CreateCategoriaDto, UpdateCategoriaDto, QueryCategoriasDto } from './dto';

type DrizzleDB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class CategoriasService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(dto: CreateCategoriaDto, adminId: number) {
    // Verificar slug único
    const [existing] = await this.db
      .select({ id: schema.catCategoriasAlerta.id })
      .from(schema.catCategoriasAlerta)
      .where(
        and(
          eq(schema.catCategoriasAlerta.slug, dto.slug),
          isNull(schema.catCategoriasAlerta.eliminadoEn),
        ),
      );

    if (existing) {
      throw new ConflictException(`Ya existe una categoría con el slug "${dto.slug}".`);
    }

    const [categoria] = await this.db
      .insert(schema.catCategoriasAlerta)
      .values({
        nombre: dto.nombre,
        slug: dto.slug,
        icono: dto.icono,
        colorHex: dto.colorHex,
        descripcion: dto.descripcion,
        activo: dto.activo,
        creadoPor: adminId,
      })
      .returning();

    return categoria;
  }

  async findAll(query: QueryCategoriasDto) {
    const { page = 1, limit = 20, busqueda, activo } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [isNull(schema.catCategoriasAlerta.eliminadoEn)];

    if (busqueda) {
      conditions.push(ilike(schema.catCategoriasAlerta.nombre, `%${busqueda}%`));
    }
    if (activo !== undefined) {
      conditions.push(eq(schema.catCategoriasAlerta.activo, activo));
    }

    const where = and(...conditions);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(schema.catCategoriasAlerta)
      .where(where);

    const data = await this.db
      .select()
      .from(schema.catCategoriasAlerta)
      .where(where)
      .orderBy(desc(schema.catCategoriasAlerta.creadoEn))
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
    const [categoria] = await this.db
      .select()
      .from(schema.catCategoriasAlerta)
      .where(
        and(
          eq(schema.catCategoriasAlerta.id, id),
          isNull(schema.catCategoriasAlerta.eliminadoEn),
        ),
      );

    if (!categoria) {
      throw new NotFoundException(`Categoría con id ${id} no encontrada.`);
    }

    return categoria;
  }

  async update(id: number, dto: UpdateCategoriaDto, adminId: number) {
    await this.findOne(id);

    const data = dto as Partial<CreateCategoriaDto>;

    // Verificar slug único si cambia
    if (data.slug) {
      const [existing] = await this.db
        .select({ id: schema.catCategoriasAlerta.id })
        .from(schema.catCategoriasAlerta)
        .where(
          and(
            eq(schema.catCategoriasAlerta.slug, data.slug),
            isNull(schema.catCategoriasAlerta.eliminadoEn),
          ),
        );

      if (existing && existing.id !== id) {
        throw new ConflictException(`Ya existe una categoría con el slug "${data.slug}".`);
      }
    }

    const updateValues: Record<string, any> = { actualizadoPor: adminId };

    if (data.nombre !== undefined) updateValues.nombre = data.nombre;
    if (data.slug !== undefined) updateValues.slug = data.slug;
    if (data.icono !== undefined) updateValues.icono = data.icono;
    if (data.colorHex !== undefined) updateValues.colorHex = data.colorHex;
    if (data.descripcion !== undefined) updateValues.descripcion = data.descripcion;
    if (data.activo !== undefined) updateValues.activo = data.activo;

    const [updated] = await this.db
      .update(schema.catCategoriasAlerta)
      .set(updateValues)
      .where(eq(schema.catCategoriasAlerta.id, id))
      .returning();

    return updated;
  }

  async remove(id: number, adminId: number) {
    await this.findOne(id);

    await this.db
      .update(schema.catCategoriasAlerta)
      .set({
        eliminadoEn: new Date(),
        eliminadoPor: adminId,
      })
      .where(eq(schema.catCategoriasAlerta.id, id));

    return { message: `Categoría ${id} eliminada exitosamente.` };
  }

  /** Alternar estado activo/inactivo */
  async toggleActivo(id: number, adminId: number) {
    const categoria = await this.findOne(id);

    const [updated] = await this.db
      .update(schema.catCategoriasAlerta)
      .set({
        activo: !categoria.activo,
        actualizadoPor: adminId,
      })
      .where(eq(schema.catCategoriasAlerta.id, id))
      .returning();

    return updated;
  }
}
